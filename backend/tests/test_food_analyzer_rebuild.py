"""
Comprehensive Regression & Integrity Test Suite for DiaSense AI Food Analyzer Rebuild.
Directly reproduces and asserts prevention of the following critical failures:
1. Burger image identified as 'Moong Dal Khichdi'.
2. Chicken meal image identified as 'Chapati'.
3. Unconfirmed images receiving fake '65% Match' labels.
4. Fast food/burgers incorrectly assigned 'Diabetic Friendly (Low GI)'.
5. Decoupled 2-stage verification and all 5 result status states.
"""
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.food_analyzer_service import FoodAnalyzerService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def food_service():
    return FoodAnalyzerService()


def generate_synthetic_image(r_mean: int, g_mean: int, b_mean: int, size=(128, 128)) -> bytes:
    """
    Generates synthetic image with specified RGB distribution and realistic pixel variance.
    """
    img = Image.new("RGB", size, color=(r_mean, g_mean, b_mean))
    for x in range(size[0]):
        for y in range(size[1]):
            jitter = ((x * 7 + y * 13) % 70) - 35
            r = min(255, max(0, r_mean + jitter))
            g = min(255, max(0, g_mean + jitter))
            b = min(255, max(0, b_mean + jitter))
            img.putpixel((x, y), (r, g, b))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# CRITICAL REPRODUCTION & PREVENTION TESTS
# ---------------------------------------------------------------------------

def test_burger_image_never_becomes_moong_dal_khichdi(client):
    """
    CRITICAL REGRESSION:
    Previously: RGB mean ~(145, 118, 75) triggered line 403 in _perceptual_visual_analysis:
    'r_mean > 120 and g_mean > 110 and b_mean < 100' -> forced dish = 'Moong Dal Khichdi'.
    NOW: Must NEVER return 'Moong Dal Khichdi' as an identified dish from an image.
    In offline mode, it must require confirmation with candidate choices.
    """
    burger_img = generate_synthetic_image(145, 118, 75)
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("burger_shot.jpg", burger_img, "image/jpeg")},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]

    # Must NOT identify as Moong Dal Khichdi!
    assert data["dish_name"] != "Moong Dal Khichdi"
    assert "Moong Dal Khichdi" not in data["identified_items"]

    # Must NOT have fake 65% match
    assert data.get("confidence_score") != 0.65
    assert data.get("confidence_score") is None

    # Must require confirmation in offline mode
    assert data["status"] == "needs_confirmation"
    assert data["is_ambiguous"] is True
    assert "Burger" in data["candidate_alternatives"]


def test_chicken_meal_never_becomes_chapati(client):
    """
    CRITICAL REGRESSION:
    Previously: RGB mean ~(88, 56, 48) triggered line 415 in _perceptual_visual_analysis:
    'r_mean > 70 and g_mean > 50 and b_mean < 60' -> forced dish = 'Chapati'.
    NOW: Must NEVER return 'Chapati' as an identified dish from an image.
    In offline mode, it must require confirmation with candidate choices.
    """
    chicken_img = generate_synthetic_image(88, 56, 48)
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("chicken_meal.jpg", chicken_img, "image/jpeg")},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]

    # Must NOT identify as Chapati!
    assert data["dish_name"] != "Chapati"
    assert "Chapati" not in data["identified_items"]

    # Must NOT have fake 65% match
    assert data.get("confidence_score") != 0.65
    assert data.get("confidence_score") is None

    # Must require confirmation in offline mode
    assert data["status"] == "needs_confirmation"
    assert data["is_ambiguous"] is True
    assert "Chicken Meal" in data["candidate_alternatives"]


def test_burger_nutrition_is_high_risk_not_diabetic_friendly(client):
    """
    CRITICAL CLINICAL SAFETY:
    Burger has GI 72 and high saturated fats. It must NEVER receive 'Diabetic Friendly' or GI 22.
    It must be classified as 'High Risk / Limit Intake' with color 'red'.
    """
    response = client.post("/api/food/confirm", json={"dish_name": "Burger"})
    assert response.status_code == 200
    res = response.json()
    data = res["data"]

    assert data["average_glycemic_index"] >= 70
    assert data["overall_suitability"] == "High Risk / Limit Intake"
    assert data["suitability_color"] == "red"
    assert data["total_calories_kcal"] >= 400.0


def test_chicken_meal_nutrition_is_diabetic_friendly(client):
    """
    CRITICAL CLINICAL ACCURACY:
    Chicken meal with greens is a low-GI, high-protein meal.
    It must be classified as 'Diabetic Friendly' with color 'emerald' and low GI (25).
    """
    response = client.post("/api/food/confirm", json={"dish_name": "Chicken Meal"})
    assert response.status_code == 200
    res = response.json()
    data = res["data"]

    assert data["average_glycemic_index"] <= 30
    assert data["overall_suitability"] == "Diabetic Friendly"
    assert data["suitability_color"] == "emerald"
    assert data["total_protein_g"] >= 40.0


# ---------------------------------------------------------------------------
# 5 FORMAL RESULT STATES TESTING
# ---------------------------------------------------------------------------

def test_result_state_needs_confirmation(client):
    """Valid image in offline mode triggers status='needs_confirmation'."""
    img_bytes = generate_synthetic_image(120, 100, 90)
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("photo.jpg", img_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "needs_confirmation"
    assert data["total_calories_kcal"] is None
    assert data["is_ambiguous"] is True


def test_result_state_unrecognized_blank_image(client):
    """Solid or blank uniform image triggers status='unrecognized'."""
    blank = Image.new("RGB", (64, 64), color=(255, 255, 255))
    buf = io.BytesIO()
    blank.save(buf, format="JPEG")
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("blank.jpg", buf.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "unrecognized"
    assert data["is_ambiguous"] is True


def test_result_state_invalid_image_empty(client):
    """Empty byte stream triggers 400 Bad Request."""
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400


def test_result_state_invalid_image_corrupted(client):
    """Corrupted non-image data triggers 400 Bad Request."""
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("corrupt.jpg", b"ABCD_NOT_AN_IMAGE_FILE", "image/jpeg")},
    )
    assert response.status_code == 400


def test_result_state_identified_after_confirmation(client):
    """Confirmed dish triggers status='identified' with verified data."""
    response = client.post("/api/food/confirm", json={"dish_name": "Moong Dal Khichdi"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "identified"
    assert data["is_user_confirmed"] is True
    assert data["overall_suitability"] == "Diabetic Friendly"
    assert data["suitability_color"] == "emerald"
    assert data["total_calories_kcal"] == 270.0


def test_result_state_multiple_foods_detected(food_service):
    """Composite meal request identifies multiple components and assigns correct status."""
    res = food_service.get_nutrition_for_dish("Grilled chicken with green salad and chapati")
    assert res.status == "multiple_foods_detected"
    assert len(res.identified_items) >= 2


# ---------------------------------------------------------------------------
# LOCALIZATION & I18N TESTING
# ---------------------------------------------------------------------------

def test_kannada_localization_headers(client):
    """Kannada header returns localized clinical recommendations."""
    response = client.post(
        "/api/food/confirm",
        json={"dish_name": "Burger"},
        headers={"Accept-Language": "kn"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "ಗ್ಲೈಸೆಮಿಕ್" in data["clinical_recommendation"]


def test_hindi_localization_headers(client):
    """Hindi header returns localized clinical recommendations."""
    response = client.post(
        "/api/food/confirm",
        json={"dish_name": "Burger"},
        headers={"Accept-Language": "hi"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "जीआई" in data["clinical_recommendation"]
