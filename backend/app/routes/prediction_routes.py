from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.security import get_current_user, get_optional_current_user
from app.models.user import User
from app.schemas.prediction_schema import PredictionRequest
from app.services.prediction_service import PredictionService
from app.utils.response import success_response

router = APIRouter(prefix="/api/prediction", tags=["Prediction"])


@router.post("", status_code=status.HTTP_200_OK)
def create_prediction(
    request: PredictionRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Execute ML prediction pipeline on assessment data and return risk analysis.
    Supports authenticated users and guest submissions.
    """
    service = PredictionService(db)
    result = service.create_prediction(current_user, request)
    return success_response(
        data=result,
        message="ML Diabetes Risk Prediction generated successfully",
    )


@router.get("/latest", status_code=status.HTTP_200_OK)
def get_latest_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve latest prediction record for authenticated user.
    """
    service = PredictionService(db)
    result = service.get_latest_prediction(current_user)
    return success_response(
        data=result,
        message="Latest prediction retrieved successfully",
    )


@router.get("/accuracy", status_code=status.HTTP_200_OK)
def get_model_accuracy():
    """
    Retrieve prediction model accuracy score and evaluation metrics.
    """
    from app.ml.prediction import get_model_metrics
    metrics = get_model_metrics()
    return success_response(
        data=metrics,
        message=f"Model accuracy score: {metrics.get('accuracy_percentage', 'N/A')}",
    )


@router.get("/history", status_code=status.HTTP_200_OK)
def get_prediction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve prediction history for authenticated user.
    """
    service = PredictionService(db)
    result = service.get_prediction_history(current_user)
    return success_response(
        data=result,
        message="Prediction history retrieved successfully",
    )
