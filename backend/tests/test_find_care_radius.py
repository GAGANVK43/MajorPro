import sys
import os
import math
import pytest
from unittest.mock import patch

# Ensure app is discoverable on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.nearby_care_service import (
    NearbyCareService,
    calculate_haversine_distance,
    calculate_haversine_distance_meters,
    is_valid_coordinate,
    EARTH_RADIUS_METERS,
    TOLERANCE_METERS,
    _CANDIDATE_CACHE,
)
from app.schemas.nearby_care_schema import NearbyFacilityItem
from app.config.database import SessionLocal, init_db
from app.models.user import User
from app.config.security import create_access_token, hash_password
from fastapi.testclient import TestClient
from app.main import app


def test_exact_haversine_meters_accuracy():
    """
    Verifies that calculate_haversine_distance_meters produces unrounded meter precision
    and matches standard geodetic standards.
    """
    # Point A: MG Road Bangalore (12.9716, 77.5946)
    # Point B: Exact 1 degree north latitude (~111,195 meters)
    lat1, lon1 = 12.9716, 77.5946
    lat2, lon2 = 13.9716, 77.5946

    dist_m = calculate_haversine_distance_meters(lat1, lon1, lat2, lon2)
    dist_km = calculate_haversine_distance(lat1, lon1, lat2, lon2)

    assert 111000.0 <= dist_m <= 111400.0, f"Distance in meters unexpected: {dist_m}"
    assert round(dist_m / 1000.0, 2) == dist_km, f"Mismatch between km and meters: {dist_km} vs {dist_m}"

    # Same point should return 0.0
    zero_dist = calculate_haversine_distance_meters(lat1, lon1, lat1, lon1)
    assert zero_dist == 0.0


def test_is_valid_coordinate():
    """
    Verifies coordinate sanity filtering.
    """
    assert is_valid_coordinate(12.9716, 77.5946) is True
    assert is_valid_coordinate(0.0, 0.0) is True
    assert is_valid_coordinate(-90.0, 180.0) is True
    assert is_valid_coordinate(90.0, -180.0) is True

    # Invalid coordinates
    assert is_valid_coordinate(None, 77.5946) is False
    assert is_valid_coordinate(12.9716, None) is False
    assert is_valid_coordinate(float("nan"), 77.5946) is False
    assert is_valid_coordinate(12.9716, float("inf")) is False
    assert is_valid_coordinate(91.0, 77.5946) is False
    assert is_valid_coordinate(12.9716, 181.0) is False
    assert is_valid_coordinate(-91.0, 0.0) is False
    assert is_valid_coordinate("invalid", "text") is False


def test_strict_radius_boundary_synthetic_dataset():
    """
    Tests strict boundary filtering with synthetic facilities positioned at exact known distances,
    specifically replicating the reported screenshot failure (5.23 km and 5.73 km facilities appearing at 5 km).
    """
    service = NearbyCareService()
    center_lat, center_lon = 12.9716, 77.5946

    # Function to calculate target coordinates at exact distances due North
    # 1 degree latitude ~ 111,195 meters
    def coord_at_distance_meters(meters: float):
        delta_lat = (meters / EARTH_RADIUS_METERS) * (180.0 / math.pi)
        return center_lat + delta_lat, center_lon

    # Synthetic facilities test set
    specs = [
        ("fac_1950m", "Facility 1.95km (Inside 2k)", 1950.0),
        ("fac_2003m", "Facility 2.003km (Inside 2k + 5m tolerance)", 2003.0),
        ("fac_2007m", "Facility 2.007km (Outside 2k + 5m tolerance)", 2007.0),
        ("fac_4800m", "Facility 4.80km (Inside 5k)", 4800.0),
        ("fac_5004m", "Facility 5.004km (Inside 5k + 5m tolerance)", 5004.0),
        ("fac_5006m", "Facility 5.006km (Outside 5k + 5m tolerance)", 5006.0),
        ("fac_5230m", "Seegehalli Government Hospital (5.23 km replica)", 5230.0),
        ("fac_5730m", "Deepa Hospital (5.73 km replica)", 5730.0),
        ("fac_8500m", "Facility 8.50km (Inside 10k)", 8500.0),
        ("fac_10004m", "Facility 10.004km (Inside 10k + 5m tolerance)", 10004.0),
        ("fac_10008m", "Facility 10.008km (Outside 10k + 5m tolerance)", 10008.0),
        ("fac_15000m", "Facility 15.00km (Inside 20k)", 15000.0),
        ("fac_20004m", "Facility 20.004km (Inside 20k + 5m tolerance)", 20004.0),
        ("fac_20008m", "Facility 20.008km (Outside 20k + 5m tolerance)", 20008.0),
        ("fac_22500m", "Facility 22.50km (Outside 20k)", 22500.0),
    ]

    synthetic_candidates = []
    for fid, name, target_m in specs:
        lat, lon = coord_at_distance_meters(target_m)
        actual_m = calculate_haversine_distance_meters(center_lat, center_lon, lat, lon)
        synthetic_candidates.append(
            NearbyFacilityItem(
                id=fid,
                name=name,
                type="Hospital",
                category="hospital",
                address=f"Address for {name}",
                latitude=lat,
                longitude=lon,
                distance=round(actual_m / 1000.0, 2),
                distance_meters=round(actual_m, 1),
                distance_unit="km",
                maps_url="https://maps.google.com",
            )
        )

    # Patch candidate fetch to return our synthetic pool
    try:
        with patch.object(service, "_fetch_from_overpass", return_value=(synthetic_candidates, "success")), \
             patch.object(service, "_fetch_from_google_places", return_value=[]), \
             patch.object(service, "_get_verified_hub_fallbacks", return_value=[]):

            # Clear cache before test
            _CANDIDATE_CACHE.clear()

            # 1. TEST RADIUS = 5000 m (5 km) — THE CRITICAL USER REPORT
            res_5k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=5000)
            returned_ids_5k = [f.id for f in res_5k.facilities]

            # Verify that 5.23 km and 5.73 km facilities are STRICTLY EXCLUDED
            assert "fac_5230m" not in returned_ids_5k, "CRITICAL ERROR: 5.23 km facility was NOT filtered out at 5 km radius!"
            assert "fac_5730m" not in returned_ids_5k, "CRITICAL ERROR: 5.73 km facility was NOT filtered out at 5 km radius!"
            assert "fac_5006m" not in returned_ids_5k, "Facility outside 5k + 5m tolerance must be excluded!"

            # Verify that eligible facilities are included
            assert "fac_1950m" in returned_ids_5k
            assert "fac_2003m" in returned_ids_5k
            assert "fac_4800m" in returned_ids_5k
            assert "fac_5004m" in returned_ids_5k  # within 5m tolerance

            # Verify no facility in res_5k has distance_meters > 5005.0
            for f in res_5k.facilities:
                assert f.distance_meters <= 5005.0, f"Facility {f.name} violates radius contract: {f.distance_meters} m > 5005.0 m"

            # 2. TEST RADIUS = 2000 m (2 km)
            res_2k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=2000)
            returned_ids_2k = [f.id for f in res_2k.facilities]

            assert "fac_1950m" in returned_ids_2k
            assert "fac_2003m" in returned_ids_2k  # within 5m tolerance
            assert "fac_2007m" not in returned_ids_2k  # exceeds 2005.0m
            assert "fac_4800m" not in returned_ids_2k
            assert "fac_5230m" not in returned_ids_2k
            for f in res_2k.facilities:
                assert f.distance_meters <= 2005.0

            # 3. TEST RADIUS = 10000 m (10 km)
            res_10k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=10000)
            returned_ids_10k = [f.id for f in res_10k.facilities]

            assert "fac_5230m" in returned_ids_10k  # At 10km, 5.23km IS now eligible
            assert "fac_5730m" in returned_ids_10k  # At 10km, 5.73km IS now eligible
            assert "fac_8500m" in returned_ids_10k
            assert "fac_10004m" in returned_ids_10k
            assert "fac_10008m" not in returned_ids_10k
            assert "fac_15000m" not in returned_ids_10k
            for f in res_10k.facilities:
                assert f.distance_meters <= 10005.0

            # 4. TEST RADIUS = 20000 m (20 km)
            res_20k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=20000)
            returned_ids_20k = [f.id for f in res_20k.facilities]

            assert "fac_15000m" in returned_ids_20k
            assert "fac_20004m" in returned_ids_20k
            assert "fac_20008m" not in returned_ids_20k
            assert "fac_22500m" not in returned_ids_20k
            for f in res_20k.facilities:
                assert f.distance_meters <= 20005.0
    finally:
        _CANDIDATE_CACHE.clear()


def test_monotonic_subset_guarantee():
    """
    Mathematically verifies that F(2km) <= F(5km) <= F(10km) <= F(20km).
    No facility present in a smaller radius query may be missing from a larger radius query.
    """
    service = NearbyCareService()
    center_lat, center_lon = 12.9716, 77.5946

    _CANDIDATE_CACHE.clear()
    res_2k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=2000)
    res_5k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=5000)
    res_10k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=10000)
    res_20k = service.get_nearby_facilities(center_lat, center_lon, facility_type="hospital", radius_meters=20000)

    set_2k = {f.id for f in res_2k.facilities}
    set_5k = {f.id for f in res_5k.facilities}
    set_10k = {f.id for f in res_10k.facilities}
    set_20k = {f.id for f in res_20k.facilities}

    assert set_2k.issubset(set_5k), f"Monotonicity violation: {set_2k - set_5k} in 2km but missing from 5km!"
    assert set_5k.issubset(set_10k), f"Monotonicity violation: {set_5k - set_10k} in 5km but missing from 10km!"
    assert set_10k.issubset(set_20k), f"Monotonicity violation: {set_10k - set_20k} in 10km but missing from 20km!"


def test_invalid_coordinates_exclusion_in_service():
    """
    Tests that facilities with NaN, Inf, None, or out-of-bounds coordinates are discarded.
    """
    service = NearbyCareService()
    corrupt_candidates = [
        NearbyFacilityItem(
            id="bad_nan",
            name="NaN Hospital",
            type="Hospital",
            category="hospital",
            address="Nowhere",
            latitude=float("nan"),
            longitude=77.5946,
            distance=1.0,
            distance_unit="km",
            maps_url="",
        ),
        NearbyFacilityItem(
            id="bad_inf",
            name="Inf Hospital",
            type="Hospital",
            category="hospital",
            address="Nowhere",
            latitude=12.9716,
            longitude=float("inf"),
            distance=1.0,
            distance_unit="km",
            maps_url="",
        ),
        NearbyFacilityItem(
            id="bad_range",
            name="Out of Range Hospital",
            type="Hospital",
            category="hospital",
            address="Nowhere",
            latitude=95.0,
            longitude=200.0,
            distance=1.0,
            distance_unit="km",
            maps_url="https://www.google.com/maps/dir/?api=1&destination=0,0",
        ),
        NearbyFacilityItem(
            id="good_fac",
            name="Valid Hospital",
            type="Hospital",
            category="hospital",
            address="Central Bangalore",
            latitude=12.9716,
            longitude=77.5946,
            distance=0.0,
            distance_unit="km",
            maps_url="https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946",
        ),
    ]

    try:
        with patch.object(service, "_fetch_from_overpass", return_value=(corrupt_candidates, "success")), \
             patch.object(service, "_fetch_from_google_places", return_value=[]), \
             patch.object(service, "_get_verified_hub_fallbacks", return_value=[]):

            _CANDIDATE_CACHE.clear()
            res = service.get_nearby_facilities(12.9716, 77.5946, facility_type="hospital", radius_meters=5000)
            returned_ids = [f.id for f in res.facilities]

            assert "bad_nan" not in returned_ids
            assert "bad_inf" not in returned_ids
            assert "bad_range" not in returned_ids
            assert "good_fac" in returned_ids
    finally:
        _CANDIDATE_CACHE.clear()


def test_api_strict_validation():
    """
    Tests that FastAPI endpoint strictly validates categories, coordinates, and radius,
    returning HTTP 400 Bad Request on invalid inputs.
    """
    init_db()
    db = SessionLocal()
    test_email = "care_validator_user@diasense.ai"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            full_name="Care Validator User",
            email=test_email,
            password=hash_password("ValTest@1234"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)

    # 1. Invalid facility category -> 400
    res_bad_type = client.get(
        "/api/nearby-care?latitude=12.9716&longitude=77.5946&type=supermarket&radius=5000",
        headers=headers,
    )
    assert res_bad_type.status_code == 400, f"Expected 400 for invalid type but got {res_bad_type.status_code}"

    # 2. Invalid radius (negative or zero) -> 400
    res_bad_rad = client.get(
        "/api/nearby-care?latitude=12.9716&longitude=77.5946&type=hospital&radius=0",
        headers=headers,
    )
    assert res_bad_rad.status_code == 400, f"Expected 400 for zero radius but got {res_bad_rad.status_code}"

    res_neg_rad = client.get(
        "/api/nearby-care?latitude=12.9716&longitude=77.5946&type=hospital&radius=-500",
        headers=headers,
    )
    assert res_neg_rad.status_code == 400, f"Expected 400 for negative radius but got {res_neg_rad.status_code}"

    # 3. Invalid coordinates -> 400
    res_bad_coords = client.get(
        "/api/nearby-care?latitude=95.0&longitude=77.5946&type=hospital&radius=5000",
        headers=headers,
    )
    assert res_bad_coords.status_code == 400, f"Expected 400 for out-of-range latitude but got {res_bad_coords.status_code}"

    # 4. Valid request -> 200 with schema metadata
    res_valid = client.get(
        "/api/nearby-care?latitude=12.9716&longitude=77.5946&type=hospital&radius=5000",
        headers=headers,
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["success"] is True
    assert data["data"]["radius_meters"] == 5000
    assert data["data"]["radius_km"] == 5.0
    assert data["data"]["tolerance_meters"] == 5.0

    # Ensure every single facility returned is strictly <= 5.005 km
    for fac in data["data"]["facilities"]:
        assert fac["distance"] <= 5.005, f"Facility {fac['name']} exceeded radius in API response: {fac['distance']} km"

    db.close()
