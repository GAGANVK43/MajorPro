from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import UserRegisterRequest, UserLoginRequest, TokenResponse
from app.schemas.user_schema import UserProfileResponse, UserProfileUpdateRequest
from app.config.security import hash_password, verify_password, create_access_token, create_refresh_token


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
                detail="User with this email address already exists",
            )

        new_user = User(
            full_name=request.full_name,
            email=request.email.lower().strip(),
            password=hash_password(request.password),
            age=request.age,
            gender=request.gender,
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

    def update_profile(self, user: User, request: UserProfileUpdateRequest) -> UserProfileResponse:
        if request.full_name is not None:
            user.full_name = request.full_name
        if request.age is not None:
            user.age = request.age
        if request.gender is not None:
            user.gender = request.gender

        updated_user = self.user_repo.update(user)
        return UserProfileResponse.model_validate(updated_user)
