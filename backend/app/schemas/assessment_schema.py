from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AssessmentCreateRequest(BaseModel):
    pregnancies: int = Field(0, ge=0, le=20, example=2)
    glucose: float = Field(..., ge=0.0, le=500.0, example=120.0)
    blood_pressure: float = Field(..., ge=0.0, le=250.0, example=80.0)
    skin_thickness: float = Field(0.0, ge=0.0, le=100.0, example=20.0)
    insulin: float = Field(0.0, ge=0.0, le=900.0, example=85.0)
    bmi: float = Field(..., ge=0.0, le=100.0, example=24.5)
    diabetes_pedigree_function: float = Field(0.0, ge=0.0, le=5.0, example=0.45)
    age: int = Field(..., ge=1, le=120, example=35)


class AssessmentResponse(BaseModel):
    id: int
    user_id: int
    pregnancies: int
    glucose: float
    blood_pressure: float
    skin_thickness: float
    insulin: float
    bmi: float
    diabetes_pedigree_function: float
    age: int
    created_at: datetime

    class Config:
        from_attributes = True


class AssessmentListResponse(BaseModel):
    total: int
    assessments: List[AssessmentResponse]
