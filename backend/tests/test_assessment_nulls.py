"""
Test assessment prediction when optional lifestyle and clinical fields are omitted (None).
Ensures zero fabricated defaults are required, and the scikit-learn imputer in the v2 pipeline
safely imputes medians/modes.
"""
import pytest


def test_prediction_with_null_optionals(client):
    # 1. Register test user
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Nulls Test User",
            "email": "nulls_test@example.com",
            "password": "Password123!",
        },
    )
    assert reg.status_code in (200, 201)
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit payload with only core required fields; optionals set to None
    payload = {
        "patient_group": "Rural",
        "gender": "Male",
        "age": 48,
        "bmi": 27.2,
        "blood_pressure": None,
        "physical_activity_hours": None,
        "daily_sugar_intake": None,
        "fast_food_frequency": None,
        "sleep_hours": None,
        "hba1c": None,
        "fasting_glucose": None,
        "family_history": None,
        "monthly_income": None,
    }

    res = client.post("/api/prediction", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "prediction" in data
    assert data["prediction"] in ("Diabetic", "Non-Diabetic", "Higher Risk Pattern", "Lower Risk Pattern")
    assert "risk_percentage" in data
    assert 0.0 <= data["risk_percentage"] <= 100.0
    assert "confidence" in data
    assert data["confidence"] > 0.0
    assert "recommendation" in data
    assert len(data["recommendation"]) > 10
