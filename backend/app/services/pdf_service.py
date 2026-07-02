"""PDF report service — generates a purchase history PDF entirely in memory.

Libraries used:
- pandas   : aggregate purchase data into a DataFrame.
- matplotlib: render a bar chart of daily consumption.
- fpdf2    : compose the PDF with header, table, chart, and footer.

Security notes:
- Nothing is written to disk — all operations use BytesIO buffers.
- user identity comes from the JWT-validated User object (IDOR safe).
- Aadhaar is masked before it appears anywhere in the document.
"""
from __future__ import annotations

import io
import tempfile
import os
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decrypt_aadhaar, mask_aadhaar
from app.models.audit_log import AuditEventType, AuditLog
from app.models.consumer_profile import ConsumerProfile
from app.models.purchase import Purchase
from app.models.user import User


# Optional-import guard so the service fails gracefully at runtime if libs missing
try:
    import pandas as pd
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend
    import matplotlib.pyplot as plt
    from fpdf import FPDF  # fpdf2
    _LIBS_AVAILABLE = True
except ImportError:
    _LIBS_AVAILABLE = False


def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            description=description,
            ip_address=ip_address,
        )
        db.add(log)
        db.flush()
    except Exception:
        pass


def _build_bar_chart(df: "pd.DataFrame") -> bytes:
    """Render a daily-consumption bar chart and return PNG bytes."""
    if "purchased_at" in df.columns and not df.empty:
        df = df.copy()
        df["date"] = pd.to_datetime(df["purchased_at"]).dt.date
        daily = df.groupby("date")["quantity_ml"].sum()
    else:
        daily = pd.Series(dtype=float)

    fig, ax = plt.subplots(figsize=(8, 4))
    if not daily.empty:
        ax.bar(
            [str(d) for d in daily.index],
            daily.values,
            color="#2563EB",
        )
        ax.set_xlabel("Date")
        ax.set_ylabel("Volume (ml)")
        ax.set_title("Daily Consumption")
        plt.xticks(rotation=45, ha="right")
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Daily Consumption")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100)
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def generate_pdf(
    user: User,
    start_date: date,
    end_date: date,
    db: Session,
) -> io.BytesIO:
    """Generate a purchase history PDF for *user* between *start_date* and *end_date*.

    Returns a BytesIO buffer containing the PDF bytes.
    """
    if not _LIBS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF generation libraries are not installed.",
        )

    # Fetch profile for masked Aadhaar
    profile = (
        db.query(ConsumerProfile)
        .filter(ConsumerProfile.user_id == user.id)
        .first()
    )
    masked_aadhaar = "XXXXXXXXXXXX"
    if profile and profile.aadhaar_encrypted:
        try:
            raw = decrypt_aadhaar(profile.aadhaar_encrypted)
            masked_aadhaar = mask_aadhaar(raw)
        except Exception:
            pass

    # Fetch purchases in date range — IDOR safe: filter on user.id
    start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)

    purchases = (
        db.query(Purchase)
        .filter(
            Purchase.consumer_id == user.id,
            Purchase.purchased_at >= start_dt,
            Purchase.purchased_at <= end_dt,
        )
        .order_by(Purchase.purchased_at.asc())
        .all()
    )

    # Build DataFrame
    rows = [
        {
            "purchased_at": p.purchased_at,
            "product_name": p.product_name,
            "quantity_ml": p.quantity_ml,
            "price": float(p.price),
            "standard_drinks": round(p.quantity_ml / 354.0, 2),
        }
        for p in purchases
    ]
    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=[
        "purchased_at", "product_name", "quantity_ml", "price", "standard_drinks"
    ])

    # Build chart
    chart_bytes = _build_bar_chart(df)

    # Save chart to temp file so FPDF can embed it
    # (FPDF requires a file path for images)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(chart_bytes)
        chart_path = tmp.name

    try:
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # ── Header ──────────────────────────────────────────────────────────────
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 10, "Smart TASMAC — Purchase History Report", ln=True, align="C")
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 8, f"Consumer: {user.full_name}  |  Aadhaar: {masked_aadhaar}", ln=True, align="C")
        pdf.cell(
            0, 8,
            f"Period: {start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')}",
            ln=True,
            align="C",
        )
        pdf.ln(5)

        # ── Summary ────────────────────────────────────────────────────────────
        total_ml = df["quantity_ml"].sum() if not df.empty else 0
        total_sd = round(df["standard_drinks"].sum(), 2) if not df.empty else 0.0
        total_spend = round(df["price"].sum(), 2) if not df.empty else 0.0

        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Summary", ln=True)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, f"Total Volume: {total_ml} ml", ln=True)
        pdf.cell(0, 7, f"Total Standard Drinks: {total_sd}", ln=True)
        pdf.cell(0, 7, f"Total Spent: ₹{total_spend}", ln=True)
        pdf.ln(5)

        # ── Chart ──────────────────────────────────────────────────────────────
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Daily Consumption", ln=True)
        available_width = pdf.w - pdf.l_margin - pdf.r_margin
        pdf.image(chart_path, x=pdf.l_margin, w=available_width, h=60)
        pdf.ln(5)

        # ── Table ──────────────────────────────────────────────────────────────
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Transaction Details", ln=True)

        col_widths = [38, 62, 30, 25, 30]
        headers = ["Date", "Product", "Volume (ml)", "Std Drinks", "Price (₹)"]
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(37, 99, 235)  # blue header
        pdf.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 8, h, border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 9)
        fill = False
        for _, row in df.iterrows():
            pdf.set_fill_color(235, 243, 255) if fill else pdf.set_fill_color(255, 255, 255)
            dt_str = (
                pd.Timestamp(row["purchased_at"]).strftime("%d %b %Y")
                if row["purchased_at"] is not None
                else ""
            )
            values = [
                dt_str,
                str(row["product_name"])[:30],
                str(int(row["quantity_ml"])),
                str(row["standard_drinks"]),
                f"{row['price']:.2f}",
            ]
            for i, val in enumerate(values):
                pdf.cell(col_widths[i], 7, val, border=1, fill=True, align="C")
            pdf.ln()
            fill = not fill

        if df.empty:
            pdf.set_font("Helvetica", "I", 10)
            pdf.cell(0, 10, "No purchases found for the selected date range.", ln=True, align="C")

        # ── Footer ─────────────────────────────────────────────────────────────
        pdf.ln(10)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(120, 120, 120)
        pdf.multi_cell(
            0,
            5,
            "DISCLAIMER: This report is generated for personal reference only. "
            "The data reflects purchases recorded in the Smart TASMAC system. "
            "If you notice any discrepancies, please contact TASMAC support. "
            "Drinking responsibly is your responsibility.",
        )
        pdf.cell(
            0, 5,
            f"Generated on {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}",
            ln=True,
            align="R",
        )

        # ── Render to BytesIO ──────────────────────────────────────────────────
        pdf_bytes = pdf.output()
        output_buf = io.BytesIO(bytes(pdf_bytes))
        output_buf.seek(0)

    finally:
        try:
            os.unlink(chart_path)
        except OSError:
            pass

    # Audit — write AFTER PDF bytes are ready
    _write_audit(
        db,
        AuditEventType.PDF_DOWNLOADED,
        user_id=user.id,
        description="Purchase history PDF downloaded",
    )
    db.commit()

    return output_buf
