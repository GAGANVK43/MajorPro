"""
Automated unit & integration tests for Food Analyzer Engine.
Validates visual feature extraction, fallback handling, text parsing,
and API route response contracts.
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


def create_pattern_dish_image(base_color=(35, 120, 45), size=(100, 100)):
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
    assert data["confidence_score"] >= 0.80


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


def test_image_analysis_green_dish(client):
    """Test image analysis of green dominant image detects green dish candidate."""
    # RGB color dominant in Green: (35, 120, 45)
    img_bytes = create_pattern_dish_image(base_color=(35, 120, 45))
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("camera_shot_123.jpg", img_bytes, "image/jpeg")}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert "Palak Paneer" in data["dish_name"]
    assert data["confidence_score"] > 0
    assert isinstance(data["candidate_alternatives"], list)


def test_image_analysis_yellow_dish(client):
    """Test image analysis of yellow dominant image detects yellow candidate."""
    # RGB color dominant in Yellow: (220, 190, 40)
    img_bytes = create_pattern_dish_image(base_color=(220, 190, 40))
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("upload.png", img_bytes, "image/png")}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["total_calories_kcal"] > 0
    assert data["overall_suitability"] is not None


def test_image_analysis_blank_image_flagged_ambiguous(client):
    """Test uniform blank image is recognized and flagged as ambiguous."""
    blank_bytes = create_solid_color_image(color=(255, 255, 255))
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("white_screen.jpg", blank_bytes, "image/jpeg")}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["is_ambiguous"] is True
    assert data["confidence_score"] < 0.30


def test_image_analysis_corrupted_bytes_fails_safely(client):
    """Test sending non-image corrupted bytes returns 400 Bad Request."""
    corrupted_bytes = b"NOT_A_VALID_IMAGE_DATA_STREAM"
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("corrupted.jpg", corrupted_bytes, "image/jpeg")}
    )
    assert response.status_code == 400
    res = response.json()
    assert res["success"] is False
    assert "message" in res
