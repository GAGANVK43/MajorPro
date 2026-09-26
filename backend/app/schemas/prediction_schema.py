"""
Prediction Schema v2 — India Diabetes Dataset fields.
PredictionRequest now uses the new feature set.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """
    Request body for POST /api/prediction.
    All fields match the India Diabetes Patient Dataset features.
    Fields are Optional so the pipeline's imputers can handle missing values.
    """
    # Optional reference to existing assessment record
    assessment_id: Optional[int] = Field(None, example=1)

    # Demographic
    patient_group: Optional[str] = Field(None, example="Urban",
        description="Urban / Semi-Urban / Rural")
    age: Optional[float] = Field(None, ge=1.0, le=110.0, example=42.0)
    gender: Optional[str] = Field(None, example="Male")

    # Physical
    bmi: Optional[float] = Field(None, ge=10.0, le=70.0, example=27.5)
    blood_pressure: Optional[float] = Field(None, ge=60.0, le=220.0, example=130.0,
        description="Systolic blood pressure (mmHg)")

    # Lifestyle
    physical_activity_hours: Optional[float] = Field(None, ge=0.0, le=20.0, example=3.5)
    daily_sugar_intake: Optional[float] = Field(None, ge=0.0, le=200.0, example=55.0,
        description="Daily sugar intake in grams")
    fast_food_frequency: Optional[float] = Field(None, ge=0.0, le=15.0, example=2.0,
        description="Fast food meals per week")
    sleep_hours: Optional[float] = Field(None, ge=2.0, le=14.0, example=7.0)

    # Labs
    hba1c: Optional[float] = Field(None, ge=3.0, le=20.0, example=5.9)
    fasting_glucose: Optional[float] = Field(None, ge=50.0, le=450.0, example=108.0,
        description="Fasting blood glucose (mg/dL)")

    # Genetic / Social
    family_history: Optional[float] = Field(None, ge=0.0, le=1.0, example=0.0,
        description="1 = family history of diabetes, 0 = no family history")
    monthly_income: Optional[float] = Field(None, ge=0.0, le=200000.0, example=35000.0,
        description="Monthly household income (INR)")
    month: Optional[float] = Field(None, ge=1.0, le=12.0, example=6.0,
        description="Month of assessment (1=Jan, 12=Dec)")


class PredictionResponse(BaseModel):
    id: Optional[int] = None
    assessment_id: Optional[int] = None
    prediction: str   # "Higher Risk Pattern" or "Lower Risk Pattern"
    risk_percentage: float
    confidence: float
    recommendation: Optional[str] = (
        "This is a health awareness screening result. "
        "Please consult a qualified healthcare professional for clinical guidance."
    )
    contributing_factors: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PredictionListResponse(BaseModel):
    total: int
    predictions: List[PredictionResponse]
