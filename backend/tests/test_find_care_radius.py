import math
import pytest
from app.services.nearby_care_service import (
    NearbyCareService,
    calculate_haversine_distance,
)
from app.schemas.nearby_care_schema import NearbyFacilityItem


def test_haversine_calculation():
    """Verify mathematical correctness of Haversine distance calculation."""
    # Same point distance must be exactly 0
    assert calculate_haversine_distance(12.9716, 77.5946, 12.9716, 77.5946) == 0.0

    # Known distance: Bengaluru (12.9716, 77.5946) to Mysuru (12.2958, 76.6394) is ~128.5 km
    dist = calculate_haversine_distance(12.9716, 77.5946, 12.2958, 76.6394)
    assert 127.0 <= dist <= 130.0, f"Unexpected distance: {dist}"

    # Equator 1 degree longitude ~ 111.32 km
    dist_eq = calculate_haversine_distance(0.0, 0.0, 0.0, 1.0)
    assert 110.0 <= dist_eq <= 112.5, f"Equatorial 1-deg error: {dist_eq}"


def test_deterministic_synthetic_facilities_radius_filtering():
    """
    Test deterministic facilities at exact known distances from fixed origin.
    Origin: Bengaluru Center (12.9716, 77.5946)
    """
    origin_lat, origin_lon = 12.9716, 77.5946
    tolerance_km = 0.05

    # 1 deg latitude ~ 111 km, 0.01 deg ~ 1.11 km, 0.009 deg ~ 1.0 km
    test_facilities = [
        # Inside 2 km (~0.88 km away)
        NearbyFacilityItem(
            id="test_in_2k",
            name="Clinic Inside 2K",
            type="Medical Clinic",
            category="hospital",
            address="Near Center, Bengaluru",
            latitude=12.9716 + 0.008,  # ~0.88 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Just inside 2 km (~1.88 km away)
        NearbyFacilityItem(
            id="test_just_in_2k",
            name="Clinic Just Inside 2K",
            type="Medical Clinic",
            category="hospital",
            address="Sub-2km Boundary, Bengaluru",
            latitude=12.9716 + 0.017,  # ~1.88 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Just outside 2 km (~2.22 km away)
        NearbyFacilityItem(
            id="test_just_out_2k",
            name="Clinic Just Outside 2K",
            type="Medical Clinic",
            category="hospital",
            address="Outside 2km Boundary, Bengaluru",
            latitude=12.9716 + 0.020,  # ~2.22 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Between 2 and 5 km (~3.88 km away)
        NearbyFacilityItem(
            id="test_between_2_5k",
            name="Hospital 3.8K",
            type="Hospital",
            category="hospital",
            address="Mid-tier 3.8km, Bengaluru",
            latitude=12.9716 + 0.035,  # ~3.88 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Between 5 and 10 km (~7.77 km away)
        NearbyFacilityItem(
            id="test_between_5_10k",
            name="Hospital 7.7K",
            type="Hospital",
            category="hospital",
            address="Mid-tier 7.7km, Bengaluru",
            latitude=12.9716 + 0.070,  # ~7.77 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Between 10 and 20 km (~15.54 km away)
        NearbyFacilityItem(
            id="test_between_10_20k",
            name="Hospital 15.5K",
            type="Hospital",
            category="hospital",
            address="Far-tier 15.5km, Bengaluru",
            latitude=12.9716 + 0.140,  # ~15.54 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
        # Outside 20 km (~24.42 km away)
        NearbyFacilityItem(
            id="test_out_20k",
            name="Apollo Far Away 24K",
            type="Hospital",
            category="hospital",
            address="Bannerghatta Far, Bengaluru",
            latitude=12.9716 + 0.220,  # ~24.42 km
            longitude=77.5946,
            distance=0.0,
            maps_url="http://maps.google.com",
        ),
    ]

    # Calculate exact distance from origin for all test facilities
    for f in test_facilities:
        f.distance = calculate_haversine_distance(origin_lat, origin_lon, f.latitude, f.longitude)

    # 1. Test 2 km radius
    rad_2k = 2.0
    res_2k = [f for f in test_facilities if f.distance <= rad_2k + tolerance_km]
    ids_2k = {f.id for f in res_2k}
    assert ids_2k == {"test_in_2k", "test_just_in_2k"}, f"2km failed: {ids_2k}"
    assert "test_just_out_2k" not in ids_2k, "2.22km facility leaked into 2km filter!"
    assert "test_out_20k" not in ids_2k, "24km facility leaked into 2km filter!"

    # 2. Test 5 km radius
    rad_5k = 5.0
    res_5k = [f for f in test_facilities if f.distance <= rad_5k + tolerance_km]
    ids_5k = {f.id for f in res_5k}
    assert ids_2k.issubset(ids_5k), "Subset property failed: 2km facilities not in 5km!"
    assert "test_just_out_2k" in ids_5k
    assert "test_between_2_5k" in ids_5k
    assert "test_between_5_10k" not in ids_5k

    # 3. Test 10 km radius
    rad_10k = 10.0
    res_10k = [f for f in test_facilities if f.distance <= rad_10k + tolerance_km]
    ids_10k = {f.id for f in res_10k}
    assert ids_5k.issubset(ids_10k), "Subset property failed: 5km facilities not in 10km!"
    assert "test_between_5_10k" in ids_10k
    assert "test_between_10_20k" not in ids_10k

    # 4. Test 20 km radius
    rad_20k = 20.0
    res_20k = [f for f in test_facilities if f.distance <= rad_20k + tolerance_km]
    ids_20k = {f.id for f in res_20k}
    assert ids_10k.issubset(ids_20k), "Subset property failed: 10km facilities not in 20km!"
    assert "test_between_10_20k" in ids_20k
    assert "test_out_20k" not in ids_20k, "24km facility leaked into 20km filter!"


def test_monotone_subset_and_radius_invariants_on_live_service():
    """
    Test live NearbyCareService at 560049 coordinates (13.0163, 77.7056)
    Verifies that:
      1. Every facility has distance <= selected_radius + 0.05 km.
      2. Results are sorted strictly ascending by distance.
      3. R_2 <= R_5 <= R_10 <= R_20 (subset and count monotonicity).
    """
    service = NearbyCareService()
    lat, lon = 13.0163, 77.7056

    for category in ["hospital", "laboratory"]:
        prev_ids = set()
        for rad_m in [2000, 5000, 10000, 20000]:
            rad_km = rad_m / 1000.0
            res = service.get_nearby_facilities(
                latitude=lat,
                longitude=lon,
                facility_type=category,
                radius_meters=rad_m,
                origin_type="postal_code",
                origin_label="PIN 560049",
            )

            # Invariant 1: No facility distance exceeds radius + tolerance
            for fac in res.facilities:
                assert fac.distance <= rad_km + 0.05, (
                    f"Violation at {rad_km}km: {fac.name} has distance {fac.distance}km"
                )
                assert fac.category == category, (
                    f"Category mismatch: {fac.name} category '{fac.category}' != '{category}'"
                )

            # Invariant 2: Sorted ascending
            distances = [f.distance for f in res.facilities]
            assert distances == sorted(distances), "Facilities not sorted ascending by distance"

            # Invariant 3: Subset property R_prev subset of R_cur
            cur_ids = {f.id for f in res.facilities}
            assert prev_ids.issubset(cur_ids), (
                f"Monotone subset failed for {category} between previous and {rad_km}km!"
            )

            # Invariant 4: Non-decreasing counts
            assert len(cur_ids) >= len(prev_ids), (
                f"Count decreased at {rad_km}km: {len(cur_ids)} < {len(prev_ids)}"
            )

            prev_ids = cur_ids


def test_distinct_hospital_and_laboratory_categories():
    """Ensure hospitals and diagnostic laboratories are completely separated."""
    service = NearbyCareService()
    lat, lon = 13.0163, 77.7056

    hosp_res = service.get_nearby_facilities(lat, lon, facility_type="hospital", radius_meters=10000)
    lab_res = service.get_nearby_facilities(lat, lon, facility_type="laboratory", radius_meters=10000)

    for h in hosp_res.facilities:
        assert h.category == "hospital"
        assert "laboratory" not in h.type.lower() or "hospital" in h.type.lower()

    for l in lab_res.facilities:
        assert l.category == "laboratory"
        assert "hospital" not in l.type.lower() or "diagnostic" in l.name.lower() or "clinic" in l.name.lower()
