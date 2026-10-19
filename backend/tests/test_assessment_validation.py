import pytest
from app.schemas.assessment_schema import AssessmentValidateRequest
from app.services.assessment_service import AssessmentService


def test_validate_draft_valid_complete():
    req = AssessmentValidateRequest(
        age=35,
        gender="Male",
        patient_group="Urban",
        height=175.0,
        weight=70.0,
        blood_pressure=120.0,
        fasting_glucose=95.0,
        hba1c=5.4,
    )
    res = AssessmentService.validate_draft(req)
    assert res.is_valid is True
    assert len(res.errors) == 0
    assert len(res.missing_fields) == 0
    assert res.calculated_bmi == 22.9
    assert res.normalized_data["bmi"] == 22.9
    assert res.normalized_data["age"] == 35


def test_validate_draft_missing_height_and_weight():
    # Lab report extracted age, gender, bp, fasting glucose, but height and weight omitted
    req = AssessmentValidateRequest(
        age=45,
        gender="Female",
        patient_group="Rural",
        blood_pressure=130.0,
        fasting_glucose=115.0,
        hba1c=6.1,
    )
    res = AssessmentService.validate_draft(req)
    assert res.is_valid is False
    assert "height" in res.missing_fields
    assert "weight" in res.missing_fields


def test_validate_draft_report_has_bmi_but_missing_height_weight():
    # Report provides BMI (26.4) directly, but height and weight must still be prompted for screening
    req = AssessmentValidateRequest(
        age=52,
        gender="Male",
        patient_group="Semi-Urban",
        bmi=26.4,
        blood_pressure=125.0,
    )
    res = AssessmentService.validate_draft(req)
    assert res.is_valid is False
    assert "height" in res.missing_fields
    assert "weight" in res.missing_fields
    assert res.normalized_data["bmi"] == 26.4


def test_validate_draft_out_of_bounds_values():
    req = AssessmentValidateRequest(
        age=150,  # Invalid (>120)
        gender="InvalidGender",
        height=35.0,  # Invalid (<50)
        weight=400.0,  # Invalid (>300)
        blood_pressure=300.0,  # Invalid (>250)
        fasting_glucose=900.0,  # Invalid (>600)
    )
    res = AssessmentService.validate_draft(req)
    assert res.is_valid is False
    assert "age" in res.errors
    assert "gender" in res.errors
    assert "height" in res.errors
    assert "weight" in res.errors
    assert "blood_pressure" in res.errors
    assert "fasting_glucose" in res.errors


def test_api_validate_endpoint_valid(client):
    payload = {
        "age": 30,
        "gender": "Male",
        "patient_group": "Urban",
        "height": 170.0,
        "weight": 65.0,
        "blood_pressure": 118.0,
    }
    response = client.post("/api/assessment/validate", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    data = json_data["data"]
    assert data["is_valid"] is True
    assert data["calculated_bmi"] == 22.5
    assert len(data["missing_fields"]) == 0


def test_api_validate_endpoint_missing_fields_preserves_state(client):
    payload = {
        "age": 28,
        "gender": "Female",
        "patient_group": "Rural",
        # Height and weight missing
    }
    response = client.post("/api/assessment/validate", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    data = json_data["data"]
    assert data["is_valid"] is False
    assert "height" in data["missing_fields"]
    assert "weight" in data["missing_fields"]
    # Existing data is preserved in normalized_data
    assert data["normalized_data"]["age"] == 28
    assert data["normalized_data"]["gender"] == "Female"
