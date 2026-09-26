"""
Assessment Schema v2 — India Diabetes Patient Dataset fields.
Replaces old Pima-style schema (pregnancies / insulin / skin_thickness / dpf).
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AssessmentCreateRequest(BaseModel):
    """
    Validated request schema for the new India Diabetes dataset feature set.
    All fields that are optional are handled by the training-derived imputers
    inside the sklearn Pipeline — no server-side hardcoded defaults.
    """
    # Demographic
    patient_group: Optional[str] = Field(
        None,
        example="Urban",
        description="Patient location group: Urban / Semi-Urban / Rural"
    )
    age: float = Field(..., ge=1.0, le=110.0, example=42.0,
                       description="Age in years")
    gender: Optional[str] = Field(
        None,
        example="Male",
        description="Gender: Male or Female"
    )

    # Physical measurements
    bmi: float = Field(..., ge=10.0, le=70.0, example=27.5,
                       description="Body Mass Index (kg/m²)")
    blood_pressure: Optional[float] = Field(
        None, ge=60.0, le=220.0, example=130.0,
        description="Systolic blood pressure (mmHg)"
    )

    # Lifestyle
    physical_activity_hours: Optional[float] = Field(
        None, ge=0.0, le=20.0, example=3.5,
        description="Daily physical activity / exercise in hours"
    )
    daily_sugar_intake: Optional[float] = Field(
        None, ge=0.0, le=200.0, example=55.0,
        description="Daily sugar intake in grams"
    )
    fast_food_frequency: Optional[float] = Field(
        None, ge=0.0, le=15.0, example=2.0,
        description="Number of fast food meals per week"
    )
    sleep_hours: Optional[float] = Field(
        None, ge=2.0, le=14.0, example=7.0,
        description="Average sleep hours per night"
    )

    # Clinical / Labs
    hba1c: Optional[float] = Field(
        None, ge=3.0, le=20.0, example=5.9,
        description="HbA1c percentage (glycated haemoglobin)"
    )
    fasting_glucose: Optional[float] = Field(
        None, ge=50.0, le=450.0, example=108.0,
        description="Fasting blood glucose (mg/dL)"
    )

    # Genetic / Social
    family_history: Optional[float] = Field(
        None, ge=0.0, le=1.0, example=0.0,
        description="Family history of diabetes: 1 = Yes, 0 = No"
    )
    monthly_income: Optional[float] = Field(
        None, ge=0.0, le=200000.0, example=35000.0,
        description="Monthly household income (INR)"
    )

    # Temporal
    month: Optional[float] = Field(
        None, ge=1.0, le=12.0, example=6.0,
        description="Month of assessment (1–12)"
    )

    # Legacy fallbacks for backward compatibility
    glucose: Optional[float] = Field(None, description="Legacy glucose field, mapped to fasting_glucose")
    pregnancies: Optional[int] = Field(0, description="Legacy pregnancies field")
    skin_thickness: Optional[float] = Field(0.0, description="Legacy skin thickness field")
    insulin: Optional[float] = Field(0.0, description="Legacy insulin field")
    diabetes_pedigree_function: Optional[float] = Field(0.0, description="Legacy DPF field")


class AssessmentResponse(BaseModel):
    id: int
    user_id: int
    # New fields
    patient_group: Optional[str] = None
    age: float
    gender: Optional[str] = None
    bmi: float
    blood_pressure: Optional[float] = None
    physical_activity_hours: Optional[float] = None
    daily_sugar_intake: Optional[float] = None
    fast_food_frequency: Optional[float] = None
    sleep_hours: Optional[float] = None
    hba1c: Optional[float] = None
    fasting_glucose: Optional[float] = None
    family_history: Optional[float] = None
    monthly_income: Optional[float] = None
    month: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AssessmentListResponse(BaseModel):
    total: int
    assessments: List[AssessmentResponse]
