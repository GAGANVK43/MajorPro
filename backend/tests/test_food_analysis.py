"""
Automated unit & integration tests for Food Analyzer Engine.
Validates automatic visual feature extraction, offline local ML recognition,
text parsing, confirmation workflow, and API route response contracts.
"""
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.ml.train_food_vision_model import generate_class_sample_image
import numpy as np


@pytest.fixture
def client():
    return TestClient(app)


def create_solid_color_image(color=(255, 255, 255), size=(100, 100), fmt="JPEG"):
    """Generate in-memory byte stream of a solid uniform test image."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf.getvalue()


def test_text_analysis_known_staple(client):
    """Test text meal analysis for standard Indian staple."""
    response = client.post("/api/food/analyze-text", json={"query": "Palak Paneer with Roti"})
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert "Palak Paneer" in data["dish_name"]
    assert data["total_calories_kcal"] > 0
    assert data["average_glycemic_index"] > 0
    assert data["overall_suitability"] is not None
    assert isinstance(data["candidate_alternatives"], list)


def test_text_analysis_unknown_safe_estimate(client):
    """Test text analysis handles unlisted food safely without crashing."""
    response = client.post("/api/food/analyze-text", json={"query": "Dragonfruit smoothie bowl"})
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["total_calories_kcal"] > 0
    assert data["confidence_score"] <= 0.65
    assert data["is_ambiguous"] is True


def test_text_analysis_empty_rejects(client):
    """Test empty meal text description triggers validation rejection."""
    response = client.post("/api/food/analyze-text", json={"query": " "})
    assert response.status_code in (400, 422)


def test_image_analysis_automatic_recognition(client):
    """Test image analysis automatically identifies food without mandatory confirmation."""
    rng = np.random.default_rng(42)
    img = generate_class_sample_image("Burger", rng)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("meal_photo.jpg", buf.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["status"] == "identified"
    assert data["dish_name"] == "Burger"
    assert data["total_calories_kcal"] == 460.0
    assert data["average_glycemic_index"] == 72
    assert data["confidence_score"] > 0.50
    assert isinstance(data["candidate_alternatives"], list)


def test_image_analysis_blank_image_flagged_unrecognized(client):
    """Test uniform blank image is recognized and flagged as unrecognized."""
    blank_bytes = create_solid_color_image(color=(255, 255, 255))
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("white_screen.jpg", blank_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["status"] == "unrecognized"
    assert data["is_ambiguous"] is True


def test_image_analysis_corrupted_bytes_fails_safely(client):
    """Test sending non-image corrupted bytes returns 400 Bad Request."""
    corrupted_bytes = b"NOT_A_VALID_IMAGE_DATA_STREAM"
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("corrupted.jpg", corrupted_bytes, "image/jpeg")},
    )
    assert response.status_code == 400
    res = response.json()
    assert res["success"] is False
    assert "message" in res


def test_confirm_endpoint_retrieves_verified_nutrition(client):
    """Test confirmation endpoint retrieves verified clinical nutrition."""
    response = client.post("/api/food/confirm", json={"dish_name": "Burger"})
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert "Burger" in data["dish_name"]
    assert data["status"] == "identified"
    assert data["is_user_confirmed"] is True
    assert data["overall_suitability"] == "High Risk / Limit Intake"
    assert data["suitability_color"] == "red"
    assert data["average_glycemic_index"] == 72
