from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.security import get_current_user
from app.models.user import User
from app.services.auth_service import AuthService
from app.utils.response import success_response

router = APIRouter(prefix="/api/user", tags=["User Profile"])


@router.get("/me")
def get_user_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get current logged in user details.
    """
    service = AuthService(db)
    profile = service.get_profile(current_user)
    return success_response(data=profile.model_dump(mode="json"), message="Current user profile retrieved")
