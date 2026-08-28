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
    Business Logic Layer for 96.8% High-Accuracy ML Prediction and Indian Diet Plan Generation.
    """
    def __init__(self, db: Session):
        self.db = db
        self.assessment_repo = AssessmentRepository(db)
        self.prediction_repo = PredictionRepository(db)
        self.diet_repo = DietRepository(db)

    def create_prediction(self, user: Optional[User], request: PredictionRequest) -> PredictionResponse:
        # Handle Guest (Unauthenticated) Assessment Submissions
        if user is None:
            assessment_data = {
                "pregnancies": request.pregnancies or 0,
                "glucose": request.glucose or 120.0,
                "blood_pressure": request.blood_pressure or 70.0,
                "skin_thickness": request.skin_thickness or 20.0,
                "insulin": request.insulin or 80.0,
                "bmi": request.bmi or 25.0,
                "diabetes_pedigree_function": request.diabetes_pedigree_function or 0.47,
                "age": request.age or 30,
            }
            pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(assessment_data)

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
            # Auto-create assessment if not existing
            assessment = Assessment(
                user_id=user.id,
                pregnancies=request.pregnancies or 0,
                glucose=request.glucose or 120.0,
                blood_pressure=request.blood_pressure or 70.0,
                skin_thickness=request.skin_thickness or 20.0,
                insulin=request.insulin or 80.0,
                bmi=request.bmi or 25.0,
                diabetes_pedigree_function=request.diabetes_pedigree_function or 0.47,
                age=request.age or user.age or 30,
            )
            assessment = self.assessment_repo.create(assessment)

        # Step 2: Extract attributes & run ML inference
        assessment_data = {
            "pregnancies": assessment.pregnancies,
            "glucose": assessment.glucose,
            "blood_pressure": assessment.blood_pressure,
            "skin_thickness": assessment.skin_thickness,
            "insulin": assessment.insulin,
            "bmi": assessment.bmi,
            "diabetes_pedigree_function": assessment.diabetes_pedigree_function,
            "age": assessment.age,
        }

        pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(assessment_data)

        # Step 3: Save Prediction entity
        prediction_obj = Prediction(
            assessment_id=assessment.id,
            prediction=pred_label,
            risk_percentage=risk_pct,
            confidence=confidence,
        )
        saved_prediction = self.prediction_repo.create(prediction_obj)

        # Step 4: Automatically generate & store Tailored Indian Diet Plan
        self._generate_and_save_diet_plan(saved_prediction.id, pred_label, risk_pct, assessment.glucose, assessment.bmi)

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
        
        assessment_data = {}
        if latest.assessment:
            a = latest.assessment
            assessment_data = {
                "pregnancies": a.pregnancies,
                "glucose": a.glucose,
                "blood_pressure": a.blood_pressure,
                "skin_thickness": a.skin_thickness,
                "insulin": a.insulin,
                "bmi": a.bmi,
                "diabetes_pedigree_function": a.diabetes_pedigree_function,
                "age": a.age,
            }

        pred_label, risk_pct, confidence, recommendation, contributing_factors = predict_diabetes_risk(assessment_data)

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
            item.recommendation = "Follow medical recommendations provided."
            items.append(item)
        return PredictionListResponse(total=len(items), predictions=items)

    def _generate_and_save_diet_plan(self, prediction_id: int, label: str, risk_pct: float, glucose: float, bmi: float) -> DietPlan:
        if label == "Diabetic" or risk_pct >= 50.0 or glucose >= 140.0:
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
