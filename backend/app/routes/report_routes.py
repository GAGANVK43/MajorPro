from fastapi import APIRouter, Depends, Response, status, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.security import get_current_user, get_current_user_with_query_token
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
    """Retrieve a specific prediction report by its ID, ensuring the requesting user owns the report.
    Returns a JSON metadata response with report details.
    """
    # Fetch the prediction (and related assessment) from DB
    prediction_service = PredictionService(db)
    prediction = prediction_service.get_prediction_by_id(id)
    if not prediction:
        return Response(
            content=b"Report not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="text/plain",
        )
    # Ensure the prediction belongs to the authenticated user
    if prediction.assessment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested health report",
        )
    # Return minimal metadata (could be expanded)
    return success_response(
        data={
            "prediction_id": prediction.id,
            "assessment_id": prediction.assessment.id,
            "created_at": prediction.created_at.isoformat() if prediction.created_at else None,
        },
        message="Report metadata retrieved successfully",
    )


@router.get("/latest/pdf", status_code=status.HTTP_200_OK)
def download_latest_pdf_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate and stream downloadable PDF health risk report for user's latest assessment.
    """
    pred_service = PredictionService(db)
    latest_pred = pred_service.get_latest_prediction(current_user)
    if not latest_pred:
        return Response(
            content=b"No health assessment found. Please complete an assessment first.",
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="text/plain",
        )
    pred_id = latest_pred["id"] if isinstance(latest_pred, dict) else getattr(latest_pred, "id", 1)
    service = ReportService(db)
    pdf_bytes = service.generate_pdf_report(current_user, pred_id)
    headers = {
        "Content-Disposition": f"attachment; filename=DiaSense_Health_Report_{pred_id}.pdf"
    }
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers=headers,
    )


@router.get("/{id}/pdf")
def download_pdf_report(
    id: int,
    current_user: User = Depends(get_current_user_with_query_token),
    db: Session = Depends(get_db),
):
    """
    Generate and stream downloadable PDF health risk report.
    Supports Authorization Bearer header or ?token= query parameter.
    Enforces strict IDOR protection (user ownership verification).
    """
    if id <= 0:
        return download_latest_pdf_report(current_user=current_user, db=db)

    pred_service = PredictionService(db)
    prediction = pred_service.get_prediction_by_id(id)
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    if not prediction.assessment or prediction.assessment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested health report",
        )

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
