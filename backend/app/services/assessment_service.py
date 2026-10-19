from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.assessment import Assessment
from app.repositories.assessment_repository import AssessmentRepository
from app.schemas.assessment_schema import (
    AssessmentCreateRequest,
    AssessmentResponse,
    AssessmentListResponse,
    AssessmentValidateRequest,
    AssessmentValidateResponse,
)


class AssessmentService:
    """
    Business Logic Layer for Assessment Operations.
    Supports 14 Indian Diabetes clinical and lifestyle predictors with full backward compatibility.
    """
    def __init__(self, db: Session):
        self.db = db
        self.assessment_repo = AssessmentRepository(db)

    def create_assessment(self, user: User, request: AssessmentCreateRequest) -> AssessmentResponse:
        glu_val = request.fasting_glucose or request.glucose or 100.0

        assessment = Assessment(
            user_id=user.id,
            patient_group=request.patient_group or "Urban",
            gender=request.gender or user.gender or "Male",
            age=request.age or user.age or 35,
            bmi=request.bmi,
            blood_pressure=request.blood_pressure,
            hba1c=request.hba1c or 5.7,
            fasting_glucose=glu_val,
            physical_activity_hours=request.physical_activity_hours or 2.0,
            daily_sugar_intake=request.daily_sugar_intake or 30.0,
            fast_food_frequency=request.fast_food_frequency or 2.0,
            sleep_hours=request.sleep_hours or 7.0,
            family_history=request.family_history or 0.0,
            monthly_income=request.monthly_income or 35000.0,
            month=request.month or 6.0,
            # Legacy mapping
            glucose=glu_val,
            pregnancies=request.pregnancies or 0,
            skin_thickness=request.skin_thickness or 20.0,
            insulin=request.insulin or 80.0,
            diabetes_pedigree_function=request.diabetes_pedigree_function or 0.45,
        )
        saved = self.assessment_repo.create(assessment)

        # Auto-update User Profile Age and Gender if changed or not set
        try:
            user.age = request.age
            if request.gender:
                user.gender = request.gender
            elif request.pregnancies and request.pregnancies > 0:
                user.gender = "Female"
            self.db.add(user)
            self.db.commit()
        except Exception:
            pass

        return AssessmentResponse.model_validate(saved)

    def get_assessment_history(self, user: User) -> AssessmentListResponse:
        assessments = self.assessment_repo.get_by_user_id(user.id)
        items = []
        for a in assessments:
            # Ensure fallback if legacy record has glucose instead of fasting_glucose
            resp_item = AssessmentResponse.model_validate(a)
            if resp_item.fasting_glucose is None and a.glucose is not None:
                resp_item.fasting_glucose = a.glucose
            items.append(resp_item)
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

    @staticmethod
    def validate_draft(request: AssessmentValidateRequest) -> AssessmentValidateResponse:
        """
        Validate assessment draft inputs against physiological ranges and required screening fields.
        Does NOT throw exceptions on invalid values, but returns structured validation state
        so clients can prompt the user without losing existing draft data.
        """
        errors = {}
        missing_fields = []
        normalized_data = {}
        calculated_bmi = None

        # 1. Height and Weight -> BMI calculation
        height = request.height
        weight = request.weight
        bmi = request.bmi

        if height is not None:
            if height < 50.0 or height > 250.0:
                errors["height"] = f"Height {height} cm is outside valid range (50 - 250 cm)."
            else:
                normalized_data["height"] = height
        else:
            missing_fields.append("height")

        if weight is not None:
            if weight < 20.0 or weight > 300.0:
                errors["weight"] = f"Weight {weight} kg is outside valid range (20 - 300 kg)."
            else:
                normalized_data["weight"] = weight
        else:
            missing_fields.append("weight")

        if height and weight and 50.0 <= height <= 250.0 and 20.0 <= weight <= 300.0:
            calculated_bmi = round(weight / ((height / 100.0) ** 2), 1)
            normalized_data["bmi"] = calculated_bmi
        elif bmi is not None:
            if bmi < 10.0 or bmi > 100.0:
                errors["bmi"] = f"BMI {bmi} is outside valid range (10 - 100 kg/m²)."
            else:
                normalized_data["bmi"] = bmi

        # 2. Age
        if request.age is not None:
            if request.age < 1 or request.age > 120:
                errors["age"] = f"Age {request.age} is outside valid range (1 - 120 years)."
            else:
                normalized_data["age"] = int(request.age)
        else:
            missing_fields.append("age")

        # 3. Gender
        valid_genders = ["Male", "Female", "Other"]
        if request.gender is not None:
            norm_gender = str(request.gender).capitalize()
            if norm_gender in valid_genders:
                normalized_data["gender"] = norm_gender
            else:
                errors["gender"] = f"Invalid gender '{request.gender}'. Expected Male, Female, or Other."
        else:
            missing_fields.append("gender")

        # 4. Patient Group
        valid_groups = ["Urban", "Rural", "Semi-Urban"]
        if request.patient_group is not None:
            group_match = next((g for g in valid_groups if g.lower() == str(request.patient_group).lower()), None)
            if group_match:
                normalized_data["patient_group"] = group_match
            else:
                errors["patient_group"] = f"Invalid location type '{request.patient_group}'."
        else:
            normalized_data["patient_group"] = "Urban"

        # 5. Blood Pressure
        if request.blood_pressure is not None:
            if request.blood_pressure < 40.0 or request.blood_pressure > 250.0:
                errors["blood_pressure"] = f"Blood pressure {request.blood_pressure} mmHg is outside valid range (40 - 250 mmHg)."
            else:
                normalized_data["blood_pressure"] = request.blood_pressure
        else:
            normalized_data["blood_pressure"] = 120.0

        # 6. Optional Clinical & Lifestyle Biomarkers
        if request.fasting_glucose is not None:
            if request.fasting_glucose < 40.0 or request.fasting_glucose > 600.0:
                errors["fasting_glucose"] = f"Fasting glucose {request.fasting_glucose} mg/dL is outside valid range (40 - 600 mg/dL)."
            else:
                normalized_data["fasting_glucose"] = request.fasting_glucose

        if request.hba1c is not None:
            if request.hba1c < 3.0 or request.hba1c > 20.0:
                errors["hba1c"] = f"HbA1c {request.hba1c}% is outside valid range (3.0 - 20.0%)."
            else:
                normalized_data["hba1c"] = request.hba1c

        if request.physical_activity_hours is not None:
            if request.physical_activity_hours < 0.0 or request.physical_activity_hours > 24.0:
                errors["physical_activity_hours"] = f"Physical activity {request.physical_activity_hours} hrs is outside range (0 - 24 hrs)."
            else:
                normalized_data["physical_activity_hours"] = request.physical_activity_hours

        if request.daily_sugar_intake is not None:
            if request.daily_sugar_intake < 0.0 or request.daily_sugar_intake > 500.0:
                errors["daily_sugar_intake"] = f"Sugar intake {request.daily_sugar_intake} g is outside range (0 - 500 g)."
            else:
                normalized_data["daily_sugar_intake"] = request.daily_sugar_intake

        if request.fast_food_frequency is not None:
            if request.fast_food_frequency < 0.0 or request.fast_food_frequency > 30.0:
                errors["fast_food_frequency"] = f"Fast food frequency {request.fast_food_frequency} is outside range (0 - 30 meals/mo)."
            else:
                normalized_data["fast_food_frequency"] = request.fast_food_frequency

        if request.sleep_hours is not None:
            if request.sleep_hours < 1.0 or request.sleep_hours > 24.0:
                errors["sleep_hours"] = f"Sleep hours {request.sleep_hours} is outside range (1 - 24 hrs)."
            else:
                normalized_data["sleep_hours"] = request.sleep_hours

        if request.family_history is not None:
            if request.family_history not in [0.0, 1.0, 0, 1]:
                errors["family_history"] = "Family history must be 0 or 1."
            else:
                normalized_data["family_history"] = float(request.family_history)

        if request.monthly_income is not None:
            if request.monthly_income < 0:
                errors["monthly_income"] = "Monthly income cannot be negative."
            else:
                normalized_data["monthly_income"] = request.monthly_income

        is_valid = len(errors) == 0 and len(missing_fields) == 0

        return AssessmentValidateResponse(
            is_valid=is_valid,
            errors=errors,
            missing_fields=missing_fields,
            calculated_bmi=calculated_bmi,
            normalized_data=normalized_data,
        )
