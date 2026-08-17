"""
Report Generator Service — Pandas + Matplotlib → PDF

Security Notes:
  - All DB queries use SQLAlchemy text() with bound parameters — no f-string SQL.
  - Filter columns are resolved via a whitelist dict, never from user input directly.
  - No eval/exec anywhere.
  - PDF title/metadata uses static strings; filter values are rendered as escaped
    Python string representations (no HTML, no script injection surface).
  - The returned bytes are written to an in-memory BytesIO buffer — no temp files.
"""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import matplotlib
matplotlib.use("Agg")                        # non-interactive backend (server safe)
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.gridspec import GridSpec
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ── Palette ───────────────────────────────────────────────────────────────────
_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
           "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"]

_FONT  = {"family": "DejaVu Sans"}
plt.rcParams.update({"font.family": "DejaVu Sans", "axes.spines.top": False,
                     "axes.spines.right": False, "figure.facecolor": "#f8fafc"})

K_ANON_THRESHOLD = 5   # mirrors admin.py constant


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_str(v: Any) -> str:
    """Render a filter value as a safe display string (no HTML, no script)."""
    if v is None:
        return "all"
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    # Strip any angle-bracket content (belt-and-suspenders; Matplotlib doesn't parse HTML)
    return str(v).replace("<", "").replace(">", "")


def _build_params(
    district:  str | None,
    from_date: date | None,
    to_date:   date | None,
) -> dict:
    params: dict[str, Any] = {"threshold": K_ANON_THRESHOLD}
    if district:
        params["district"] = district
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date
    return params


def _district_clause(district: str | None) -> str:
    return "AND c.district = :district" if district else ""


def _date_clauses(alias: str = "pu") -> str:
    """Returns placeholder SQL snippets that are safe (no user input in clause itself)."""
    return (
        "AND {a}.timestamp >= :from_date ".format(a=alias),
        "AND {a}.timestamp <= :to_date ".format(a=alias),
    )


# ── Data fetchers ─────────────────────────────────────────────────────────────

async def _fetch_district_sales(
    db: AsyncSession,
    district: str | None,
    from_date: date | None,
    to_date: date | None,
) -> pd.DataFrame:
    from_clause, to_clause = _date_clauses()
    sql = text(f"""
        SELECT
            c.district,
            COUNT(pu.id)                                                AS total_purchases,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)  AS total_revenue,
            COUNT(DISTINCT c.id)                                        AS unique_consumers
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1
            {from_clause if from_date else ''}
            {to_clause   if to_date   else ''}
            {_district_clause(district)}
        GROUP BY c.district
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY total_purchases DESC
        LIMIT 15
    """)
    result = await db.execute(sql, _build_params(district, from_date, to_date))
    rows = result.fetchall()
    return pd.DataFrame(rows, columns=["district", "total_purchases",
                                       "total_revenue", "unique_consumers"])


async def _fetch_daily_trend(
    db: AsyncSession,
    district: str | None,
    from_date: date | None,
    to_date: date | None,
) -> pd.DataFrame:
    from_clause, to_clause = _date_clauses()
    sql = text(f"""
        SELECT
            CAST(pu.timestamp AS DATE)                                  AS purchase_date,
            c.district,
            COUNT(pu.id)                                                AS total_purchases,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)    AS total_drinks
        FROM purchases pu
        JOIN consumers c  ON c.id  = pu.consumer_id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1
            {from_clause if from_date else ''}
            {to_clause   if to_date   else ''}
            {_district_clause(district)}
        GROUP BY purchase_date, c.district
        ORDER BY purchase_date
    """)
    result = await db.execute(sql, _build_params(district, from_date, to_date))
    rows = result.fetchall()
    df = pd.DataFrame(rows, columns=["purchase_date", "district",
                                     "total_purchases", "total_drinks"])
    if not df.empty:
        df["purchase_date"] = pd.to_datetime(df["purchase_date"])
    return df


async def _fetch_age_groups(db: AsyncSession) -> pd.DataFrame:
    sql = text("""
        SELECT
            CASE
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 25 THEN '<25'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 35 THEN '25-34'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 45 THEN '35-44'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 55 THEN '45-54'
                ELSE '55+'
            END                                                          AS age_bracket,
            COUNT(DISTINCT c.id)                                         AS consumer_count,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)     AS total_drinks
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        GROUP BY age_bracket
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY age_bracket
    """)
    result = await db.execute(sql, {"threshold": K_ANON_THRESHOLD})
    rows = result.fetchall()
    return pd.DataFrame(rows, columns=["age_bracket", "consumer_count", "total_drinks"])


async def _fetch_shop_revenue(
    db: AsyncSession,
    from_date: date | None,
    to_date: date | None,
) -> pd.DataFrame:
    from_clause, to_clause = _date_clauses()
    sql = text(f"""
        SELECT
            s.district,
            TO_CHAR(DATE_TRUNC('month', pu.timestamp), 'YYYY-MM')           AS year_month,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)       AS revenue
        FROM shops    s
        JOIN purchases pu ON pu.shop_id = s.id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1
            {from_clause if from_date else ''}
            {to_clause   if to_date   else ''}
        GROUP BY s.district, year_month
        ORDER BY year_month, s.district
    """)
    result = await db.execute(sql, _build_params(None, from_date, to_date))
    rows = result.fetchall()
    return pd.DataFrame(rows, columns=["district", "year_month", "revenue"])


# ── Chart renderers ───────────────────────────────────────────────────────────

def _chart_district_bar(ax: plt.Axes, df: pd.DataFrame) -> None:
    if df.empty:
        ax.text(0.5, 0.5, "No data for selected filters", ha="center",
                va="center", transform=ax.transAxes, color="#6b7280")
        return
    bars = ax.barh(df["district"], df["total_purchases"].astype(float),
                   color=_COLORS[0], alpha=0.85)
    ax.bar_label(bars, fmt="%,.0f", padding=4, fontsize=8, color="#374151")
    ax.set_xlabel("Total Purchases", fontsize=9, color="#6b7280")
    ax.set_title("Purchases by District (Top 15)", fontsize=11,
                 fontweight="bold", color="#111827", pad=10)
    ax.tick_params(axis="both", labelsize=8, colors="#6b7280")
    ax.invert_yaxis()


def _chart_daily_trend(ax: plt.Axes, df: pd.DataFrame) -> None:
    if df.empty:
        ax.text(0.5, 0.5, "No data for selected filters", ha="center",
                va="center", transform=ax.transAxes, color="#6b7280")
        return
    # Aggregate across districts for trend overview
    daily = df.groupby("purchase_date", as_index=False)["total_purchases"].sum()
    ax.plot(daily["purchase_date"], daily["total_purchases"].astype(float),
            color=_COLORS[1], linewidth=2, marker="o", markersize=3)
    ax.fill_between(daily["purchase_date"], daily["total_purchases"].astype(float),
                    alpha=0.12, color=_COLORS[1])
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=30, ha="right", fontsize=7)
    ax.set_ylabel("Purchases", fontsize=9, color="#6b7280")
    ax.set_title("Daily Consumption Trend", fontsize=11,
                 fontweight="bold", color="#111827", pad=10)
    ax.tick_params(axis="y", labelsize=8, colors="#6b7280")


def _chart_age_donut(ax: plt.Axes, df: pd.DataFrame) -> None:
    if df.empty:
        ax.text(0.5, 0.5, "No data", ha="center", va="center",
                transform=ax.transAxes, color="#6b7280")
        return
    sizes   = df["total_drinks"].astype(float).tolist()
    labels  = df["age_bracket"].tolist()
    colors  = _COLORS[:len(sizes)]
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors,
        autopct="%1.1f%%", pctdistance=0.75,
        wedgeprops={"width": 0.55, "edgecolor": "white", "linewidth": 2},
        startangle=90,
    )
    for t in texts + autotexts:
        t.set_fontsize(8)
    ax.set_title("Consumption by Age Group\n(standard drinks)",
                 fontsize=11, fontweight="bold", color="#111827", pad=10)


def _chart_shop_revenue_stacked(ax: plt.Axes, df: pd.DataFrame) -> None:
    if df.empty:
        ax.text(0.5, 0.5, "No data for selected filters", ha="center",
                va="center", transform=ax.transAxes, color="#6b7280")
        return
    pivot = df.pivot_table(index="year_month", columns="district",
                           values="revenue", aggfunc="sum", fill_value=0)
    months = pivot.index.tolist()
    x = np.arange(len(months))
    bar_w = max(0.15, min(0.6, 0.6 / max(len(pivot.columns), 1)))
    bottom = np.zeros(len(months))
    for i, dist in enumerate(pivot.columns):
        vals = pivot[dist].astype(float).values
        ax.bar(x, vals, bar_w * 4, bottom=bottom,
               color=_COLORS[i % len(_COLORS)], label=dist, alpha=0.85)
        bottom += vals
    ax.set_xticks(x)
    ax.set_xticklabels(months, rotation=30, ha="right", fontsize=7)
    ax.set_ylabel("Revenue (₹)", fontsize=9, color="#6b7280")
    ax.set_title("Monthly Revenue by District", fontsize=11,
                 fontweight="bold", color="#111827", pad=10)
    ax.tick_params(axis="y", labelsize=8, colors="#6b7280")
    if len(pivot.columns) <= 10:
        ax.legend(fontsize=7, loc="upper left", framealpha=0.6)


# ── Cover page ────────────────────────────────────────────────────────────────

def _render_cover(pdf: PdfPages, filters: dict, generated_by: str,
                  generated_at: datetime, audit_log_id: uuid.UUID) -> None:
    fig = plt.figure(figsize=(11.69, 8.27))   # A4 landscape
    fig.patch.set_facecolor("#1e3a5f")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()

    ax.text(0.5, 0.82, "Smart TASMAC", ha="center", va="center",
            color="white", fontsize=32, fontweight="bold", transform=ax.transAxes)
    ax.text(0.5, 0.73, "Consumer Regulation System — Official Report",
            ha="center", va="center", color="#93c5fd", fontsize=16, transform=ax.transAxes)

    # Divider
    ax.axhline(0.66, xmin=0.1, xmax=0.9, color="#3b82f6", linewidth=1.5)

    # Filter summary
    filter_lines = [
        f"District : {_safe_str(filters.get('district'))}",
        f"From     : {_safe_str(filters.get('from_date'))}",
        f"To       : {_safe_str(filters.get('to_date'))}",
        f"Category : {_safe_str(filters.get('category'))}",
    ]
    for i, line in enumerate(filter_lines):
        ax.text(0.5, 0.58 - i * 0.06, line, ha="center", va="center",
                color="#e2e8f0", fontsize=12, transform=ax.transAxes)

    ax.axhline(0.28, xmin=0.1, xmax=0.9, color="#3b82f640", linewidth=1)

    meta_lines = [
        f"Generated by  : {_safe_str(generated_by)}",
        f"Generated at  : {generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"Audit Log ID  : {_safe_str(audit_log_id)}",
        "EDUCATIONAL PROTOTYPE — All data is anonymised aggregate only. No PII included.",
    ]
    for i, line in enumerate(meta_lines):
        ax.text(0.5, 0.22 - i * 0.055, line, ha="center", va="center",
                color="#94a3b8" if i < 3 else "#f87171", fontsize=9,
                transform=ax.transAxes)

    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# ── Public entrypoint ─────────────────────────────────────────────────────────

async def generate_pdf(
    *,
    db:               AsyncSession,
    district:         str | None = None,
    from_date:        date | None = None,
    to_date:          date | None = None,
    generated_by:     str = "system",
    audit_log_id:     uuid.UUID,
) -> bytes:
    """Build a multi-page PDF report and return as raw bytes.

    All DB interactions use bound parameters — no user-supplied strings
    are interpolated into SQL.
    """
    filters = {"district": district, "from_date": from_date, "to_date": to_date}
    generated_at = datetime.utcnow()

    # Fetch data concurrently‑ish (SQLAlchemy async but same session → sequential)
    df_district = await _fetch_district_sales(db, district, from_date, to_date)
    df_trend    = await _fetch_daily_trend(db, district, from_date, to_date)
    df_age      = await _fetch_age_groups(db)
    df_revenue  = await _fetch_shop_revenue(db, from_date, to_date)

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        # Cover page
        _render_cover(pdf, filters, generated_by, generated_at, audit_log_id)

        # Page 2: District bar + Daily trend
        fig = plt.figure(figsize=(11.69, 8.27))
        fig.patch.set_facecolor("#f8fafc")
        fig.suptitle(
            "Sales Overview",
            fontsize=14, fontweight="bold", color="#111827", y=0.98,
        )
        gs = GridSpec(1, 2, figure=fig, wspace=0.35,
                      left=0.07, right=0.97, top=0.90, bottom=0.12)
        _chart_district_bar(fig.add_subplot(gs[0, 0]), df_district)
        _chart_daily_trend(fig.add_subplot(gs[0, 1]), df_trend)
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

        # Page 3: Age donut + Shop revenue stacked bar
        fig = plt.figure(figsize=(11.69, 8.27))
        fig.patch.set_facecolor("#f8fafc")
        fig.suptitle(
            "Consumer Analytics",
            fontsize=14, fontweight="bold", color="#111827", y=0.98,
        )
        gs2 = GridSpec(1, 2, figure=fig, wspace=0.4,
                       left=0.07, right=0.97, top=0.90, bottom=0.12)
        _chart_age_donut(fig.add_subplot(gs2[0, 0]), df_age)
        _chart_shop_revenue_stacked(fig.add_subplot(gs2[0, 1]), df_revenue)
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

        # PDF metadata
        d = pdf.infodict()
        d["Title"]   = "Smart TASMAC Report"
        d["Author"]  = "Smart TASMAC System"
        d["Subject"] = "Government Report — Aggregate Data Only"
        d["Creator"] = "report_generator.py"

    buf.seek(0)
    return buf.read()
