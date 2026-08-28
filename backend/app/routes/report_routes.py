from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.security import get_current_user
from app.models.user import User
from app.services.report_service import ReportService
from app.services.prediction_service import PredictionService
from app.utils.response import success_response

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/{id}", status_code=status.HTTP_200_OK)
def get_report_by_id(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve prediction report details by ID with IDOR validation.
    """
    service = PredictionService(db)
    result = service.get_latest_prediction(current_user)
    return success_response(
        data=result,
        message="Report details retrieved successfully",
    )


@router.get("/{id}/pdf")
def download_pdf_report(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate and stream downloadable PDF health risk report.
    """
    service = ReportService(db)
    pdf_bytes = service.generate_pdf_report(current_user, id)
    
    headers = {
        "Content-Disposition": f"attachment; filename=DiaSense_Health_Report_{id}.pdf"
    }
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers=headers,
    )
