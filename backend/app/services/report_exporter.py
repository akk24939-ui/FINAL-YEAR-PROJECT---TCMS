"""
Report Exporter Service — Power BI Option 1: Scheduled Parquet/CSV export.

Security Notes:
  - All DB queries use SQLAlchemy text() with bound parameters.
  - Export files are written outside webroot to backend/exports/powerbi/.
  - Files are never served directly over HTTP — only a JSON manifest is exposed.
  - File names are deterministic (view_name + date) — no user input in path.
  - APScheduler job runs with the app's DB session (not a separate connection string
    stored anywhere accessible to Power BI directly), keeping DB credentials server-side.

Power BI Usage (Option 1):
  1. Admin opens Power BI Desktop.
  2. Get Data → Folder → navigate to backend/exports/powerbi/
     (or a shared network path / cloud blob storage you map this folder to).
  3. Power BI combines all *.parquet files per dataset.
  4. Refresh = re-run "Get Data". The manifest endpoint
     (GET /api/v1/admin/reports/export/powerbi-manifest) shows what files exist.

Production upgrade path (Option 3):
  Grant a read-only DB user SELECT only on v_* views, point Power BI's
  PostgreSQL connector at it. Revoke from tasmac_reports role any time.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

try:
    import pandas as pd
    _PANDAS_OK = True
except ImportError:
    _PANDAS_OK = False

try:
    import pyarrow  # noqa: F401
    _PARQUET_OK = True
except ImportError:
    _PARQUET_OK = False

# ── Export directory (outside webroot) ───────────────────────────────────────
_EXPORT_DIR = Path(__file__).parents[3] / "exports" / "powerbi"

K_ANON_THRESHOLD = 5


# ── View → SQL map ────────────────────────────────────────────────────────────
# Only aggregate-only views are exported. No PII columns anywhere.
_VIEW_QUERIES: dict[str, str] = {
    "district_sales": """
        SELECT
            c.district,
            COUNT(pu.id)                                                AS total_purchases,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)  AS total_revenue,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)    AS total_drinks,
            COUNT(DISTINCT c.id)                                        AS unique_consumers
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        GROUP BY c.district
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY c.district
    """,
    "age_group_consumption": """
        SELECT
            CASE
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 25 THEN '<25'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 35 THEN '25-34'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 45 THEN '35-44'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 55 THEN '45-54'
                ELSE '55+'
            END                                                         AS age_bracket,
            COUNT(DISTINCT c.id)                                        AS consumer_count,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)    AS total_drinks
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        GROUP BY age_bracket
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY age_bracket
    """,
    "shop_revenue_monthly": """
        SELECT
            s.district,
            TO_CHAR(DATE_TRUNC('month', pu.timestamp), 'YYYY-MM')          AS year_month,
            COUNT(pu.id)                                                    AS transactions,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)      AS revenue
        FROM shops    s
        JOIN purchases pu ON pu.shop_id = s.id
        JOIN products  pr ON pr.id = pu.product_id
        GROUP BY s.district, year_month
        ORDER BY year_month, s.district
    """,
    "consumption_trend_daily": """
        SELECT
            CAST(pu.timestamp AS DATE)                                      AS purchase_date,
            c.district,
            COUNT(pu.id)                                                    AS total_purchases,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)        AS total_drinks
        FROM purchases pu
        JOIN consumers c  ON c.id  = pu.consumer_id
        JOIN products  pr ON pr.id = pu.product_id
        GROUP BY purchase_date, c.district
        ORDER BY purchase_date, c.district
    """,
    "restriction_adoption_rate": """
        SELECT
            c.district,
            COUNT(DISTINCT c.id)                                            AS total_consumers,
            COUNT(DISTINCT r.consumer_id)                                   AS restricted_count,
            ROUND(
                100.0 * COUNT(DISTINCT r.consumer_id)
                      / NULLIF(COUNT(DISTINCT c.id), 0),
                2
            )                                                               AS adoption_rate_pct
        FROM consumers c
        LEFT JOIN restrictions r ON r.consumer_id = c.id
        GROUP BY c.district
        HAVING COUNT(DISTINCT c.id) >= :threshold
    """,
}


# ── Core export logic ─────────────────────────────────────────────────────────

async def export_all_views(db: AsyncSession) -> dict[str, Any]:
    """
    Query all report views via bound params, write Parquet (or CSV fallback),
    and update manifest.json. Returns the manifest dict.

    Called by APScheduler every 4 hours; also callable on-demand.
    """
    if not _PANDAS_OK:
        raise RuntimeError("pandas is not installed — cannot generate Power BI export")

    _EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    today_str = date.today().isoformat()          # e.g. "2026-08-09"
    generated_at = datetime.utcnow()

    manifest_files: list[dict] = []

    for view_name, sql_str in _VIEW_QUERIES.items():
        params: dict[str, Any] = {"threshold": K_ANON_THRESHOLD}
        result = await db.execute(text(sql_str), params)
        rows = result.fetchall()
        columns = list(result.keys())             # coltype: RMKeyView
        df = pd.DataFrame(rows, columns=columns)

        # Choose Parquet if pyarrow available, else CSV (still readable by Power BI)
        if _PARQUET_OK:
            filename = f"{view_name}_{today_str}.parquet"
            filepath = _EXPORT_DIR / filename
            df.to_parquet(filepath, index=False)
        else:
            filename = f"{view_name}_{today_str}.csv"
            filepath = _EXPORT_DIR / filename
            df.to_csv(filepath, index=False)

        manifest_files.append({
            "filename": filename,
            "view_name": view_name,
            "row_count": len(df),
            "generated_at": generated_at.isoformat(),
        })

    manifest: dict[str, Any] = {
        "generated_at": generated_at.isoformat(),
        "files": manifest_files,
        "instructions": (
            "Open Power BI Desktop → Get Data → Folder → "
            f"select the exports/powerbi/ directory. "
            "Load the .parquet (or .csv) files for each dataset. "
            "Refresh daily to pick up the latest scheduled export."
        ),
    }
    manifest_path = _EXPORT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def read_manifest() -> dict[str, Any] | None:
    """Read the last written manifest.json. Returns None if no export has run yet."""
    manifest_path = _EXPORT_DIR / "manifest.json"
    if not manifest_path.exists():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
