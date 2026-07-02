"""Consumer PDF report download endpoint."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.pdf_service import generate_pdf

router = APIRouter(prefix="/pdf", tags=["Consumer - PDF"])


@router.get("/report")
def download_pdf_report(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
):
    """Stream a PDF consumption report for the given date range."""
    pdf_buffer = generate_pdf(current_user, start_date, end_date, db)
    filename = f"tasmac_report_{start_date}_{end_date}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
