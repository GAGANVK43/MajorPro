"""
Automated regression tests for User Profile Persistence, Date of Birth / Age calculation,
Secure Email Change, Onboarding Completion, and Assessment-Aware Diet Plan Access & Authorization.
"""
import pytest
from datetime import date
from app.models.assessment import Assessment
from app.models.prediction import Prediction
from app.models.user import User


def test_profile_persistence_and_stats_retrieval(client, db_session):
    """
    Verify profile update persists DOB, address, city, state, postal code,
    auto-computes age from DOB, and returns full profile data.
    """
    # 1. Register user
    reg = client.post("/api/auth/register", json={
        "full_name": "Arjun Sharma",
        "email": "arjun.sharma@example.com",
        "password": "SecurePassword123!",
        "gender": "Male"
    })
    assert reg.status_code == 201
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Update profile with DOB and address
    dob_str = "1995-04-12"
    update_res = client.put("/api/user/profile", json={
        "full_name": "Arjun V. Sharma",
        "date_of_birth": dob_str,
        "gender": "Male",
        "address": "42, Brigade Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560025",
        "country": "India"
    }, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()["data"]
    assert updated_data["full_name"] == "Arjun V. Sharma"
    assert updated_data["date_of_birth"] == dob_str
    assert updated_data["city"] == "Bengaluru"
    assert updated_data["state"] == "Karnataka"
    assert updated_data["postal_code"] == "560025"
    assert updated_data["address"] == "42, Brigade Road"

    # Age must be correctly calculated
    today = date.today()
    expected_age = today.year - 1995 - ((today.month, today.day) < (4, 12))
    assert updated_data["age"] == expected_age

    # 3. Retrieve profile with stats
    get_res = client.get("/api/user/profile", headers=headers)
    assert get_res.status_code == 200
    prof = get_res.json()["data"]
    # Check both root level (new) and nested user (legacy compatibility)
    assert prof["email"] == "arjun.sharma@example.com"
    assert prof["full_name"] == "Arjun V. Sharma"
    assert prof["age"] == expected_age
    assert prof["city"] == "Bengaluru"
    assert "user" in prof
    assert prof["user"]["email"] == "arjun.sharma@example.com"
    assert prof["user"]["full_name"] == "Arjun V. Sharma"


def test_dob_future_date_rejected(client):
    """
    Ensure entering a future Date of Birth is rejected with HTTP 400.
    """
    reg = client.post("/api/auth/register", json={
        "full_name": "Future Patient",
        "email": "future@example.com",
        "password": "Password123!"
    })
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.put("/api/user/profile", json={
        "full_name": "Future Patient",
        "date_of_birth": "2099-12-31"
    }, headers=headers)
    assert res.status_code == 400
    msg = res.json().get("detail") or res.json().get("message", "")
    assert "future" in msg.lower()


def test_secure_email_change_flow(client):
    """
    Verify email update requires current password authorization, rejects invalid passwords,
    rejects duplicate emails with 409 Conflict, and returns a fresh JWT on success.
    """
    # Register primary user
    reg1 = client.post("/api/auth/register", json={
        "full_name": "Kavita Rao",
        "email": "kavita.orig@example.com",
        "password": "OriginalPassword123!"
    })
    token1 = reg1.json()["data"]["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Register second user to test conflict
    client.post("/api/auth/register", json={
        "full_name": "Other User",
        "email": "other.user@example.com",
        "password": "Password123!"
    })

    # 1. Attempt email change with wrong password
    bad_pw_res = client.put("/api/user/change-email", json={
        "new_email": "kavita.new@example.com",
        "current_password": "WrongPassword999!"
    }, headers=headers1)
    assert bad_pw_res.status_code == 400
    err_body = bad_pw_res.json()
    err_msg = (err_body.get("message") or err_body.get("detail") or "").lower()
    assert "incorrect" in err_msg

    # 2. Attempt email change to identical email
    same_res = client.put("/api/user/change-email", json={
        "new_email": "kavita.orig@example.com",
        "current_password": "OriginalPassword123!"
    }, headers=headers1)
    assert same_res.status_code == 400

    # 3. Attempt email change to an already occupied email -> 409 Conflict
    conflict_res = client.put("/api/user/change-email", json={
        "new_email": "other.user@example.com",
        "current_password": "OriginalPassword123!"
    }, headers=headers1)
    assert conflict_res.status_code == 409

    # 4. Successful email change
    success_res = client.put("/api/user/change-email", json={
        "new_email": "kavita.new@example.com",
        "current_password": "OriginalPassword123!"
    }, headers=headers1)
    assert success_res.status_code == 200
    data = success_res.json()["data"]
    assert data["email"] == "kavita.new@example.com"
    new_token = data.get("access_token")
    assert new_token is not None

    # 5. Verify old token or new token accesses profile with new email
    new_headers = {"Authorization": f"Bearer {new_token}"}
    prof_res = client.get("/api/user/profile", headers=new_headers)
    assert prof_res.status_code == 200
    assert prof_res.json()["data"]["email"] == "kavita.new@example.com"


def test_onboarding_completed_flow(client):
    """
    Verify onboarding status defaults to False, can be updated to True,
    and returning users maintain completed onboarding state.
    """
    reg = client.post("/api/auth/register", json={
        "full_name": "Rohan Deshmukh",
        "email": "rohan.onboarding@example.com",
        "password": "Password123!"
    })
    data = reg.json()["data"]
    token = data["access_token"]
    assert data.get("onboarding_completed") is False
    headers = {"Authorization": f"Bearer {token}"}

    # Complete onboarding
    comp_res = client.put("/api/user/onboarding-complete", headers=headers)
    assert comp_res.status_code == 200
    assert comp_res.json()["data"]["onboarding_completed"] is True

    # Check profile reflects it
    prof_res = client.get("/api/user/profile", headers=headers)
    assert prof_res.json()["data"]["onboarding_completed"] is True


def test_diet_plan_by_assessment_id_and_authorization(client, db_session):
    """
    Verify a user can retrieve a personalized diet plan using their assessment ID,
    and another user is forbidden (403) from accessing another patient's assessment diet plan.
    """
    # User 1
    reg1 = client.post("/api/auth/register", json={
        "full_name": "Patient Alpha",
        "email": "patient.alpha@example.com",
        "password": "Password123!"
    })
    token1 = reg1.json()["data"]["access_token"]
    user1_id = reg1.json()["data"]["id"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Create an assessment record in DB for User 1
    assessment1 = Assessment(
        user_id=user1_id,
        fasting_glucose=160.0,
        glucose=160.0,
        bmi=28.5,
        blood_pressure=130.0,
        age=45
    )
    db_session.add(assessment1)
    db_session.commit()
    db_session.refresh(assessment1)

    # Also create a prediction linked to assessment1
    prediction1 = Prediction(
        assessment_id=assessment1.id,
        prediction="Higher Risk Pattern",
        risk_percentage=65.0,
        confidence=94.0
    )
    db_session.add(prediction1)
    db_session.commit()

    # User 1 fetches diet plan by assessment ID -> 200 OK
    diet_res1 = client.get(f"/api/diet/assessment/{assessment1.id}", headers=headers1)
    assert diet_res1.status_code == 200
    diet_data = diet_res1.json()["data"]
    assert diet_data["assessment_id"] == assessment1.id
    assert diet_data["glucose"] == 160.0
    assert diet_data["bmi"] == 28.5
    assert "breakfast" in diet_data
    assert "lunch" in diet_data

    # User 2
    reg2 = client.post("/api/auth/register", json={
        "full_name": "Patient Beta",
        "email": "patient.beta@example.com",
        "password": "Password123!"
    })
    token2 = reg2.json()["data"]["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # User 2 attempts to fetch User 1's assessment diet plan -> 403 Forbidden
    diet_res2 = client.get(f"/api/diet/assessment/{assessment1.id}", headers=headers2)
    assert diet_res2.status_code == 403
    body2 = diet_res2.json()
    detail = (body2.get("message") or body2.get("detail") or "").lower()
    assert "access" in detail or "not authorized" in detail or "forbidden" in detail
