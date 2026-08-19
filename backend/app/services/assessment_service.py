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
        assessment = Assessment(
            user_id=user.id,
            pregnancies=request.pregnancies,
            glucose=request.glucose,
            blood_pressure=request.blood_pressure,
            skin_thickness=request.skin_thickness,
            insulin=request.insulin,
            bmi=request.bmi,
            diabetes_pedigree_function=request.diabetes_pedigree_function,
            age=request.age,
        )
        saved = self.assessment_repo.create(assessment)
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
