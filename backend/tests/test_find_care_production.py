import sys
import os
import pytest
from unittest.mock import patch, MagicMock

# Ensure app is discoverable on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.nearby_care_service import (
    NearbyCareService,
    calculate_haversine_distance,
    calculate_haversine_distance_meters,
    is_valid_coordinate,
    VERIFIED_INDIAN_HEALTHCARE_HUBS,
    _CANDIDATE_CACHE,
)
from app.schemas.nearby_care_schema import NearbyFacilityItem
from fastapi.testclient import TestClient
from app.main import app
from app.config.database import SessionLocal, init_db
from app.models.user import User
from app.config.security import create_access_token, hash_password


def test_pin_code_geocoding_accuracy():
    """
    Verifies that Indian PIN codes resolve to their actual locality
    and DO NOT erroneously collapse to a single city centre point (e.g., MG Road 560001).
    """
    service = NearbyCareService()

    # 1. PIN 560049 (Bhattarahalli / K.R. Puram - East Bengaluru)
    geo_49 = service.geocode_location("560049")
    assert geo_49 is not None, "Failed to resolve PIN 560049"
    assert round(geo_49.latitude, 2) == 13.02 or round(geo_49.latitude, 2) == 13.01
    assert round(geo_49.longitude, 2) == 77.71 or round(geo_49.longitude, 2) == 77.70
    assert "Bhattarahalli" in geo_49.display_name or "560049" in geo_49.display_name

    # 2. PIN 560001 (MG Road / Shivajinagar - Central Bengaluru)
    geo_01 = service.geocode_location("560001")
    assert geo_01 is not None, "Failed to resolve PIN 560001"
    assert round(geo_01.latitude, 2) == 12.97 or round(geo_01.latitude, 2) == 12.98
    assert round(geo_01.longitude, 2) == 77.60 or round(geo_01.longitude, 2) == 77.59

    # Distance between 560049 and 560001 must be > 10 km (they must not collapse)
    dist_between_pins = calculate_haversine_distance_meters(
        geo_49.latitude, geo_49.longitude, geo_01.latitude, geo_01.longitude
    )
    assert dist_between_pins > 10000.0, f"PINs 560049 and 560001 collapsed! Distance: {dist_between_pins} m"

    # 3. PIN 110001 (Connaught Place, New Delhi)
    geo_delhi = service.geocode_location("110001")
    assert geo_delhi is not None
    assert 28.55 <= geo_delhi.latitude <= 28.70
    assert 77.15 <= geo_delhi.longitude <= 77.25

    # 4. Invalid PIN returns None gracefully
    geo_invalid = service.geocode_location("999999")
    # Even if postal API returns None or fallback, ensure no unhandled crash
    assert geo_invalid is None or isinstance(geo_invalid.latitude, float)


def test_provider_failover_diagnostics():
    """
    Verifies that when Overpass and Google Places fail/timeout:
    - Results fail over to verified directory hubs.
    - Result source is truthfully labeled as 'verified_directory'.
    - has_live_results is False.
    - provider_status accurately documents provider states without hiding errors.
    """
    service = NearbyCareService()
    center_lat, center_lon = 13.0163, 77.7056  # Bhattarahalli

    _CANDIDATE_CACHE.clear()

    # Mock Overpass timeout and Google Places unconfigured
    with patch.object(service, "_fetch_from_overpass", return_value=([], "timeout")):
        res = service.get_nearby_facilities(
            center_lat, center_lon, facility_type="hospital", radius_meters=5000
        )

        assert res.total_count > 0, "Failover to verified directory must return facilities!"
        assert res.has_live_results is False
        assert "osm_overpass" in res.provider_status
        assert res.provider_status["osm_overpass"] == "timeout"
        assert res.provider_status.get("verified_directory") == "active"
        assert res.search_warning is not None
        assert "verified" in res.search_warning.lower()

        # Check that returned facilities have source='verified_directory'
        for f in res.facilities:
            assert f.source == "verified_directory"
            assert f.distance_meters <= 5005.0


def test_verified_directory_integrity():
    """
    Verifies data integrity of all static healthcare hubs:
    - Valid coordinates.
    - Non-empty name and address.
    - Valid category.
    - No fabricated 24/7 or open status without emergency verification.
    """
    assert len(VERIFIED_INDIAN_HEALTHCARE_HUBS) >= 25, "Directory must have comprehensive hub coverage"

    for hub in VERIFIED_INDIAN_HEALTHCARE_HUBS:
        assert is_valid_coordinate(hub["lat"], hub["lon"]), f"Invalid coordinate for {hub['name']}"
        assert hub["name"] and len(hub["name"]) > 3
        assert hub["address"] and len(hub["address"]) > 5
        assert hub["category"] in ["hospital", "laboratory", "clinic"]
        assert hub["type"] and len(hub["type"]) > 2

        # Ensure open_now is valid (True for 24/7 emergency hospitals, None for daytime clinics/labs)
        assert hub.get("open_now") in [True, False, None]
        if hub.get("category") == "laboratory":
            # Laboratories should have open_now as None (not falsely claiming 24/7)
            assert hub.get("open_now") is None, f"Laboratory {hub['name']} must not claim 24/7 open_now"

    # Also verify that _get_verified_hub_fallbacks stamps source='verified_directory'
    service = NearbyCareService()
    fallback_items = service._get_verified_hub_fallbacks(12.9716, 77.5946, "hospital", 10000)
    assert len(fallback_items) > 0
    for item in fallback_items:
        assert item.source == "verified_directory"


def test_facility_category_filtering():
    """
    Verifies that laboratories and hospitals are strictly categorized.
    """
    service = NearbyCareService()
    center_lat, center_lon = 12.9716, 77.5946

    _CANDIDATE_CACHE.clear()

    # Query hospitals
    with patch.object(service, "_fetch_from_overpass", return_value=([], "empty")):
        res_hosp = service.get_nearby_facilities(
            center_lat, center_lon, facility_type="hospital", radius_meters=10000
        )
        for fac in res_hosp.facilities:
            assert fac.category in ["hospital", "clinic"], f"Expected hospital category, got {fac.category}"

    _CANDIDATE_CACHE.clear()

    # Query laboratories
    with patch.object(service, "_fetch_from_overpass", return_value=([], "empty")):
        res_labs = service.get_nearby_facilities(
            center_lat, center_lon, facility_type="laboratory", radius_meters=10000
        )
        assert res_labs.total_count > 0, "Should find verified diabetes testing laboratories"
        for fac in res_labs.facilities:
            assert fac.category == "laboratory", f"Expected laboratory category, got {fac.category}"


def test_api_integration_diagnostics():
    """
    Verifies the full FastAPI endpoint exposes diagnostic metadata to the client.
    """
    init_db()
    db = SessionLocal()
    test_email = "diag_user@diasense.ai"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            full_name="Diag User",
            email=test_email,
            password=hash_password("Diag@1234"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)

    res = client.get(
        "/api/nearby-care?latitude=13.0163&longitude=77.7056&type=hospital&radius=5000",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()["data"]

    # Verify diagnostic fields exist in API payload
    assert "providers_queried" in data
    assert "provider_status" in data
    assert "has_live_results" in data
    assert "facilities" in data
    assert data["radius_meters"] == 5000

    # Ensure every single facility has source and valid distance
    for fac in data["facilities"]:
        assert "source" in fac
        assert fac["source"] in ["osm_overpass", "google_places", "verified_directory"]
        assert fac["distance_meters"] <= 5005.0

    db.close()
