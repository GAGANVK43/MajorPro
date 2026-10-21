"""
Comprehensive Automated Regression Tests for:
1. Assessment History Report Binding and Authorization (IDOR protection, 404, exact prediction preservation).
2. DiaSense AI Chatbot Conversational Intelligence (Name statement, history memory, profile memory, BMI, emergency safeguard, out-of-scope).
"""
import pytest
from app.models.assessment import Assessment
from app.models.prediction import Prediction
from app.models.diet_plan import DietPlan


def test_get_prediction_by_id_authorized(client, db_session):
    """
    Verify GET /api/prediction/{id} returns the exact historical prediction
    and localized factors for the authorized user.
    """
    # 1. Register User A
    reg = client.post("/api/auth/register", json={
        "full_name": "Gagan Kumar",
        "email": "gagan.history@example.com",
        "password": "Password123!",
        "gender": "Male"
    })
    assert reg.status_code == 201
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve user ID
    prof = client.get("/api/user/profile", headers=headers)
    assert prof.status_code == 200
    user_id = prof.json()["data"]["id"]

    # 2. Insert a historical Diabetic assessment + prediction directly
    assessment = Assessment(
        user_id=user_id,
        patient_group="Urban",
        gender="Male",
        age=52,
        bmi=31.5,
        blood_pressure=145.0,
        hba1c=8.2,
        fasting_glucose=168.0,
        physical_activity_hours=1.0,
        daily_sugar_intake=45.0,
        fast_food_frequency=4.0,
        sleep_hours=6.0,
        family_history=1.0,
        monthly_income=65000.0,
        month=6.0,
    )
    db_session.add(assessment)
    db_session.commit()
    db_session.refresh(assessment)

    prediction = Prediction(
        assessment_id=assessment.id,
        prediction="Diabetic",
        risk_percentage=78.5,
        confidence=96.2,
    )
    db_session.add(prediction)
    db_session.commit()
    db_session.refresh(prediction)

    diet = DietPlan(
        prediction_id=prediction.id,
        breakfast="Oats & Ragi Dosa",
        lunch="Moong Dal & Spinach Khichdi",
        dinner="Palak Paneer with Bajra Roti",
        snacks="Roasted Makhana",
        exercise="30-45 mins Brisk Walking",
        tips="Limit polished white rice",
    )
    db_session.add(diet)
    db_session.commit()

    # 3. Retrieve specific historical prediction by ID
    res = client.get(f"/api/prediction/{prediction.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    # Verify data matches historical Diabetic assessment exactly (never overridden by default or latest)
    assert data["id"] == prediction.id
    assert data["assessment_id"] == assessment.id
    assert data["prediction"] == "Diabetic"
    assert data["risk_percentage"] == 78.5
    assert data["confidence"] == 96.2
    assert "recommendation" in data
    assert len(data["contributing_factors"]) > 0


def test_get_prediction_by_id_idor_forbidden(client, db_session):
    """
    Verify GET /api/prediction/{id} returns 403 Forbidden when a user
    attempts to view another patient's historical assessment report.
    """
    # 1. Register User A
    reg_a = client.post("/api/auth/register", json={
        "full_name": "Patient Alpha",
        "email": "alpha@example.com",
        "password": "Password123!",
        "gender": "Male"
    })
    assert reg_a.status_code == 201
    token_a = reg_a.json()["data"]["access_token"]
    prof_a = client.get("/api/user/profile", headers={"Authorization": f"Bearer {token_a}"})
    user_a_id = prof_a.json()["data"]["id"]

    # 2. Register User B
    reg_b = client.post("/api/auth/register", json={
        "full_name": "Patient Beta",
        "email": "beta@example.com",
        "password": "Password123!",
        "gender": "Female"
    })
    assert reg_b.status_code == 201
    token_b = reg_b.json()["data"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Create assessment for User A
    assessment_a = Assessment(
        user_id=user_a_id,
        patient_group="Urban",
        gender="Male",
        age=45,
        bmi=26.0,
        blood_pressure=125.0,
        hba1c=6.0,
        fasting_glucose=110.0,
    )
    db_session.add(assessment_a)
    db_session.commit()
    db_session.refresh(assessment_a)

    prediction_a = Prediction(
        assessment_id=assessment_a.id,
        prediction="Non-Diabetic",
        risk_percentage=22.0,
        confidence=94.0,
    )
    db_session.add(prediction_a)
    db_session.commit()
    db_session.refresh(prediction_a)

    # 4. User B requests User A's prediction -> must be 403 Forbidden
    res = client.get(f"/api/prediction/{prediction_a.id}", headers=headers_b)
    assert res.status_code == 403
    msg = str(res.json()).lower()
    assert "access denied" in msg


def test_get_prediction_by_id_not_found(client):
    """
    Verify GET /api/prediction/99999 returns 404 Not Found.
    """
    reg = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "notfound@example.com",
        "password": "Password123!",
    })
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/prediction/99999", headers=headers)
    assert res.status_code == 404


def test_chatbot_name_statement_greeting(client):
    """
    Verify when user says "My name is Gagan.", the chatbot addresses them warmly
    and asks how it can help, rather than returning generic diet advice.
    """
    res = client.post("/api/chatbot/query", json={
        "message": "My name is Gagan."
    })
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "Gagan" in reply
    assert "DiaSense AI" in reply
    # Must NOT return oats/ragi generic fallback
    assert "prioritize low-GI complex carbohydrates (Oats, Ragi" not in reply


def test_chatbot_name_recall_from_history(client):
    """
    Verify multi-turn memory: when user asks "What is my name?" with conversation history,
    the chatbot recalls their name.
    """
    res = client.post("/api/chatbot/query", json={
        "message": "What is my name?",
        "history": [
            {"role": "user", "text": "My name is Gagan."},
            {"role": "assistant", "text": "Hello Gagan! How can I help you today?"}
        ]
    })
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "Gagan" in reply


def test_chatbot_profile_name_recall(client):
    """
    Verify when an authenticated user asks "Who am I?", the chatbot recalls their account name.
    """
    reg = client.post("/api/auth/register", json={
        "full_name": "Priya Nair",
        "email": "priya.nair@example.com",
        "password": "Password123!",
        "gender": "Female"
    })
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/chatbot/query", json={
        "message": "Who am I?"
    }, headers=headers)
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "Priya Nair" in reply


def test_chatbot_bmi_explanation(client):
    """
    Verify clinical explanation for "What is BMI?".
    """
    res = client.post("/api/chatbot/query", json={
        "message": "What is BMI?"
    })
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "Body Mass Index" in reply or "BMI" in reply
    assert "kg/m" in reply


def test_chatbot_out_of_scope_query(client):
    """
    Verify out-of-scope handling for non-health queries like "What is the capital of France?".
    """
    res = client.post("/api/chatbot/query", json={
        "message": "What is the capital of France?"
    })
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "DiaSense AI" in reply
    assert "programming" in reply or "trivia" in reply or "specialized" in reply


def test_chatbot_emergency_safeguard(client):
    """
    Verify emergency clinical safeguard triggers for chest pain / acute crises.
    """
    res = client.post("/api/chatbot/query", json={
        "message": "I have severe chest pain and passed out"
    })
    assert res.status_code == 200
    reply = res.json()["data"]["reply"]
    assert "108" in reply or "emergency" in reply.lower()
