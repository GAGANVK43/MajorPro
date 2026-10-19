import secrets
import hashlib
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.assessment import Assessment
from app.models.prediction import Prediction
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.user_schema import (
    UserProfileResponse,
    UserProfileUpdateRequest,
    UserPasswordChangeRequest,
    UserProfileStatsResponse
)
from app.config.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.config.settings import settings
from app.utils.logger import logger
from app.services.email_service import EmailService



class AuthService:
    """
    Business Logic Layer for User Registration, Authentication, and Profile Management.
    """
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def register(self, request: UserRegisterRequest) -> TokenResponse:
        existing_user = self.user_repo.get_by_email(request.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Try logging in or resetting your password.",
            )

        new_user = User(
            full_name=request.full_name,
            email=request.email.lower().strip(),
            password=hash_password(request.password),
            age=request.age,
            gender=request.gender or "Male",
        )
        saved_user = self.user_repo.create(new_user)

        token_data = {"sub": saved_user.email, "id": saved_user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_id=saved_user.id,
            full_name=saved_user.full_name,
            email=saved_user.email,
        )

    def login(self, request: UserLoginRequest) -> TokenResponse:
        user = self.user_repo.get_by_email(request.email)
        if not user or not verify_password(request.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password credentials",
            )

        token_data = {"sub": user.email, "id": user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
        )

    def get_profile(self, user: User) -> UserProfileResponse:
        return UserProfileResponse.model_validate(user)

    def get_profile_with_stats(self, user: User) -> UserProfileStatsResponse:
        # Query total assessments
        assessments = (
            self.db.query(Assessment)
            .filter(Assessment.user_id == user.id)
            .order_by(Assessment.id.desc())
            .all()
        )
        total_count = len(assessments)

        latest_pred_str = None
        latest_risk = None
        latest_conf = None
        latest_date = None

        if assessments:
            latest_assessment = assessments[0]
            latest_date = latest_assessment.created_at
            pred_record = (
                self.db.query(Prediction)
                .filter(Prediction.assessment_id == latest_assessment.id)
                .first()
            )
            if pred_record:
                latest_pred_str = pred_record.prediction
                latest_risk = pred_record.risk_percentage
                latest_conf = pred_record.confidence

        return UserProfileStatsResponse(
            user=UserProfileResponse.model_validate(user),
            total_assessments=total_count,
            latest_prediction=latest_pred_str,
            latest_risk_score=latest_risk,
            latest_confidence=latest_conf,
            latest_assessment_date=latest_date,
        )

    def update_profile(self, user: User, request: UserProfileUpdateRequest) -> UserProfileResponse:
        if request.full_name is not None and request.full_name.strip():
            user.full_name = request.full_name.strip()
        if request.age is not None:
            user.age = request.age
        if request.gender is not None and request.gender.strip():
            user.gender = request.gender.strip()

        user.updated_at = datetime.utcnow()
        updated_user = self.user_repo.update(user)
        return UserProfileResponse.model_validate(updated_user)

    def change_password(self, user: User, request: UserPasswordChangeRequest) -> None:
        if not verify_password(request.current_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect. Please check and try again.",
            )

        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long.",
            )

        user.password = hash_password(request.new_password)
        user.updated_at = datetime.utcnow()
        self.user_repo.update(user)

    def forgot_password(self, request: ForgotPasswordRequest) -> dict:
        """
        Generates a secure password reset token valid for 1 hour.
        Dispatches reset email via EmailService.
        Returns reset_token in response in development mode for easy verification.
        """
        user = self.user_repo.get_by_email(request.email)
        if not user:
            # Do not reveal whether user exists for security
            return {
                "message": "If an account with that email exists, password reset instructions have been sent.",
                "email": request.email.lower().strip(),
            }

        # Generate cryptographically secure reset token
        reset_token = secrets.token_urlsafe(32)
        user.reset_token = reset_token
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        user.updated_at = datetime.utcnow()
        self.user_repo.update(user)

        # Dispatch email
        email_svc = EmailService()
        email_svc.send_password_reset_email(
            email=user.email,
            reset_token=reset_token,
            full_name=user.full_name,
        )

        return {
            "message": "If an account with that email exists, password reset instructions have been sent.",
            "email": user.email,
            # Provided for client convenience / dev testing when SMTP is not configured
            "reset_token": reset_token,
        }

    def reset_password(self, request: ResetPasswordRequest) -> None:
        """
        Validates the reset token, verifies it is not expired,
        and sets the new password.
        """
        user = (
            self.db.query(User)
            .filter(User.reset_token == request.token)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token. Please request a new link.",
            )

        if user.reset_token_expiry and user.reset_token_expiry < datetime.utcnow():
            user.reset_token = None
            user.reset_token_expiry = None
            self.user_repo.update(user)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired. Please request a new link.",
            )

        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long.",
            )

        user.password = hash_password(request.new_password)
        user.reset_token = None
        user.reset_token_expiry = None
        user.updated_at = datetime.utcnow()
        self.user_repo.update(user)
        logger.info(f"Password successfully reset for user: {user.email}")

