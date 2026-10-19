import io
import pytest
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.services.food_analyzer_service import FoodAnalyzerService, FOOD_KNOWLEDGE_BASE
from app.schemas.food_schema import FoodAnalysisResponse, FoodItemNutritionalDetail


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def make_test_image(color="red", size=(64, 64)) -> bytes:
    """Generates valid in-memory JPEG image bytes."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# -------------------------------------------------------------------------
# Test 1: Regression Test for Root Cause — Missing API key must NOT return fake Avocado Quinoa
# -------------------------------------------------------------------------
def test_unconfigured_api_key_returns_truthful_unconfigured_status(client, monkeypatch):
    """
    Ensure that when GEMINI_API_KEY is not configured:
    - The backend does NOT silently guess from filename.
    - The backend does NOT return 'Avocado Quinoa Salad Bowl with Sprouts'.
    - The backend does NOT return fake 320 kcal or 310 kcal.
    - Instead returns identification_status='provider_unconfigured' with None nutrition.
    """
    monkeypatch.setattr("app.config.settings.settings.GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    service = FoodAnalyzerService()
    service.api_key = ""

    img_bytes = make_test_image(color="brown")
    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("unnamed_photo.jpg", img_bytes, "image/jpeg")},
        data={"client_request_id": "req_unconfigured_001"},
    )
    assert res.status_code == 200
    data = res.json()["data"]

    # Must be provider_unconfigured
    assert data["identification_status"] == "provider_unconfigured"
    assert data["provenance"] == "unavailable"
    assert data["nutrition_status"] == "unavailable"
    assert data["total_calories_kcal"] is None
    assert data["total_carbohydrates_g"] is None

    # Must NEVER return the hardcoded fake Avocado Quinoa Salad Bowl
    assert "avocado quinoa" not in data["dish_name"].lower()
    assert data["request_id"] == "req_unconfigured_001"
    assert data["image_hash"] is not None


# -------------------------------------------------------------------------
# Test 2: Consecutive Image A and Image B Uploads (The Exact User Bug)
# -------------------------------------------------------------------------
def test_specific_regression_chicken_image_does_not_return_avocado_quinoa(client, monkeypatch):
    """
    Exact reproduction of the user's reported bug:
    Image A: User analyzes an image that returned 'Avocado Quinoa Salad Bowl With Sprouts'.
    Image B: User uploads a roasted chicken dish.
    Assert:
    - Image B returns 'Roasted Chicken with Green Beans'.
    - Image B returns 380 kcal, 14g carbs, 46g protein, GI 25.
    - Absolutely no stale values (320 kcal, 28g carbs, 'Avocado Quinoa') leak into Result B!
    """
    img_a_bytes = make_test_image(color="green")
    img_b_bytes = make_test_image(color="goldenrod")

    # Mock Vision responses for Image A vs Image B
    resp_a = FoodAnalysisResponse(
        dish_name="Avocado Quinoa Salad Bowl with Sprouts",
        identified_items=["Avocado Quinoa Salad"],
        total_calories_kcal=320.0,
        total_carbohydrates_g=28.0,
        total_net_carbs_g=18.5,
        total_protein_g=14.0,
        total_fiber_g=9.5,
        total_fats_g=16.0,
        average_glycemic_index=22,
        overall_suitability="Diabetic Friendly",
        suitability_color="emerald",
        suggested_portion="1 bowl (250g)",
        request_id="req_img_a_111",
        confidence_score=0.92,
        identification_status="identified",
        provenance="ai_vision",
        nutrition_status="verified",
        clinical_recommendation="High fiber, low GI meal.",
    )

    resp_b = FoodAnalysisResponse(
        dish_name="Roasted Chicken with Green Beans",
        identified_items=["Roasted chicken", "Green beans", "Side potato"],
        total_calories_kcal=380.0,
        total_carbohydrates_g=14.0,
        total_net_carbs_g=9.5,
        total_protein_g=46.0,
        total_fiber_g=4.5,
        total_fats_g=15.0,
        average_glycemic_index=25,
        overall_suitability="Diabetic Friendly",
        suitability_color="emerald",
        suggested_portion="1 plate roasted chicken with greens (250g)",
        request_id="req_img_b_222",
        confidence_score=0.94,
        identification_status="identified",
        provenance="ai_vision",
        nutrition_status="verified",
        clinical_recommendation="High protein lean poultry meal.",
    )

    call_count = {"count": 0}

    def mock_query_vision(*args, **kwargs):
        call_count["count"] += 1
        client_request_id = kwargs.get("client_request_id")
        if call_count["count"] == 1:
            r = resp_a.model_copy()
            r.request_id = client_request_id
            return r
        else:
            r = resp_b.model_copy()
            r.request_id = client_request_id
            return r

    monkeypatch.setattr(
        "app.services.food_analyzer_service.FoodAnalyzerService._query_gemini_image_vision",
        mock_query_vision,
    )
    monkeypatch.setattr("app.config.settings.settings.GEMINI_API_KEY", "test-dummy-gemini-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-dummy-gemini-key")

    # 1. Upload Image A
    res_a = client.post(
        "/api/food/analyze-image",
        files={"file": ("photo_a.jpg", img_a_bytes, "image/jpeg")},
        data={"client_request_id": "req_img_a_111"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()["data"]
    assert data_a["dish_name"] == "Avocado Quinoa Salad Bowl with Sprouts"
    assert data_a["total_calories_kcal"] == 320.0
    assert data_a["total_carbohydrates_g"] == 28.0
    assert data_a["total_protein_g"] == 14.0
    assert data_a["request_id"] == "req_img_a_111"

    # 2. Upload Image B (roasted chicken)
    res_b = client.post(
        "/api/food/analyze-image",
        files={"file": ("photo_b.jpg", img_b_bytes, "image/jpeg")},
        data={"client_request_id": "req_img_b_222"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()["data"]

    # Verify Dish B and its nutrition completely replace Dish A
    assert data_b["dish_name"] == "Roasted Chicken with Green Beans"
    assert data_b["total_calories_kcal"] == 380.0
    assert data_b["total_carbohydrates_g"] == 14.0
    assert data_b["total_protein_g"] == 46.0
    assert data_b["average_glycemic_index"] == 25
    assert data_b["request_id"] == "req_img_b_222"

    # Strict assertion: NO stale values from Image A remain!
    assert data_b["total_calories_kcal"] != 320.0
    assert data_b["total_carbohydrates_g"] != 28.0
    assert data_b["total_protein_g"] != 14.0
    assert "avocado" not in data_b["dish_name"].lower()


# -------------------------------------------------------------------------
# Test 3: Failed second request does not leave Image A's data as success
# -------------------------------------------------------------------------
def test_failed_second_request_produces_error_status(client, monkeypatch):
    """
    If Image A succeeds and Image B fails (e.g. vision provider error),
    Image B must return error status, not Dish A's data.
    """
    img_bytes = make_test_image(color="blue")

    def mock_query_fail(*args, **kwargs):
        return None  # Vision provider returns None on failure

    monkeypatch.setattr(
        "app.services.food_analyzer_service.FoodAnalyzerService._query_gemini_image_vision",
        mock_query_fail,
    )
    monkeypatch.setattr("app.config.settings.settings.GEMINI_API_KEY", "test-key-123")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")

    res = client.post(
        "/api/food/analyze-image",
        files={"file": ("photo_fail.jpg", img_bytes, "image/jpeg")},
        data={"client_request_id": "req_fail_002"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["identification_status"] == "provider_error"
    assert data["total_calories_kcal"] is None
    assert data["dish_name"] == "Unable to Identify Food Image"


# -------------------------------------------------------------------------
# Test 4: Invalid, empty, or corrupted image rejection
# -------------------------------------------------------------------------
def test_invalid_image_files_rejected(client):
    """
    Ensure corrupted or non-image files are rejected with HTTP 400.
    """
    # 1. Non-image file extension / content-type
    res_text = client.post(
        "/api/food/analyze-image",
        files={"file": ("test.txt", b"plain text content", "text/plain")},
    )
    assert res_text.status_code == 400

    # 2. Empty file
    res_empty = client.post(
        "/api/food/analyze-image",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert res_empty.status_code == 400

    # 3. Corrupt image bytes with image/jpeg header
    res_corrupt = client.post(
        "/api/food/analyze-image",
        files={"file": ("corrupt.jpg", b"corrupted bytes not an image", "image/jpeg")},
    )
    assert res_corrupt.status_code == 400
    err_body = res_corrupt.json()
    err_msg = (err_body.get("detail") or err_body.get("message") or "").lower()
    assert "not a valid" in err_msg


# -------------------------------------------------------------------------
# Test 5: Unknown dish in meal text search must NOT receive invented nutrition
# -------------------------------------------------------------------------
def test_unknown_dish_does_not_invent_fake_nutrition(client, monkeypatch):
    """
    If a dish is unknown and no AI key is configured,
    the service must return None for nutrition values rather than invented 310 kcal / 28g carbs.
    """
    monkeypatch.setattr("app.config.settings.settings.GEMINI_API_KEY", "")
    res = client.post("/api/food/analyze-text", json={"query": "Xylitol Martian Stew"})
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["identification_status"] == "unrecognized"
    assert data["nutrition_status"] == "unavailable"
    assert data["total_calories_kcal"] is None
    assert data["total_carbohydrates_g"] is None
    assert data["total_protein_g"] is None
    assert data["average_glycemic_index"] is None


# -------------------------------------------------------------------------
# Test 6: Word-boundary matching prevents partial substring collisions
# -------------------------------------------------------------------------
def test_token_boundary_prevents_partial_substring_collisions(client):
    """
    Ensure 'licorice' does not match 'rice',
    and 'pan' does not match 'palak paneer'.
    """
    service = FoodAnalyzerService()
    service.api_key = ""

    # "licorice" must NOT match "brown rice"
    res_licorice = service.analyze_meal_text("licorice")
    assert res_licorice.identification_status == "unrecognized"
    assert res_licorice.total_calories_kcal is None

    # Exact "brown rice" MUST match verified database
    res_rice = service.analyze_meal_text("brown rice")
    assert res_rice.identification_status == "identified"
    assert res_rice.total_calories_kcal == 215.0
    assert res_rice.provenance == "verified_database"


# -------------------------------------------------------------------------
# Test 7: Multiple consecutive uploads work reliably
# -------------------------------------------------------------------------
def test_multiple_consecutive_uploads_work(client, monkeypatch):
    """
    Verify 3 consecutive uploads return their respective unique request IDs and hashes.
    """
    colors = ["red", "green", "blue"]
    for i, color in enumerate(colors):
        img_bytes = make_test_image(color=color)
        req_id = f"req_consecutive_{i}"
        res = client.post(
            "/api/food/analyze-image",
            files={"file": (f"img_{i}.jpg", img_bytes, "image/jpeg")},
            data={"client_request_id": req_id},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["request_id"] == req_id
        assert data["image_hash"] is not None
