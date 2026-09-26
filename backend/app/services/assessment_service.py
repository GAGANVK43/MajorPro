from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.assessment import Assessment
from app.repositories.assessment_repository import AssessmentRepository
from app.schemas.assessment_schema import AssessmentCreateRequest, AssessmentResponse, AssessmentListResponse


class AssessmentService:
    """
    Business Logic Layer for Assessment Operations.
    """
    def __init__(self, db: Session):
        self.db = db
        self.assessment_repo = AssessmentRepository(db)

    def create_assessment(self, user: User, request: AssessmentCreateRequest) -> AssessmentResponse:
        fasting_glucose = getattr(request, "fasting_glucose", None) or getattr(request, "glucose", None)
        pregnancies = getattr(request, "pregnancies", 0) or 0
        gender = getattr(request, "gender", None) or ("Female" if pregnancies > 0 else (user.gender or "Male"))
        
        # Create Assessment Record with both v2 and legacy fields
        assessment = Assessment(
            user_id=user.id,
            patient_group=getattr(request, "patient_group", None),
            age=request.age,
            gender=gender,
            bmi=request.bmi,
            blood_pressure=request.blood_pressure,
            physical_activity_hours=getattr(request, "physical_activity_hours", None),
            daily_sugar_intake=getattr(request, "daily_sugar_intake", None),
            fast_food_frequency=getattr(request, "fast_food_frequency", None),
            sleep_hours=getattr(request, "sleep_hours", None),
            hba1c=getattr(request, "hba1c", None),
            fasting_glucose=fasting_glucose,
            family_history=getattr(request, "family_history", None),
            monthly_income=getattr(request, "monthly_income", None),
            month=getattr(request, "month", None),
            # Legacy fields for backward compatibility
            pregnancies=pregnancies,
            glucose=fasting_glucose,
            skin_thickness=getattr(request, "skin_thickness", 0.0),
            insulin=getattr(request, "insulin", 0.0),
            diabetes_pedigree_function=getattr(request, "diabetes_pedigree_function", 0.0),
        )
        saved = self.assessment_repo.create(assessment)

        # Auto-update User Profile Age and Gender if changed or not set
        try:
            user.age = int(request.age)
            if not user.gender:
                user.gender = gender
            self.db.add(user)
            self.db.commit()
        except Exception:
            pass

        return AssessmentResponse.model_validate(saved)

    def get_assessment_history(self, user: User) -> AssessmentListResponse:
        assessments = self.assessment_repo.get_by_user_id(user.id)
        items = [AssessmentResponse.model_validate(a) for a in assessments]
        return AssessmentListResponse(total=len(items), assessments=items)

    def get_assessment_by_id(self, user: User, assessment_id: int) -> AssessmentResponse:
        assessment = self.assessment_repo.get_by_id(assessment_id)
        if not assessment or assessment.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment record not found or access denied",
            )
        return AssessmentResponse.model_validate(assessment)

    def delete_assessment(self, user: User, assessment_id: int) -> None:
        assessment = self.assessment_repo.get_by_id(assessment_id)
        if not assessment or assessment.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment record not found or access denied",
            )
        self.assessment_repo.delete(assessment)
