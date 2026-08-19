from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    assessment_id: Optional[int] = Field(None, example=1)
    pregnancies: Optional[int] = Field(0, ge=0, le=20, example=2)
    glucose: Optional[float] = Field(120.0, ge=0.0, le=500.0, example=130.0)
    blood_pressure: Optional[float] = Field(70.0, ge=0.0, le=250.0, example=85.0)
    skin_thickness: Optional[float] = Field(20.0, ge=0.0, le=100.0, example=25.0)
    insulin: Optional[float] = Field(80.0, ge=0.0, le=900.0, example=90.0)
    bmi: Optional[float] = Field(25.0, ge=0.0, le=100.0, example=28.4)
    diabetes_pedigree_function: Optional[float] = Field(0.47, ge=0.0, le=5.0, example=0.52)
    age: Optional[int] = Field(30, ge=1, le=120, example=40)


class PredictionResponse(BaseModel):
    id: Optional[int] = None
    assessment_id: Optional[int] = None
    prediction: str
    risk_percentage: float
    confidence: float
    recommendation: Optional[str] = "Consult a healthcare professional for clinical guidance and personalized lifestyle management."
    contributing_factors: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PredictionListResponse(BaseModel):
    total: int
    predictions: List[PredictionResponse]
