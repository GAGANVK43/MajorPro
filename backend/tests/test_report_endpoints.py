import pytest
from fastapi import status


def test_download_pdf_success_with_bearer_token(client):
    # 1. Register User
    reg_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Report Owner",
            "email": "report_owner@example.com",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    token = reg_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create prediction
    pred_res = client.post(
        "/api/prediction",
        json={
            "age": 45,
            "glucose": 130.0,
            "blood_pressure": 80.0,
            "bmi": 27.5,
        },
        headers=headers,
    )
    assert pred_res.status_code == status.HTTP_200_OK
    pred_id = pred_res.json()["data"]["id"]
    assert pred_id > 0

    # 3. Download PDF using Authorization Bearer header
    pdf_res = client.get(f"/api/reports/{pred_id}/pdf", headers=headers)
    assert pdf_res.status_code == status.HTTP_200_OK
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert f"DiaSense_Health_Report_{pred_id}.pdf" in pdf_res.headers.get("content-disposition", "")
    assert pdf_res.content.startswith(b"%PDF")


def test_download_pdf_success_with_query_token(client):
    # 1. Register User
    reg_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Query Token User",
            "email": "query_token@example.com",
            "password": "Password123!",
        },
    )
    token = reg_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create prediction
    pred_res = client.post(
        "/api/prediction",
        json={"age": 50, "glucose": 140.0, "bmi": 28.0},
        headers=headers,
    )
    pred_id = pred_res.json()["data"]["id"]

    # 3. Download PDF via ?token= query parameter (simulating browser download)
    pdf_res = client.get(f"/api/reports/{pred_id}/pdf?token={token}")
    assert pdf_res.status_code == status.HTTP_200_OK
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")


def test_download_pdf_unauthenticated(client):
    # Unauthenticated attempt must fail with 401
    pdf_res = client.get("/api/reports/1/pdf")
    assert pdf_res.status_code == status.HTTP_401_UNAUTHORIZED


def test_download_pdf_idor_cross_user_forbidden(client):
    # 1. User A creates prediction
    reg_a = client.post(
        "/api/auth/register",
        json={
            "full_name": "User Alpha",
            "email": "alpha_report@example.com",
            "password": "Password123!",
        },
    )
    token_a = reg_a.json()["data"]["access_token"]
    pred_res = client.post(
        "/api/prediction",
        json={"age": 35, "glucose": 110.0, "bmi": 24.0},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    pred_id_a = pred_res.json()["data"]["id"]

    # 2. User B tries to download User A's PDF
    reg_b = client.post(
        "/api/auth/register",
        json={
            "full_name": "User Beta",
            "email": "beta_report@example.com",
            "password": "Password123!",
        },
    )
    token_b = reg_b.json()["data"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    pdf_res = client.get(f"/api/reports/{pred_id_a}/pdf", headers=headers_b)
    # Must deny access with 403 Forbidden
    assert pdf_res.status_code == status.HTTP_403_FORBIDDEN


def test_download_pdf_not_found(client):
    # Authenticated user requests non-existent report ID
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "User NotFound",
            "email": "notfound_report@example.com",
            "password": "Password123!",
        },
    )
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    pdf_res = client.get("/api/reports/999999/pdf", headers=headers)
    assert pdf_res.status_code == status.HTTP_404_NOT_FOUND


def test_get_report_metadata(client):
    # Test GET /api/reports/{id} JSON metadata
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Meta User",
            "email": "meta_report@example.com",
            "password": "Password123!",
        },
    )
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    pred_res = client.post(
        "/api/prediction",
        json={"age": 40, "glucose": 120.0, "bmi": 26.0},
        headers=headers,
    )
    pred_id = pred_res.json()["data"]["id"]

    meta_res = client.get(f"/api/reports/{pred_id}", headers=headers)
    assert meta_res.status_code == status.HTTP_200_OK
    data = meta_res.json()["data"]
    assert data["prediction_id"] == pred_id
    assert "assessment_id" in data
