from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    onboarding_completed: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    date_of_birth: Optional[str] = None
    age: Optional[int] = Field(None, ge=1, le=120)
    gender: Optional[str] = Field(None)
    address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)


class UserEmailChangeRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(..., min_length=1)


class UserPasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserProfileStatsResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    onboarding_completed: bool = False
    created_at: datetime
    updated_at: datetime
    user: Optional[UserProfileResponse] = None
    total_assessments: int = 0
    latest_prediction: Optional[str] = None
    latest_risk_score: Optional[float] = None
    latest_confidence: Optional[float] = None
    latest_assessment_date: Optional[datetime] = None
