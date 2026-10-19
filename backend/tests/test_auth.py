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


def test_forgot_password_flow(client):
    """
    Ensure forgot-password generates a token for registered users
    and returns a clean response even for non-existent users (security).
    """
    # 1. Register a user
    client.post("/api/auth/register", json={
        "full_name": "Reset User",
        "email": "reset@example.com",
        "password": "OldPassword123!",
    })

    # 2. Request forgot-password
    res = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert "reset_token" in data
    assert len(data["reset_token"]) >= 10

    # 3. Request forgot-password for non-existent email
    res2 = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert res2.status_code == 200


def test_reset_password_flow(client):
    """
    Ensure password reset allows setting a new password that works for subsequent logins.
    """
    # 1. Register user
    client.post("/api/auth/register", json={
        "full_name": "Jane Reset",
        "email": "jane@example.com",
        "password": "OldPassword123!",
    })

    # 2. Get reset token
    fp_res = client.post("/api/auth/forgot-password", json={"email": "jane@example.com"})
    token = fp_res.json()["data"]["reset_token"]

    # 3. Reset password with new password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": token,
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

