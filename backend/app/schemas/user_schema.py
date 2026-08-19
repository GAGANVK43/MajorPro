from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    age: Optional[int] = None
    gender: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
