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
from app.ml.prediction import predict_diabetes_risk


class PredictionService:
    """
    Business Logic Layer for Indian Diabetes ML Risk Prediction and Tailored Indian Diet Plan Generation.
    """
    def __init__(self, db: Session):
        self.db = db
        self.assessment_repo = AssessmentRepository(db)
        self.prediction_repo = PredictionRepository(db)
        self.diet_repo = DietRepository(db)

    def _extract_assessment_dict(self, obj) -> dict:
        return {
            "patient_group": getattr(obj, "patient_group", "Urban") or "Urban",
            "gender": getattr(obj, "gender", "Male") or "Male",
            "age": getattr(obj, "age", 35) or 35,
            "bmi": getattr(obj, "bmi", 24.5) or 24.5,
            "physical_activity_hours": getattr(obj, "physical_activity_hours", 2.0) or 2.0,
            "daily_sugar_intake": getattr(obj, "daily_sugar_intake", 30.0) or 30.0,
            "fast_food_frequency": getattr(obj, "fast_food_frequency", 2.0) or 2.0,
            "sleep_hours": getattr(obj, "sleep_hours", 7.0) or 7.0,
            "family_history": getattr(obj, "family_history", 0.0) or 0.0,
            "blood_pressure": getattr(obj, "blood_pressure", 120.0) or 120.0,
            "hba1c": getattr(obj, "hba1c", 5.7) or 5.7,
            "fasting_glucose": getattr(obj, "fasting_glucose", None) or getattr(obj, "glucose", 100.0) or 100.0,
            "monthly_income": getattr(obj, "monthly_income", 35000.0) or 35000.0,
            "month": getattr(obj, "month", 6.0) or 6.0,
        }

    def create_prediction(self, user: Optional[User], request: PredictionRequest) -> PredictionResponse:
        assessment_dict = self._extract_assessment_dict(request)

        # Handle Guest (Unauthenticated) Assessment Submissions
        if user is None:
            pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(assessment_dict)
            return PredictionResponse(
                id=1,
                assessment_id=1,
                prediction=pred_label,
                risk_percentage=risk_pct,
                confidence=confidence,
                recommendation=recommendation,
                contributing_factors=contributing_factors,
                created_at=datetime.utcnow(),
            )

        # Step 1: Resolve Assessment Record for Authenticated User
        assessment = None
        if request.assessment_id:
            assessment = self.assessment_repo.get_by_id(request.assessment_id)
            if assessment and assessment.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to requested assessment record",
                )

        if not assessment:
            # Auto-create assessment record
            assessment = Assessment(
                user_id=user.id,
                patient_group=assessment_dict["patient_group"],
                gender=assessment_dict["gender"] or user.gender or "Male",
                age=assessment_dict["age"] or user.age or 35,
                bmi=assessment_dict["bmi"],
                blood_pressure=assessment_dict["blood_pressure"],
                hba1c=assessment_dict["hba1c"],
                fasting_glucose=assessment_dict["fasting_glucose"],
                physical_activity_hours=assessment_dict["physical_activity_hours"],
                daily_sugar_intake=assessment_dict["daily_sugar_intake"],
                fast_food_frequency=assessment_dict["fast_food_frequency"],
                sleep_hours=assessment_dict["sleep_hours"],
                family_history=assessment_dict["family_history"],
                monthly_income=assessment_dict["monthly_income"],
                month=assessment_dict["month"],
                # Legacy fields mapping
                glucose=assessment_dict["fasting_glucose"],
                pregnancies=getattr(request, "pregnancies", 0) or 0,
                skin_thickness=getattr(request, "skin_thickness", 20.0) or 20.0,
                insulin=getattr(request, "insulin", 80.0) or 80.0,
                diabetes_pedigree_function=getattr(request, "diabetes_pedigree_function", 0.45) or 0.45,
            )
            assessment = self.assessment_repo.create(assessment)

        # Step 2: Run ML inference
        pred_dict = self._extract_assessment_dict(assessment)
        pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(pred_dict)

        # Step 3: Save Prediction entity
        prediction_obj = Prediction(
            assessment_id=assessment.id,
            prediction=pred_label,
            risk_percentage=risk_pct,
            confidence=confidence,
        )
        saved_prediction = self.prediction_repo.create(prediction_obj)

        # Step 4: Automatically generate & store Tailored Indian Diet Plan
        self._generate_and_save_diet_plan(
            saved_prediction.id,
            pred_label,
            risk_pct,
            assessment_dict["fasting_glucose"],
            assessment_dict["hba1c"],
            assessment_dict["bmi"]
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

    def get_latest_prediction(self, user: User) -> PredictionResponse:
        latest = self.prediction_repo.get_latest_by_user_id(user.id)
        if not latest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No prediction records found for user",
            )
        
        assessment_dict = {}
        if latest.assessment:
            assessment_dict = self._extract_assessment_dict(latest.assessment)

        pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(assessment_dict)

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

    def get_prediction_history(self, user: User) -> PredictionListResponse:
        predictions = self.prediction_repo.get_history_by_user_id(user.id)
        items = []
        for p in predictions:
            item = PredictionResponse.model_validate(p)
            item.recommendation = "Follow medical lifestyle recommendations provided."
            items.append(item)
        return PredictionListResponse(total=len(items), predictions=items)

    def _generate_and_save_diet_plan(self, prediction_id: int, label: str, risk_pct: float, glucose: float, hba1c: float, bmi: float) -> DietPlan:
        if label == "Diabetic" or risk_pct >= 45.0 or glucose >= 126.0 or hba1c >= 6.5:
            breakfast = "Oats & Ragi Dosa (2 pcs) with Mint Chutney, 1 Boiled Egg / Paneer Bhurji (Low-GI Indian Breakfast)."
            lunch = "Moong Dal & Spinach Khichdi with 1 cup Cucumber Raita and Sprouted Chana Salad."
            dinner = "Palak Paneer with 2 Bajra/Multigrain Rotis and Steamed Lauki/Turai Subzi."
            snacks = "1 cup Roasted Makhana (Fox Nuts) with Green Tea or Sprouted Moong Salad."
            exercise = "30-45 mins Brisk Walking, 15 mins Surya Namaskar & Light Resistance Training 5 days/week."
            tips = "Limit polished white rice, replace with Brown Rice/Ragi/Bajra. Drink 3L water daily and eliminate sugary chai."
        else:
            breakfast = "Methi Paratha (1 pc with curd) or Vegetable Oats Upma with 1 Boiled Egg."
            lunch = "Brown Rice Bowl with Rajma/Chole, Mixed Green Salad, and Cucumber Raita."
            dinner = "Tandoori Chicken / Paneer Tikka with Grilled Vegetables and 1 Whole Wheat Roti."
            snacks = "Roasted Chana, Apple Slices with Peanut Butter, or Handful of Almonds & Walnuts."
            exercise = "150 minutes of moderate-intensity activity (Brisk Walk, Jogging, Yoga) per week."
            tips = "Maintain consistent sleep schedule, practice stress management through Pranayama, and maintain balanced portion control."

        diet_plan = DietPlan(
            prediction_id=prediction_id,
            breakfast=breakfast,
            lunch=lunch,
            dinner=dinner,
            snacks=snacks,
            exercise=exercise,
            tips=tips,
        )
        return self.diet_repo.create(diet_plan)
