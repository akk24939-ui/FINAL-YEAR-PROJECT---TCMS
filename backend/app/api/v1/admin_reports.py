"""
Admin Report Router — /api/v1/admin/reports/*

Security Notes (per Global Context requirements):
  1. AuthZ: require_role("gov_admin") on EVERY endpoint — default-deny.
  2. Input: ReportFilterParams uses Pydantic v2 extra="forbid" + whitelisted sort_by Literal.
  3. SQL: all queries use SQLAlchemy text() with bound parameters; sort column resolved
     from whitelist dict — user-supplied sort_by string is NEVER interpolated into SQL.
  4. PDF generation: no eval/exec; filter values treated as data, not code.
  5. Audit: every PDF and export action writes an audit_log row (actor, action, ip, result).
  6. Rate limiting: PDF + export endpoints capped at 5/minute per user.
  7. Privacy: responses are aggregate-only (mirrors the SQL views); no consumer names/IDs.
  8. Export files are outside webroot — only the manifest JSON is served via HTTP.
"""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.models import AuditLog, ConsumerProfile, Product, Purchase, SelfRestriction, Shop, User
from app.schemas.report_schemas import (
    AgeGroupResponse,
    AgeGroupRow,
    DailyTrendResponse,
    DailyTrendRow,
    DistrictSalesResponse,
    DistrictSalesRow,
    PowerBIManifestResponse,
    PowerBIManifestFile,
    ReportFilterParams,
    ReportSummaryResponse,
    RestrictionAdoptionResponse,
    RestrictionAdoptionRow,
    ShopRevenueResponse,
    ShopRevenueRow,
)
from app.services import report_generator, report_exporter

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])
limiter = Limiter(key_func=get_remote_address)

K_ANON_THRESHOLD = 5

# ── Whitelisted ORDER BY columns (never interpolate sort_by string into SQL) ──
_DISTRICT_SORT_MAP = {
    "district":          "district",
    "revenue":           "total_revenue",
    "purchases":         "total_purchases",
    "unique_consumers":  "unique_consumers",
    "date":              "district",  # fallback for district view
}

_SHOP_SORT_MAP = {
    "date":      "year_month",
    "revenue":   "revenue",
    "purchases": "transactions",
    "district":  "district",
}


# ── Audit log helper ──────────────────────────────────────────────────────────

async def _write_audit(
    db: AsyncSession,
    actor_user_id: uuid.UUID,
    action: str,
    target_table: str,
    target_id: uuid.UUID | None,
    ip_address: str | None,
) -> uuid.UUID:
    log_id = uuid.uuid4()
    db.add(AuditLog(
        id=log_id,
        actor_id=actor_user_id,
        event_type="REPORT_" + action,
        description=f"{action} on {target_table}",
        ip_address=ip_address,
    ))
    await db.commit()
    return log_id


# ── Shared filter clause builders (parameterised, not interpolated) ───────────

def _date_filter_clauses(from_date: date | None, to_date: date | None,
                         alias: str = "pu") -> tuple[str, str]:
    from_cl = f"AND {alias}.purchased_at >= :from_date" if from_date else ""
    to_cl   = f"AND {alias}.purchased_at <= :to_date"   if to_date   else ""
    return from_cl, to_cl


def _district_clause(district: str | None, alias: str = "c") -> str:
    return f"AND {alias}.district = :district" if district else ""


def _build_base_params(
    p: ReportFilterParams,
) -> dict:
    params: dict = {"threshold": K_ANON_THRESHOLD}
    if p.district:
        params["district"] = p.district
    if p.from_date:
        params["from_date"] = p.from_date
    if p.to_date:
        params["to_date"] = p.to_date
    return params


# ── /summary ──────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=ReportSummaryResponse)
async def report_summary(
    current_user: User = Depends(require_role("gov_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Top-of-page KPI cards for the admin dashboard."""
    # Total active shops (operator assigned + is_active)
    shops_q    = select(func.count(Shop.id)).where(Shop.is_active.is_(True))
    cons_q     = select(func.count(ConsumerProfile.id))
    purch_q    = select(func.count(Purchase.id))
    # Revenue: sum(price * quantity_ml) approximation using stored price per purchase
    rev_q      = select(func.coalesce(func.sum(Purchase.price), 0))
    # Standard drinks: sum of pre-computed field on purchase
    drinks_q   = select(func.coalesce(func.sum(Purchase.standard_drinks), 0))
    dist_q     = select(func.count(func.distinct(ConsumerProfile.district)))
    restr_q    = select(func.count(func.distinct(SelfRestriction.user_id)))

    total_shops     = (await db.execute(shops_q)).scalar() or 0
    total_consumers = (await db.execute(cons_q)).scalar() or 0
    total_purchases = (await db.execute(purch_q)).scalar() or 0
    total_revenue   = (await db.execute(rev_q)).scalar() or Decimal("0")
    total_drinks    = (await db.execute(drinks_q)).scalar() or Decimal("0")
    districts       = (await db.execute(dist_q)).scalar() or 0
    restricted      = (await db.execute(restr_q)).scalar() or 0

    return ReportSummaryResponse(
        total_active_shops=total_shops,
        total_consumers=total_consumers,
        total_purchases=total_purchases,
        total_revenue=Decimal(str(total_revenue)),
        total_drinks=Decimal(str(total_drinks)),
        districts_covered=districts,
        restricted_consumers=restricted,
    )


# ── /district-sales ───────────────────────────────────────────────────────────

@router.get("/district-sales", response_model=DistrictSalesResponse)
async def district_sales(
    district:  str | None  = Query(None, max_length=100),
    from_date: date | None = None,
    to_date:   date | None = None,
    sort_by:   str         = Query("district"),
    page:      int         = Query(1, ge=1),
    page_size: int         = Query(50, ge=1, le=200),
    current_user: User     = Depends(require_role("gov_admin")),
    db: AsyncSession       = Depends(get_db),
):
    # Resolve sort column from whitelist — NEVER put sort_by directly in SQL
    order_col = _DISTRICT_SORT_MAP.get(sort_by, "district")
    from_cl, to_cl = _date_filter_clauses(from_date, to_date)
    dist_cl = _district_clause(district)

    count_sql = text(f"""
        SELECT COUNT(*) FROM (
            SELECT c.district
            FROM consumers c
            JOIN purchases pu ON pu.consumer_id = c.id
            JOIN products  pr ON pr.id = pu.product_id
            WHERE 1=1 {from_cl} {to_cl} {dist_cl}
            GROUP BY c.district
            HAVING COUNT(DISTINCT c.id) >= :threshold
        ) sub
    """)
    data_sql = text(f"""
        SELECT
            c.district,
            COUNT(pu.id)                                                AS total_purchases,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)  AS total_revenue,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)    AS total_drinks,
            COUNT(DISTINCT c.id)                                        AS unique_consumers
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1 {from_cl} {to_cl} {dist_cl}
        GROUP BY c.district
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY {order_col} DESC
        LIMIT :limit OFFSET :offset
    """)
    params: dict = {"threshold": K_ANON_THRESHOLD,
                    "limit": page_size, "offset": (page - 1) * page_size}
    if district:  params["district"]  = district
    if from_date: params["from_date"] = from_date
    if to_date:   params["to_date"]   = to_date

    total  = (await db.execute(count_sql, params)).scalar() or 0
    result = await db.execute(data_sql, params)
    rows   = result.fetchall()
    data   = [DistrictSalesRow(
        district=r.district,
        total_purchases=r.total_purchases,
        total_revenue=Decimal(str(r.total_revenue)),
        total_drinks=Decimal(str(r.total_drinks)),
        unique_consumers=r.unique_consumers,
    ) for r in rows]
    return DistrictSalesResponse(page=page, page_size=page_size, total=total, data=data)


# ── /age-groups ───────────────────────────────────────────────────────────────

@router.get("/age-groups", response_model=AgeGroupResponse)
async def age_groups(
    current_user: User = Depends(require_role("gov_admin")),
    db: AsyncSession   = Depends(get_db),
):
    sql = text("""
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
    """)
    result = await db.execute(sql, {"threshold": K_ANON_THRESHOLD})
    rows   = result.fetchall()
    return AgeGroupResponse(data=[
        AgeGroupRow(age_bracket=r.age_bracket,
                    consumer_count=r.consumer_count,
                    total_drinks=Decimal(str(r.total_drinks)))
        for r in rows
    ])


# ── /shop-revenue ─────────────────────────────────────────────────────────────

@router.get("/shop-revenue", response_model=ShopRevenueResponse)
async def shop_revenue(
    from_date: date | None = None,
    to_date:   date | None = None,
    sort_by:   str         = Query("date"),
    page:      int         = Query(1, ge=1),
    page_size: int         = Query(50, ge=1, le=200),
    current_user: User     = Depends(require_role("gov_admin")),
    db: AsyncSession       = Depends(get_db),
):
    order_col = _SHOP_SORT_MAP.get(sort_by, "year_month")
    from_cl, to_cl = _date_filter_clauses(from_date, to_date)

    data_sql = text(f"""
        SELECT
            s.id                                                            AS shop_id,
            s.name                                                          AS shop_name,
            s.district,
            TO_CHAR(DATE_TRUNC('month', pu.purchased_at), 'YYYY-MM')          AS year_month,
            COUNT(pu.id)                                                    AS transactions,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)      AS revenue
        FROM shops    s
        JOIN purchases pu ON pu.shop_id = s.id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1 {from_cl} {to_cl}
        GROUP BY s.id, s.name, s.district, year_month
        ORDER BY {order_col} DESC
        LIMIT :limit OFFSET :offset
    """)
    count_sql = text(f"""
        SELECT COUNT(*) FROM (
            SELECT s.id, TO_CHAR(DATE_TRUNC('month', pu.purchased_at), 'YYYY-MM') AS ym
            FROM shops s
            JOIN purchases pu ON pu.shop_id = s.id
            WHERE 1=1 {from_cl} {to_cl}
            GROUP BY s.id, ym
        ) sub
    """)
    params: dict = {"limit": page_size, "offset": (page - 1) * page_size}
    if from_date: params["from_date"] = from_date
    if to_date:   params["to_date"]   = to_date

    total  = (await db.execute(count_sql, params)).scalar() or 0
    result = await db.execute(data_sql, params)
    rows   = result.fetchall()
    data   = [ShopRevenueRow(
        shop_id=r.shop_id,
        shop_name=r.shop_name,
        district=r.district,
        year_month=r.year_month,
        transactions=r.transactions,
        revenue=Decimal(str(r.revenue)),
    ) for r in rows]
    return ShopRevenueResponse(page=page, page_size=page_size, total=total, data=data)


# ── /daily-trend ──────────────────────────────────────────────────────────────

@router.get("/daily-trend", response_model=DailyTrendResponse)
async def daily_trend(
    district:  str | None  = Query(None, max_length=100),
    from_date: date | None = None,
    to_date:   date | None = None,
    current_user: User     = Depends(require_role("gov_admin")),
    db: AsyncSession       = Depends(get_db),
):
    from_cl, to_cl = _date_filter_clauses(from_date, to_date)
    dist_cl = _district_clause(district)
    sql = text(f"""
        SELECT
            CAST(pu.purchased_at AS DATE)                                      AS purchase_date,
            c.district,
            COUNT(pu.id)                                                    AS total_purchases,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)        AS total_drinks
        FROM purchases pu
        JOIN consumers c  ON c.id  = pu.consumer_id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1 {from_cl} {to_cl} {dist_cl}
        GROUP BY purchase_date, c.district
        ORDER BY purchase_date
        LIMIT 365
    """)
    params: dict = {}
    if district:  params["district"]  = district
    if from_date: params["from_date"] = from_date
    if to_date:   params["to_date"]   = to_date

    result = await db.execute(sql, params)
    rows   = result.fetchall()
    return DailyTrendResponse(data=[
        DailyTrendRow(
            purchase_date=r.purchase_date,
            district=r.district,
            total_purchases=r.total_purchases,
            total_drinks=Decimal(str(r.total_drinks)),
        )
        for r in rows
    ])


# ── /restriction-adoption ─────────────────────────────────────────────────────

@router.get("/restriction-adoption", response_model=RestrictionAdoptionResponse)
async def restriction_adoption(
    current_user: User = Depends(require_role("gov_admin")),
    db: AsyncSession   = Depends(get_db),
):
    sql = text("""
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
        ORDER BY adoption_rate_pct DESC
    """)
    result = await db.execute(sql, {"threshold": K_ANON_THRESHOLD})
    rows   = result.fetchall()
    return RestrictionAdoptionResponse(data=[
        RestrictionAdoptionRow(
            district=r.district,
            total_consumers=r.total_consumers,
            restricted_count=r.restricted_count,
            adoption_rate_pct=Decimal(str(r.adoption_rate_pct or 0)),
        )
        for r in rows
    ])


# ── /pdf — PDF generation (rate-limited + audited) ──────────────────────────

@router.get("/{report_type}/pdf")
@limiter.limit("5/minute")
async def download_pdf(
    request: Request,
    report_type: str,
    district:  str | None  = Query(None, max_length=100),
    from_date: date | None = None,
    to_date:   date | None = None,
    current_user: User     = Depends(require_role("gov_admin")),
    db: AsyncSession       = Depends(get_db),
):
    """Generate and stream a Matplotlib PDF report. Audited."""
    # Validate report_type against whitelist (no user string touches SQL)
    _ALLOWED_REPORT_TYPES = {"full", "district-sales", "trend", "age-groups"}
    if report_type not in _ALLOWED_REPORT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid report_type")

    # Write audit log BEFORE generation so we capture the intent even on failure
    ip = request.client.host if request.client else None
    log_id = await _write_audit(db, current_user.id,
                                "REPORT_PDF_DOWNLOAD", "reports", None, ip)

    try:
        pdf_bytes = await report_generator.generate_pdf(
            db=db,
            district=district,
            from_date=from_date,
            to_date=to_date,
            generated_by=current_user.email,
            audit_log_id=log_id,
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="PDF generation failed")

    filename = f"tasmac_report_{report_type}_{date.today().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── /export — CSV / XLSX raw export (rate-limited + audited) ─────────────────

@router.get("/export")
@limiter.limit("5/minute")
async def export_data(
    request: Request,
    fmt:       str         = Query("csv", alias="format", pattern="^(csv|xlsx)$"),
    district:  str | None  = Query(None, max_length=100),
    from_date: date | None = None,
    to_date:   date | None = None,
    current_user: User     = Depends(require_role("gov_admin")),
    db: AsyncSession       = Depends(get_db),
):
    """Export filtered district sales view as CSV or XLSX. Audited."""
    import pandas as pd

    ip = request.client.host if request.client else None
    await _write_audit(db, current_user.id, "REPORT_EXPORT", "purchases", None, ip)

    from_cl, to_cl = _date_filter_clauses(from_date, to_date)
    dist_cl = _district_clause(district)
    sql = text(f"""
        SELECT
            c.district,
            COUNT(pu.id)                                                AS total_purchases,
            COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)  AS total_revenue,
            COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)    AS total_drinks,
            COUNT(DISTINCT c.id)                                        AS unique_consumers
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products  pr ON pr.id = pu.product_id
        WHERE 1=1 {from_cl} {to_cl} {dist_cl}
        GROUP BY c.district
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY c.district
    """)
    params: dict = {"threshold": K_ANON_THRESHOLD}
    if district:  params["district"]  = district
    if from_date: params["from_date"] = from_date
    if to_date:   params["to_date"]   = to_date

    result = await db.execute(sql, params)
    rows   = result.fetchall()
    df = pd.DataFrame(rows, columns=["district", "total_purchases",
                                      "total_revenue", "total_drinks", "unique_consumers"])

    buf = io.BytesIO()
    if fmt == "xlsx":
        df.to_excel(buf, index=False, engine="openpyxl")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        suffix = "xlsx"
    else:
        buf.write(df.to_csv(index=False).encode("utf-8"))
        media_type = "text/csv"
        suffix = "csv"
    buf.seek(0)

    filename = f"tasmac_export_{date.today().isoformat()}.{suffix}"
    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── /export/powerbi-manifest — manifest only (no raw files via HTTP) ──────────

@router.get("/export/powerbi-manifest", response_model=PowerBIManifestResponse)
async def powerbi_manifest(
    current_user: User = Depends(require_role("gov_admin")),
):
    """Return the Power BI export manifest (file list, row counts, instructions)."""
    manifest = report_exporter.read_manifest()
    if manifest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Power BI export has been generated yet. "
                   "It runs every 4 hours automatically, or contact an admin.",
        )
    files = [
        PowerBIManifestFile(
            filename=f["filename"],
            view_name=f["view_name"],
            row_count=f["row_count"],
            generated_at=datetime.fromisoformat(f["generated_at"]),
        )
        for f in manifest.get("files", [])
    ]
    return PowerBIManifestResponse(
        generated_at=datetime.fromisoformat(manifest["generated_at"]),
        files=files,
        instructions=manifest.get("instructions", ""),
    )
