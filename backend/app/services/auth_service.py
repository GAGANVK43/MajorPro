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
        Generates a secure, time-limited password reset token.
        Stores SHA-256 hash of token in database (never plaintext).
        Dispatches password reset email via EmailService.
        Reports accurate delivery status without misleading success states.
        """
        user = self.user_repo.get_by_email(request.email)
        if not user:
            # Privacy-preserving: Do not reveal whether user exists
            return {
                "message": "If an account with that email exists, password reset instructions have been processed.",
                "email": request.email.lower().strip(),
                "email_dispatched": False,
                "delivery_status": "unverified",
            }

        # Generate cryptographically secure raw token
        raw_token = secrets.token_urlsafe(32)
        # Store SHA-256 hash in database for security
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        user.reset_token = token_hash
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        user.updated_at = datetime.utcnow()
        self.user_repo.update(user)

        # Dispatch email with raw token in the reset link
        email_svc = EmailService()
        delivery_result = email_svc.send_password_reset_email(
            email=user.email,
            reset_token=raw_token,
            full_name=user.full_name,
        )

        res_data = {
            "message": "If an account with that email exists, password reset instructions have been processed.",
            "email": user.email,
            "email_dispatched": delivery_result.get("delivered", False),
            "delivery_status": delivery_result.get("status", "unknown"),
        }

        # Safe diagnostic for developers in debug mode or when provider is unconfigured
        if not delivery_result.get("delivered") and settings.DEBUG:
            res_data["dev_diagnostic"] = (
                "Outbound email was not sent because SMTP credentials (SMTP_USER / SMTP_PASSWORD) "
                "are not configured in backend/.env. To receive real emails in your inbox, set your "
                "SMTP provider credentials in backend/.env."
            )
            # Expose raw token exclusively in debug mode for seamless local developer testing
            res_data["dev_reset_token"] = raw_token

        return res_data

    def reset_password(self, request: ResetPasswordRequest) -> None:
        """
        Validates the raw reset token against stored SHA-256 hash,
        verifies it is not expired, sets the new password, and invalidates the token.
        """
        candidate_token = request.token.strip()
        candidate_hash = hashlib.sha256(candidate_token.encode("utf-8")).hexdigest()

        user = (
            self.db.query(User)
            .filter(User.reset_token == candidate_hash)
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

        # Hash new password with bcrypt
        user.password = hash_password(request.new_password)
        # Invalidate token immediately upon single use
        user.reset_token = None
        user.reset_token_expiry = None
        user.updated_at = datetime.utcnow()
        self.user_repo.update(user)
        logger.info(f"Password successfully reset and token revoked for user: {user.email}")

