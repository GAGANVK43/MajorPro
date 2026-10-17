"""
Automated unit & integration tests for Food Analyzer Engine.
Validates visual feature extraction, honest offline fallback handling,
text parsing, confirmation workflow, and API route response contracts.
"""
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app


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


def create_pattern_dish_image(base_color=(145, 118, 75), size=(100, 100)):
    """Generate image with natural variation so std_dev >= 15.0."""
    img = Image.new("RGB", size, color=base_color)
    for x in range(0, size[0], 5):
        for y in range(0, size[1], 5):
            delta = ((x * 3 + y * 7) % 50) - 25
            r = min(255, max(0, base_color[0] + delta))
            g = min(255, max(0, base_color[1] + delta))
            b = min(255, max(0, base_color[2] + delta))
            img.putpixel((x, y), (r, g, b))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
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


def test_image_analysis_offline_requires_confirmation(client):
    """Test offline image analysis refuses to force random dishes and asks for confirmation."""
    img_bytes = create_pattern_dish_image(base_color=(145, 118, 75))
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("meal_photo.jpg", img_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["status"] == "needs_confirmation"
    assert data["is_ambiguous"] is True
    assert isinstance(data["candidate_alternatives"], list)
    assert len(data["candidate_alternatives"]) > 0
    # Must NOT fabricate 65% match on unconfirmed offline image
    assert data["confidence_score"] is None
    # Calories must be withheld until confirmation
    assert data["total_calories_kcal"] is None


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
