from typing import Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.assessment import Assessment
from app.models.prediction import Prediction
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.diet_repository import DietRepository
from app.utils.i18n import localize_diet_plan, normalize_lang


class DietService:
    """
    Business Logic Layer for Personalized Nutrition & Diet Plan Retrieval with multilingual support.
    """
    def __init__(self, db: Session):
        self.db = db
        self.prediction_repo = PredictionRepository(db)
        self.diet_repo = DietRepository(db)

    def get_latest_diet_plan(self, user: User, lang: str = "en") -> Dict[str, Any]:
        latest_pred = self.prediction_repo.get_latest_by_user_id(user.id)
        if not latest_pred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No prediction records found for user to generate diet plan",
            )

        diet_obj = self.diet_repo.get_by_prediction_id(latest_pred.id)
        localized_plan = localize_diet_plan(latest_pred.prediction, lang)

        assessment = latest_pred.assessment
        glucose_val = assessment.fasting_glucose if assessment else 110.0
        bmi_val = assessment.bmi if assessment else 23.5

        return {
            "id": diet_obj.id if diet_obj else 0,
            "prediction_id": latest_pred.id,
            "assessment_id": latest_pred.assessment_id,
            "prediction_label": latest_pred.prediction,
            "risk_percentage": latest_pred.risk_percentage,
            "glucose": glucose_val,
            "bmi": bmi_val,
            "breakfast": localized_plan["breakfast"],
            "lunch": localized_plan["lunch"],
            "dinner": localized_plan["dinner"],
            "snacks": localized_plan["snacks"],
            "exercise": localized_plan["exercise"],
            "tips": localized_plan["tips"],
        }

    def get_diet_plan_by_prediction_id(self, user: User, prediction_id: int, lang: str = "en") -> Dict[str, Any]:
        prediction = self.prediction_repo.get_by_id(prediction_id)
        if not prediction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prediction record not found",
            )

        # Enforce server-side authorization: user can only view their own prediction diet plan
        if prediction.assessment and prediction.assessment.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested prediction record and diet plan",
            )

        diet_obj = self.diet_repo.get_by_prediction_id(prediction_id)
        localized_plan = localize_diet_plan(prediction.prediction, lang)

        assessment = prediction.assessment
        glucose_val = assessment.fasting_glucose if assessment else 110.0
        bmi_val = assessment.bmi if assessment else 23.5

        return {
            "id": diet_obj.id if diet_obj else 0,
            "prediction_id": prediction.id,
            "assessment_id": prediction.assessment_id,
            "prediction_label": prediction.prediction,
            "risk_percentage": prediction.risk_percentage,
            "glucose": glucose_val,
            "bmi": bmi_val,
            "breakfast": localized_plan["breakfast"],
            "lunch": localized_plan["lunch"],
            "dinner": localized_plan["dinner"],
            "snacks": localized_plan["snacks"],
            "exercise": localized_plan["exercise"],
            "tips": localized_plan["tips"],
        }

    def get_diet_plan_by_assessment_id(self, user: User, assessment_id: int, lang: str = "en") -> Dict[str, Any]:
        assessment = self.db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment record not found",
            )

        # Enforce server-side authorization: user can only view their own assessment diet plan
        if assessment.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested assessment and diet plan",
            )

        prediction = (
            self.db.query(Prediction)
            .filter(Prediction.assessment_id == assessment_id)
            .order_by(Prediction.created_at.desc())
            .first()
        )
        if not prediction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prediction record not found for this assessment",
            )

        diet_obj = self.diet_repo.get_by_prediction_id(prediction.id)
        localized_plan = localize_diet_plan(prediction.prediction, lang)

        glucose_val = (
            assessment.fasting_glucose
            if (assessment.fasting_glucose is not None and assessment.fasting_glucose != 100.0)
            else (assessment.glucose if assessment.glucose is not None else 100.0)
        )

        return {
            "id": diet_obj.id if diet_obj else 0,
            "prediction_id": prediction.id,
            "assessment_id": assessment.id,
            "prediction_label": prediction.prediction,
            "risk_percentage": prediction.risk_percentage,
            "glucose": glucose_val,
            "bmi": assessment.bmi,
            "breakfast": localized_plan["breakfast"],
            "lunch": localized_plan["lunch"],
            "dinner": localized_plan["dinner"],
            "snacks": localized_plan["snacks"],
            "exercise": localized_plan["exercise"],
            "tips": localized_plan["tips"],
        }
