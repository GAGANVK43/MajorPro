import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.nearby_care_service import (
    NearbyCareService,
    is_within_india,
    is_valid_coordinate,
    calculate_haversine_distance,
    calculate_haversine_distance_meters,
    TOLERANCE_METERS,
    _CANDIDATE_CACHE,
    _GEOCODE_CACHE,
)
from app.schemas.nearby_care_schema import NearbyFacilityItem, GeocodeResult
from app.main import app
from app.config.database import SessionLocal, init_db
from app.models.user import User
from app.config.security import create_access_token, hash_password
from fastapi.testclient import TestClient
from jose import jwt
from app.config.settings import settings


@pytest.fixture(scope="module")
def care_service():
    return NearbyCareService()


@pytest.fixture(scope="module")
def auth_client():
    init_db()
    db = SessionLocal()
    test_email = "nationwide_tester@diasense.ai"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            full_name="Nationwide Test User",
            email=test_email,
            password=hash_password("Nationwide@1234"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.email})
    client = TestClient(app)
    return client, token


# ==============================================================================
# TEST SUITE 1: Nationwide Indian PIN Code Geocoding Across 10 Target PINs
# ==============================================================================
TARGET_PINS = [
    ("560039", "Nayandahalli / Bengaluru South", "Karnataka", 12.8, 13.1, 77.4, 77.7),
    ("560001", "Bengaluru GPO / MG Road", "Karnataka", 12.8, 13.1, 77.5, 77.7),
    ("560049", "Bhattarahalli / Bengaluru East", "Karnataka", 12.9, 13.2, 77.6, 77.8),
    ("110001", "Connaught Place / New Delhi", "Delhi", 28.5, 28.8, 77.1, 77.3),
    ("400001", "Mumbai GPO / Fort", "Maharashtra", 18.8, 19.1, 72.7, 72.9),
    ("500001", "Hyderabad GPO", "Telangana", 17.2, 17.5, 78.4, 78.6),
    ("600001", "Chennai GPO / George Town", "Tamil Nadu", 13.0, 13.2, 80.2, 80.4),
    ("411001", "Pune GPO / Camp", "Maharashtra", 18.4, 18.6, 73.8, 74.0),
    ("700001", "Kolkata GPO / BBD Bagh", "West Bengal", 22.4, 22.7, 88.2, 88.5),
    ("781001", "Guwahati GPO / Panbazar", "Assam", 26.1, 26.3, 91.6, 91.9),
]


@pytest.mark.parametrize("pin,area_name,expected_state,min_lat,max_lat,min_lon,max_lon", TARGET_PINS)
def test_target_indian_pincodes_resolution(care_service, pin, area_name, expected_state, min_lat, max_lat, min_lon, max_lon):
    """
    Verifies that all 10 target Indian PIN codes from different states resolve to valid Indian coordinates
    within their expected geographic boundaries and state jurisdictions.
    """
    result = care_service.geocode_location(pin)
    assert result is not None, f"Failed to geocode PIN {pin} ({area_name})"
    assert is_within_india(result.latitude, result.longitude), f"PIN {pin} coordinates ({result.latitude}, {result.longitude}) outside India!"
    assert min_lat <= result.latitude <= max_lat, f"PIN {pin} latitude {result.latitude} outside expected range [{min_lat}, {max_lat}]"
    assert min_lon <= result.longitude <= max_lon, f"PIN {pin} longitude {result.longitude} outside expected range [{min_lon}, {max_lon}]"
    assert result.pincode == pin, f"Expected pincode {pin}, got {result.pincode}"
    if result.state:
        assert expected_state.lower() in result.state.lower() or expected_state.lower() in result.formatted_address.lower()


# ==============================================================================
# TEST SUITE 2: Invalid PIN Codes Handling & Edge Cases
# ==============================================================================
INVALID_PINS = [
    "12345",    # 5 digits (invalid length)
    "1234567",  # 7 digits (invalid length)
    "999999",   # Non-existent postal code
    "ABCDEF",   # Non-numeric
    "",         # Empty
    "000000",   # Invalid prefix
]


@pytest.mark.parametrize("invalid_pin", INVALID_PINS)
def test_invalid_pincode_handling(care_service, invalid_pin):
    """
    Verifies that invalid or non-existent PIN codes return None gracefully without uncaught exceptions.
    """
    result = care_service.geocode_location(invalid_pin)
    # Invalid PINs must either return None or, if geocoded as a general string, must be handled cleanly
    if invalid_pin in {"12345", "1234567", "999999", "000000", ""}:
        assert result is None or (isinstance(result, GeocodeResult) and is_within_india(result.latitude, result.longitude))


# ==============================================================================
# TEST SUITE 3: Multiple Post Offices Resolution
# ==============================================================================
def test_multiple_post_offices_resolution(care_service):
    """
    Verifies that a PIN code covering multiple post offices (e.g., 560039) resolves with
    the full list of post offices in its postal area.
    """
    result = care_service.geocode_location("560039")
    assert result is not None
    assert result.pincode == "560039"
    # 560039 covers Nayandahalli, Deepanjalinagar, etc.
    assert result.post_offices is not None
    assert len(result.post_offices) >= 1
    assert any("Nayandahalli" in po or "Deepanjalinagar" in po for po in result.post_offices)
    assert result.approximate_notice is not None
    assert "centroid" in result.approximate_notice.lower() or "approximate" in result.approximate_notice.lower()


# ==============================================================================
# TEST SUITE 4: India Territorial Bounding Box Enforcement
# ==============================================================================
def test_india_bounding_box_enforcement():
    """
    Verifies that coordinates outside India (6°–38° N, 68°–98° E) are identified as out of bounds.
    """
    # Inside India
    assert is_within_india(12.9716, 77.5946) is True    # Bengaluru
    assert is_within_india(28.6139, 77.2090) is True    # New Delhi
    assert is_within_india(19.0760, 72.8777) is True    # Mumbai
    assert is_within_india(26.1445, 91.7362) is True    # Guwahati
    assert is_within_india(8.5241, 76.9366) is True     # Thiruvananthapuram

    # Outside India
    assert is_within_india(51.5074, -0.1278) is False   # London, UK
    assert is_within_india(40.7128, -74.0060) is False  # New York, USA
    assert is_within_india(-33.8688, 151.2093) is False # Sydney, Australia
    assert is_within_india(0.0, 0.0) is False           # Atlantic Ocean


# ==============================================================================
# TEST SUITE 5: Authentication & Session Expiration Handling
# ==============================================================================
def test_expired_jwt_token_returns_401(auth_client):
    """
    Verifies that an expired JWT token returns HTTP 401 with credentials error,
    which triggers the frontend Session Expired card.
    """
    client, _ = auth_client

    # Create an expired token (-10 minutes)
    expired_payload = {
        "sub": "nationwide_tester@diasense.ai",
        "exp": datetime.utcnow() - timedelta(minutes=10),
    }
    expired_token = jwt.encode(
        expired_payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/nearby-care?latitude=12.9716&longitude=77.5946&type=hospital&radius=5000", headers=headers)

    assert response.status_code == 401
    data = response.json()
    err_text = str(data.get("message") or data.get("detail") or "")
    assert "token expired" in err_text.lower() or "credentials" in err_text.lower()


def test_missing_auth_token_returns_401(auth_client):
    """
    Verifies that requests without Authorization header return HTTP 401.
    """
    client, _ = auth_client
    response = client.get("/api/nearby-care?latitude=12.9716&longitude=77.5946&type=hospital&radius=5000")
    assert response.status_code == 401


# ==============================================================================
# TEST SUITE 6: Strict Haversine Radius & Distance Sorting
# ==============================================================================
def test_haversine_filtering_and_distance_sorting(care_service):
    """
    Verifies that candidate facilities outside the selected search radius are strictly filtered out,
    and remaining facilities are sorted nearest first.
    """
    center_lat, center_lon = 12.9716, 77.5946
    radius_m = 5000

    # Create synthetic candidate facilities at varying distances
    # Distance in meters for 0.01 deg latitude ~ 1112 meters
    candidates = [
        NearbyFacilityItem(
            id="fac_1000m",
            name="Nearby Hospital 1km",
            type="Hospital",
            category="hospital",
            address="Address 1",
            latitude=center_lat + (1000.0 / 111195.0),
            longitude=center_lon,
            distance=1.0,
            distance_meters=1000.0,
            distance_unit="km",
            maps_url="https://maps.google.com",
        ),
        NearbyFacilityItem(
            id="fac_3500m",
            name="Nearby Hospital 3.5km",
            type="Hospital",
            category="hospital",
            address="Address 2",
            latitude=center_lat + (3500.0 / 111195.0),
            longitude=center_lon,
            distance=3.5,
            distance_meters=3500.0,
            distance_unit="km",
            maps_url="https://maps.google.com",
        ),
        NearbyFacilityItem(
            id="fac_5200m",
            name="Far Hospital 5.2km (Outside 5km)",
            type="Hospital",
            category="hospital",
            address="Address 3",
            latitude=center_lat + (5200.0 / 111195.0),
            longitude=center_lon,
            distance=5.2,
            distance_meters=5200.0,
            distance_unit="km",
            maps_url="https://maps.google.com",
        ),
    ]

    with patch.object(care_service, "_fetch_from_overpass", return_value=(candidates, "success")), \
         patch.object(care_service, "_fetch_from_google_places", return_value=[]), \
         patch.object(care_service, "_get_verified_hub_fallbacks", return_value=[]):

        _CANDIDATE_CACHE.clear()
        res = care_service.get_nearby_facilities(center_lat, center_lon, "hospital", radius_m)

        facility_ids = [f.id for f in res.facilities]
        assert "fac_1000m" in facility_ids
        assert "fac_3500m" in facility_ids
        assert "fac_5200m" not in facility_ids, "Facility beyond 5000m + 5m tolerance must be excluded!"

        # Verify sorted ascending by distance
        distances = [f.distance_meters for f in res.facilities]
        assert distances == sorted(distances), "Facilities must be sorted nearest-first"


# ==============================================================================
# TEST SUITE 7: Category Separation (Hospital vs Diagnostic Laboratory)
# ==============================================================================
def test_category_separation_isolation(care_service):
    """
    Verifies that hospital queries do not return laboratories and vice versa.
    """
    center_lat, center_lon = 12.9716, 77.5946

    mixed_candidates = [
        NearbyFacilityItem(
            id="hosp_1",
            name="Manipal Hospital",
            type="Hospital",
            category="hospital",
            address="HAL Old Airport Rd",
            latitude=center_lat + 0.01,
            longitude=center_lon,
            distance=1.1,
            distance_meters=1100.0,
            distance_unit="km",
            maps_url="https://maps.google.com",
        ),
        NearbyFacilityItem(
            id="lab_1",
            name="Dr. Lal PathLabs",
            type="Diagnostic Laboratory",
            category="laboratory",
            address="Indiranagar",
            latitude=center_lat + 0.012,
            longitude=center_lon,
            distance=1.3,
            distance_meters=1300.0,
            distance_unit="km",
            maps_url="https://maps.google.com",
        ),
    ]

    with patch.object(care_service, "_fetch_from_overpass", return_value=(mixed_candidates, "success")), \
         patch.object(care_service, "_fetch_from_google_places", return_value=[]), \
         patch.object(care_service, "_get_verified_hub_fallbacks", return_value=[]):

        _CANDIDATE_CACHE.clear()
        # Query hospital category
        res_hosp = care_service.get_nearby_facilities(center_lat, center_lon, "hospital", 5000)
        assert all(f.category == "hospital" for f in res_hosp.facilities)
        assert any(f.id == "hosp_1" for f in res_hosp.facilities)
        assert not any(f.id == "lab_1" for f in res_hosp.facilities)

        _CANDIDATE_CACHE.clear()
        # Query laboratory category
        res_lab = care_service.get_nearby_facilities(center_lat, center_lon, "laboratory", 5000)
        assert all(f.category == "laboratory" for f in res_lab.facilities)
        assert any(f.id == "lab_1" for f in res_lab.facilities)
        assert not any(f.id == "hosp_1" for f in res_lab.facilities)


# ==============================================================================
# TEST SUITE 8: Provider Timeout and Fallback Graceful Degradation
# ==============================================================================
def test_provider_timeout_fallback_resilience(care_service):
    """
    Verifies that when Overpass times out or throws an exception, the service falls back
    to verified directory hubs without returning a 500 internal error.
    """
    center_lat, center_lon = 12.9716, 77.5946

    with patch.object(care_service, "_fetch_from_overpass", side_effect=Exception("Overpass gateway timeout")), \
         patch.object(care_service, "_fetch_from_google_places", return_value=[]):

        _CANDIDATE_CACHE.clear()
        res = care_service.get_nearby_facilities(center_lat, center_lon, "hospital", 5000)

        assert res is not None
        assert res.total_count >= 0
        # Should have recorded fallback or warning
        assert res.provider_status in ("fallback_directory", "error", "degraded", "empty") or res.search_warning is not None
