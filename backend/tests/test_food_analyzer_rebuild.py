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
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.food_analyzer_service import FoodAnalyzerService
from app.ml.train_food_vision_model import generate_class_sample_image


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def food_service():
    return FoodAnalyzerService()


def generate_food_image_bytes(class_name: str, seed: int = 42) -> bytes:
    """
    Generates realistic food image bytes adhering to authentic spatial, texture, and color features.
    """
    rng = np.random.default_rng(seed)
    img = generate_class_sample_image(class_name, rng)
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
    Previously: Color heuristic forced dish = 'Moong Dal Khichdi' with fake 65% match.
    NOW: Must NEVER return 'Moong Dal Khichdi'.
    Must automatically identify 'Burger' with high calibrated confidence and clinical nutrition.
    """
    burger_img = generate_food_image_bytes("Burger", seed=101)
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

    # Must accurately identify as Burger
    assert data["dish_name"] == "Burger"

    # Must NOT have fake 65% match; must have authentic calibrated confidence
    assert data.get("confidence_score") != 0.65
    assert data.get("confidence_score") is not None
    assert data["confidence_score"] > 0.70

    # Automatic flow: status is identified directly without mandatory confirmation
    assert data["status"] == "identified"
    assert data["total_calories_kcal"] == 460.0
    assert data["average_glycemic_index"] >= 70
    assert data["overall_suitability"] == "High Risk / Limit Intake"
    assert data["suitability_color"] == "red"


def test_chicken_meal_never_becomes_chapati(client):
    """
    CRITICAL REGRESSION:
    Previously: Color heuristic forced dish = 'Chapati' with fake 65% match.
    NOW: Must NEVER return 'Chapati'.
    Must automatically identify 'Chicken Meal' with high calibrated confidence and clinical nutrition.
    """
    chicken_img = generate_food_image_bytes("Chicken Meal", seed=202)
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

    # Must accurately identify as Chicken Meal
    assert data["dish_name"] == "Chicken Meal"

    # Must NOT have fake 65% match
    assert data.get("confidence_score") != 0.65
    assert data.get("confidence_score") is not None
    assert data["confidence_score"] > 0.70

    # Automatic flow: status is identified directly without mandatory confirmation
    assert data["status"] == "identified"
    assert data["total_calories_kcal"] == 420.0
    assert data["overall_suitability"] == "Diabetic Friendly"
    assert data["suitability_color"] == "emerald"
    assert data["total_protein_g"] >= 40.0


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

def test_automatic_analysis_without_mandatory_confirmation(client):
    """Uploaded food image automatically identifies meal without blocking confirmation screen."""
    img_bytes = generate_food_image_bytes("Burger", seed=303)
    response = client.post(
        "/api/food/analyze-image",
        files={"file": ("photo.jpg", img_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "identified"
    assert data["dish_name"] == "Burger"
    assert data["total_calories_kcal"] == 460.0
    assert data["confidence_score"] > 0.50
    assert data["detection_source"] == "local_ml_vision"
    assert "Burger" in [data["dish_name"]] + data.get("candidate_alternatives", [])


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
