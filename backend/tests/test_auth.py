def test_register_and_login_flow(client):
    # 1. Test Registration
    register_payload = {
        "full_name": "Test User",
        "email": "testuser@example.com",
        "password": "Password123!",
        "age": 30,
        "gender": "Male",
    }
    reg_response = client.post("/api/auth/register", json=register_payload)
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert reg_data["success"] is True
    assert "access_token" in reg_data["data"]

    # 2. Test Login
    login_payload = {
        "email": "testuser@example.com",
        "password": "Password123!",
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    token = login_response.json()["data"]["access_token"]
    assert token is not None

    # 3. Test Profile Retrieval
    headers = {"Authorization": f"Bearer {token}"}
    profile_response = client.get("/api/auth/profile", headers=headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["data"]["email"] == "testuser@example.com"


def test_duplicate_registration_prevented(client):
    """
    Ensure attempting to register with an already existing email returns 400
    and a clear message directing the user to login or reset password.
    """
    register_payload = {
        "full_name": "Original User",
        "email": "duplicate@example.com",
        "password": "Password123!",
    }
    r1 = client.post("/api/auth/register", json=register_payload)
    assert r1.status_code == 201

    # Attempt duplicate registration with same email
    dup_payload = {
        "full_name": "Imposter User",
        "email": "duplicate@example.com",
        "password": "DifferentPassword456!",
    }
    r2 = client.post("/api/auth/register", json=dup_payload)
    assert r2.status_code == 400
    data = r2.json()
    error_message = data.get("detail") or data.get("message", "")
    assert "already exists" in error_message.lower()
    assert "logging in" in error_message.lower() or "resetting" in error_message.lower()


def test_login_invalid_credentials(client):
    """
    Ensure login fails with 401 when given invalid credentials.
    """
    login_payload = {
        "email": "nonexistent@example.com",
        "password": "WrongPassword123!",
    }
    res = client.post("/api/auth/login", json=login_payload)
    assert res.status_code == 401


def test_forgot_password_flow(client, db_session):
    """
    Ensure forgot-password:
    1. Accurately reports email delivery status without misleading claims.
    2. Stores a SHA-256 hash of the token in the database (never plaintext).
    3. Provides privacy-preserving responses for nonexistent accounts.
    """
    import hashlib
    from app.models.user import User

    # 1. Register a user
    client.post("/api/auth/register", json={
        "full_name": "Reset User",
        "email": "reset@example.com",
        "password": "OldPassword123!",
    })

    # 2. Request forgot-password with unconfigured SMTP
    res = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert res.status_code == 200
    data = res.json()["data"]

    # Delivery status must accurately report provider state (not fabricated success)
    assert data["email_dispatched"] is False
    assert data["delivery_status"] == "provider_unconfigured"
    assert "dev_diagnostic" in data
    assert "SMTP credentials" in data["dev_diagnostic"]

    raw_token = data.get("dev_reset_token")
    assert raw_token is not None
    assert len(raw_token) >= 20

    # 3. Database check: Verify token is hashed with SHA-256, NEVER stored plaintext
    db_user = db_session.query(User).filter(User.email == "reset@example.com").first()
    assert db_user.reset_token is not None
    # Stored token must NOT equal the raw token
    assert db_user.reset_token != raw_token
    # Stored token MUST equal the sha256 hex digest
    expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    assert db_user.reset_token == expected_hash

    # 4. Request forgot-password for non-existent email (privacy-preserving)
    res2 = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert res2.status_code == 200
    assert res2.json()["data"]["email_dispatched"] is False


def test_reset_password_flow_and_single_use(client, db_session):
    """
    Ensure password reset:
    1. Validates the raw token against the stored SHA-256 hash.
    2. Updates password so new password works and old password fails.
    3. Invalidates the token immediately upon single use (cannot be reused).
    """
    from app.models.user import User

    # 1. Register user
    client.post("/api/auth/register", json={
        "full_name": "Jane Reset",
        "email": "jane@example.com",
        "password": "OldPassword123!",
    })

    # 2. Get reset token
    fp_res = client.post("/api/auth/forgot-password", json={"email": "jane@example.com"})
    raw_token = fp_res.json()["data"]["dev_reset_token"]

    # 3. Reset password with new password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "BrandNewPassword999!",
    })
    assert reset_res.status_code == 200

    # 4. Old password must no longer work
    old_login = client.post("/api/auth/login", json={
        "email": "jane@example.com",
        "password": "OldPassword123!",
    })
    assert old_login.status_code == 401

    # 5. New password must work
    new_login = client.post("/api/auth/login", json={
        "email": "jane@example.com",
        "password": "BrandNewPassword999!",
    })
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()["data"]

    # 6. Single-use guarantee: Reusing the same token must fail with 400
    reuse_res = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherPassword456!",
    })
    assert reuse_res.status_code == 400
    err_text = (reuse_res.json().get("message") or reuse_res.json().get("detail") or "").lower()
    assert "invalid or expired" in err_text

    # 7. Database check: token is cleared
    db_user = db_session.query(User).filter(User.email == "jane@example.com").first()
    assert db_user.reset_token is None
    assert db_user.reset_token_expiry is None


def test_reset_password_expired_token(client, db_session):
    """
    Ensure an expired reset token is strictly rejected.
    """
    from datetime import datetime, timedelta
    from app.models.user import User

    # 1. Register and request reset
    client.post("/api/auth/register", json={
        "full_name": "Expiry User",
        "email": "expiry@example.com",
        "password": "Password123!",
    })
    fp_res = client.post("/api/auth/forgot-password", json={"email": "expiry@example.com"})
    raw_token = fp_res.json()["data"]["dev_reset_token"]

    # 2. Manually backdate expiry in database
    db_user = db_session.query(User).filter(User.email == "expiry@example.com").first()
    db_user.reset_token_expiry = datetime.utcnow() - timedelta(minutes=5)
    db_session.commit()

    # 3. Attempt reset with expired token
    res = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewPassword123!",
    })
    assert res.status_code == 400
    err_text = (res.json().get("message") or res.json().get("detail") or "").lower()
    assert "expired" in err_text


def test_reset_password_invalid_token(client):
    """
    Ensure resetting with an invalid token returns 400.
    """
    res = client.post("/api/auth/reset-password", json={
        "token": "invalid_random_token_12345",
        "new_password": "BrandNewPassword999!",
    })
    assert res.status_code == 400


def test_unauthenticated_protected_route_rejected(client):
    """
    Ensure protected endpoints reject requests without a valid Bearer token.
    """
    res = client.get("/api/auth/profile")
    assert res.status_code == 401

    res_invalid = client.get("/api/auth/profile", headers={"Authorization": "Bearer invalid_token"})
    assert res_invalid.status_code == 401


def test_logout_endpoint(client):
    """
    Ensure logout endpoint succeeds for authenticated users.
    """
    reg = client.post("/api/auth/register", json={
        "full_name": "Logout User",
        "email": "logout@example.com",
        "password": "Password123!",
    })
    token = reg.json()["data"]["access_token"]

    res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200


def test_smtp_mocked_delivery_success(monkeypatch):
    """
    Ensure EmailService correctly dispatches email via SMTP when credentials exist.
    """
    from unittest.mock import MagicMock
    import smtplib
    from app.services.email_service import EmailService

    mock_server = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", MagicMock(return_value=mock_server))
    mock_server.__enter__.return_value = mock_server

    service = EmailService()
    service.smtp_user = "test_sender@diasense.ai"
    service.smtp_password = "mock_app_password"

    result = service.send_password_reset_email(
        email="patient@example.com",
        reset_token="sample_test_token_12345",
        full_name="Patient Test",
    )

    assert result["delivered"] is True
    assert result["status"] == "sent"
    assert result["recipient"] == "patient@example.com"
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("test_sender@diasense.ai", "mock_app_password")
    mock_server.sendmail.assert_called_once()


