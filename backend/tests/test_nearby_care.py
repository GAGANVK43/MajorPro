"""
Automated unit & integration tests for Nearby Care Service.
Validates Haversine distance calculation, PIN code geocoding,
and fallback facility retrieval sorted by nearest distance.
"""
import pytest
from app.services.nearby_care_service import NearbyCareService, calculate_haversine_distance


def test_haversine_distance_accuracy():
    """Verify Haversine formula calculates known geographical distances correctly."""
    # Bengaluru (12.9716, 77.5946) to Mysuru (12.2958, 76.6394) is approx ~128-140 km
    dist = calculate_haversine_distance(12.9716, 77.5946, 12.2958, 76.6394)
    assert 120.0 <= dist <= 150.0

    # Same location must be 0.0 km
    dist_zero = calculate_haversine_distance(12.9716, 77.5946, 12.9716, 77.5946)
    assert dist_zero == 0.0


def test_pin_cluster_geocoding_instant():
    """Verify local known PIN clusters resolve instantly without network reliance."""
    service = NearbyCareService()
    res_blr = service.geocode_location("560001")
    assert res_blr is not None
    assert abs(res_blr.latitude - 12.9716) < 0.01
    assert abs(res_blr.longitude - 77.5946) < 0.01
    assert "Bengaluru" in res_blr.display_name or "560001" in res_blr.display_name

    res_del = service.geocode_location("110001")
    assert res_del is not None
    assert abs(res_del.latitude - 28.6139) < 0.01


def test_nearby_facilities_sorted_by_distance():
    """Verify facilities are sorted nearest to farthest."""
    service = NearbyCareService()
    # Query central Bengaluru (12.9716, 77.5946)
    res = service.get_nearby_facilities(
        latitude=12.9716,
        longitude=77.5946,
        facility_type="hospital",
        radius_meters=15000,
    )
    assert res.total_count >= 0
    # If any facilities are found, verify ascending distance order
    distances = [f.distance for f in res.facilities]
    assert distances == sorted(distances)
    for fac in res.facilities:
        assert fac.maps_url.startswith("https://www.google.com/maps")
        assert fac.distance >= 0.0


def test_nearby_laboratories_category():
    """Verify laboratory query filters appropriately."""
    service = NearbyCareService()
    res = service.get_nearby_facilities(
        latitude=12.9716,
        longitude=77.5946,
        facility_type="laboratory",
        radius_meters=15000,
    )
    assert res.facility_type == "laboratory"
    for fac in res.facilities:
        assert fac.category == "laboratory"
        assert fac.distance >= 0.0
