import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.food_analyzer_service import FoodAnalyzerService


@pytest.fixture
def client():
    return TestClient(app)


def test_provider_status_endpoint(client):
    res = client.get("/api/food/provider-status")
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["success"] is True
    data = json_data["data"]
    assert "is_configured" in data
    assert "provider" in data
    assert data["provider"] == "google_gemini"
    assert "capabilities" in data
    assert data["capabilities"]["nutrition_search"] is True


def test_unconfigured_food_analyzer_image_upload(client):
    # Create valid dummy image
    img = Image.new("RGB", (100, 100), color="green")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("test_greens.jpg", buf, "image/jpeg")},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    # If no GEMINI_API_KEY is configured in test env
    if not data.get("is_configured", False) and data.get("identification_status") == "provider_unconfigured":
        assert data["identification_status"] == "provider_unconfigured"
        assert data["total_calories_kcal"] is None
        assert "GEMINI_API_KEY" in data["warning_message"]
        assert len(data["nutritional_details"]) == 0


def test_empty_image_upload_rejected(client):
    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
    )
    assert res.status_code == 400
    json_data = res.json()
    msg = (json_data.get("message") or json_data.get("detail") or "").lower()
    assert "empty" in msg


def test_invalid_mime_type_rejected(client):
    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
    )
    assert res.status_code == 400


def test_corrupted_image_bytes_rejected(client):
    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("corrupt.jpg", io.BytesIO(b"not an image at all"), "image/jpeg")},
    )
    assert res.status_code == 400


def test_text_nutrition_search_works_without_api_key(client):
    # Nutrition text search uses verified knowledge base
    res = client.post(
        "/api/food/analyze-text",
        json={"query": "roasted chicken"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "chicken" in data["dish_name"].lower()
    assert data["total_calories_kcal"] is not None and data["total_calories_kcal"] > 0
    assert data["overall_suitability"] == "Diabetic Friendly"
    assert data["provenance"] == "verified_database"


def test_provider_status_model_unit():
    service = FoodAnalyzerService(api_key=None)
    status_info = service.get_provider_status()
    assert status_info["is_configured"] is False
    assert status_info["status"] == "unconfigured"
    assert status_info["capabilities"]["image_vision"] is False
    assert status_info["capabilities"]["nutrition_search"] is True

    service_with_key = FoodAnalyzerService(api_key="mock_test_key_12345")
    status_with_key = service_with_key.get_provider_status()
    assert status_with_key["is_configured"] is True
    assert status_with_key["status"] == "configured"
    assert status_with_key["capabilities"]["image_vision"] is True
