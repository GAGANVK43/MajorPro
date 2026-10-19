from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, example="John Doe")
    email: EmailStr = Field(..., example="john.doe@example.com")
    password: str = Field(..., min_length=6, example="Password123!")
    age: Optional[int] = Field(None, ge=1, le=120, example=35)
    gender: Optional[str] = Field(None, example="Male")


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., example="john.doe@example.com")
    password: str = Field(..., example="Password123!")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    id: Optional[int] = None
    full_name: str
    email: str
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    onboarding_completed: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., example="john.doe@example.com")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, description="Reset token received via email or dev response")
    new_password: str = Field(..., min_length=6, example="NewPassword123!")

