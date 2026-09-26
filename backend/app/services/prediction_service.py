"""
Prediction Service v2 — India Diabetes Dataset
Uses the new v2 pipeline (diabetes_pipeline_v2.pkl) and new assessment schema.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.assessment import Assessment
from app.models.prediction import Prediction
from app.models.diet_plan import DietPlan
from app.repositories.assessment_repository import AssessmentRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.diet_repository import DietRepository
from app.schemas.prediction_schema import PredictionRequest, PredictionResponse, PredictionListResponse
from app.ml.prediction_v2 import predict_diabetes_risk
from app.utils.i18n import localize_recommendation, localize_diet_plan, normalize_lang


def _build_assessment_data(request) -> dict:
    """Map PredictionRequest (new schema) to the dict expected by prediction_v2."""
    return {
        "patient_group":            getattr(request, "patient_group", None),
        "age":                      getattr(request, "age", None),
        "gender":                   getattr(request, "gender", None),
        "bmi":                      getattr(request, "bmi", None),
        "blood_pressure":           getattr(request, "blood_pressure", None),
        "physical_activity_hours":  getattr(request, "physical_activity_hours", None),
        "daily_sugar_intake":       getattr(request, "daily_sugar_intake", None),
        "fast_food_frequency":      getattr(request, "fast_food_frequency", None),
        "sleep_hours":              getattr(request, "sleep_hours", None),
        "hba1c":                    getattr(request, "hba1c", None),
        "fasting_glucose":          getattr(request, "fasting_glucose", None),
        "family_history":           getattr(request, "family_history", None),
        "monthly_income":           getattr(request, "monthly_income", None),
        "month":                    getattr(request, "month", None),
    }


def _assessment_obj_to_data(assessment: Assessment) -> dict:
    """Extract assessment ORM object fields into a data dict for inference."""
    return {
        "patient_group":            assessment.patient_group,
        "age":                      assessment.age,
        "gender":                   assessment.gender,
        "bmi":                      assessment.bmi,
        "blood_pressure":           assessment.blood_pressure,
        "physical_activity_hours":  assessment.physical_activity_hours,
        "daily_sugar_intake":       assessment.daily_sugar_intake,
        "fast_food_frequency":      assessment.fast_food_frequency,
        "sleep_hours":              assessment.sleep_hours,
        "hba1c":                    assessment.hba1c,
        "fasting_glucose":          assessment.fasting_glucose,
        "family_history":           assessment.family_history,
        "monthly_income":           assessment.monthly_income,
        "month":                    assessment.month,
    }


class PredictionService:
    """
    Business Logic Layer for DiaSense AI v2 Risk Screening.
    Uses India Diabetes Patient Dataset pipeline.
    IMPORTANT: Output is a risk screening result, NOT a clinical diagnosis.
    """

    def __init__(self, db: Session):
        self.db = db
        self.assessment_repo = AssessmentRepository(db)
        self.prediction_repo = PredictionRepository(db)
        self.diet_repo = DietRepository(db)

    def create_prediction(self, user: Optional[User], request: PredictionRequest, lang: str = "en") -> PredictionResponse:

        # ── Guest (unauthenticated) path ─────────────────────────────────────
        if user is None:
            assessment_data = _build_assessment_data(request)
            pred_label, risk_pct, confidence, recommendation, contributing_factors = \
                predict_diabetes_risk(assessment_data, lang)

            return PredictionResponse(
                id=0,
                assessment_id=0,
                prediction=pred_label,
                risk_percentage=risk_pct,
                confidence=confidence,
                recommendation=recommendation,
                contributing_factors=contributing_factors,
                created_at=datetime.utcnow(),
            )

        # ── Authenticated path ───────────────────────────────────────────────
        # Step 1: Resolve or create Assessment
        assessment = None
        if getattr(request, "assessment_id", None):
            assessment = self.assessment_repo.get_by_id(request.assessment_id)
            if assessment and assessment.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to requested assessment record",
                )

        if not assessment:
            # Persist new assessment with v2 fields
            assessment = Assessment(
                user_id=user.id,
                patient_group=getattr(request, "patient_group", None),
                age=getattr(request, "age", user.age or 30),
                gender=getattr(request, "gender", user.gender or None),
                bmi=getattr(request, "bmi", 25.0),
                blood_pressure=getattr(request, "blood_pressure", None),
                physical_activity_hours=getattr(request, "physical_activity_hours", None),
                daily_sugar_intake=getattr(request, "daily_sugar_intake", None),
                fast_food_frequency=getattr(request, "fast_food_frequency", None),
                sleep_hours=getattr(request, "sleep_hours", None),
                hba1c=getattr(request, "hba1c", None),
                fasting_glucose=getattr(request, "fasting_glucose", None),
                family_history=getattr(request, "family_history", None),
                monthly_income=getattr(request, "monthly_income", None),
                month=getattr(request, "month", None),
            )
            assessment = self.assessment_repo.create(assessment)

        # Step 2: Run ML inference with v2 pipeline
        assessment_data = _assessment_obj_to_data(assessment)
        pred_label, risk_pct, confidence, recommendation, contributing_factors = \
            predict_diabetes_risk(assessment_data, lang)

        # Step 3: Save Prediction entity
        prediction_obj = Prediction(
            assessment_id=assessment.id,
            prediction=pred_label,
            risk_percentage=risk_pct,
            confidence=confidence,
        )
        saved_prediction = self.prediction_repo.create(prediction_obj)

        # Step 4: Generate diet plan (use fasting_glucose or fallback)
        glucose_for_diet = assessment.fasting_glucose or 108.0
        self._generate_and_save_diet_plan(
            saved_prediction.id, pred_label, risk_pct, glucose_for_diet, assessment.bmi
        )

        return PredictionResponse(
            id=saved_prediction.id,
            assessment_id=assessment.id,
            prediction=pred_label,
            risk_percentage=risk_pct,
            confidence=confidence,
            recommendation=recommendation,
            contributing_factors=contributing_factors,
            created_at=saved_prediction.created_at,
        )

    def get_latest_prediction(self, user: User, lang: str = "en") -> PredictionResponse:
        latest = self.prediction_repo.get_latest_by_user_id(user.id)
        if not latest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No prediction records found for user",
            )

        assessment_data = {}
        if latest.assessment:
            assessment_data = _assessment_obj_to_data(latest.assessment)

        # Re-generate contributing factors from saved assessment data
        from app.ml.prediction_v2 import analyze_contributing_factors
        contributing_factors = analyze_contributing_factors(assessment_data)
        recommendation = localize_recommendation(latest.prediction, lang)

        return PredictionResponse(
            id=latest.id,
            assessment_id=latest.assessment_id,
            prediction=latest.prediction,
            risk_percentage=latest.risk_percentage,
            confidence=latest.confidence,
            recommendation=recommendation,
            contributing_factors=contributing_factors,
            created_at=latest.created_at,
        )

    def get_prediction_history(self, user: User, lang: str = "en") -> PredictionListResponse:
        predictions = self.prediction_repo.get_history_by_user_id(user.id)
        items = []
        for p in predictions:
            item = PredictionResponse.model_validate(p)
            item.recommendation = localize_recommendation(p.prediction, lang)
            items.append(item)
        return PredictionListResponse(total=len(items), predictions=items)

    def _generate_and_save_diet_plan(
        self, prediction_id: int, label: str, risk_pct: float,
        glucose: float, bmi: float
    ) -> DietPlan:
        # "Higher Risk Pattern" maps to high-risk diet
        plan_type = "HighRisk" if (
            "Higher" in label or risk_pct >= 50.0 or glucose >= 126.0
        ) else "LowRisk"
        localized_en = localize_diet_plan(plan_type, "en")

        diet_plan = DietPlan(
            prediction_id=prediction_id,
            breakfast=localized_en["breakfast"],
            lunch=localized_en["lunch"],
            dinner=localized_en["dinner"],
            snacks=localized_en["snacks"],
            exercise=localized_en["exercise"],
            tips=localized_en["tips"],
        )
        return self.diet_repo.create(diet_plan)
