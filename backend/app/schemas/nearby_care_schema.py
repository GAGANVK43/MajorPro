from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class NearbyFacilityItem(BaseModel):
    id: str = Field(..., description="Unique facility identifier")
    name: str = Field(..., description="Facility name")
    type: str = Field(..., description="Specific facility classification (Hospital, Clinic, Diagnostic Lab)")
    category: str = Field(..., description="General category: hospital or laboratory")
    address: str = Field(..., description="Formatted physical address")
    latitude: float = Field(..., description="Geographical latitude coordinate")
    longitude: float = Field(..., description="Geographical longitude coordinate")
    distance: float = Field(..., description="Distance from user in kilometers")
    distance_meters: Optional[float] = Field(None, description="Exact distance from user in meters")
    distance_unit: str = Field("km", description="Distance unit (km)")
    rating: Optional[float] = Field(None, description="Average review rating if available")
    open_now: Optional[bool] = Field(None, description="Current operating status if available")
    phone: Optional[str] = Field(None, description="Contact phone number if available")
    website: Optional[str] = Field(None, description="Official website URL if available")
    maps_url: str = Field(..., description="Google Maps navigation destination URL")
    source: Optional[str] = Field("live_provider", description="Provider source (osm_overpass, google_places, verified_directory)")


class NearbyCareListResponse(BaseModel):
    facilities: List[NearbyFacilityItem] = Field(default_factory=list)
    total_count: int = Field(0, description="Total count of discovered facilities")
    facility_type: str = Field(..., description="Requested facility category (hospital or laboratory)")
    radius_meters: int = Field(..., description="Search radius in meters")
    radius_km: Optional[float] = Field(None, description="Search radius in kilometers")
    tolerance_meters: float = Field(5.0, description="Strict boundary tolerance in meters")
    center_lat: float = Field(..., description="Center latitude of the search")
    center_lng: float = Field(..., description="Center longitude of the search")
    location_name: Optional[str] = Field(None, description="Geocoded location name if resolved from query")
    origin_type: Optional[str] = Field("gps", description="Search origin type ('gps' or 'manual')")
    origin_label: Optional[str] = Field(None, description="Display label for the search origin")
    providers_queried: List[str] = Field(default_factory=list, description="List of providers queried")
    provider_status: Dict[str, str] = Field(default_factory=dict, description="Status of each queried provider")
    has_live_results: bool = Field(False, description="Whether live providers returned results")
    search_warning: Optional[str] = Field(None, description="Diagnostic warning message if external providers were throttled or unavailable")


class GeocodeResult(BaseModel):
    latitude: float = Field(..., description="Resolved latitude")
    longitude: float = Field(..., description="Resolved longitude")
    display_name: str = Field(..., description="Full descriptive location name")
    city: Optional[str] = Field(None, description="City name if available")
    state: Optional[str] = Field(None, description="State or province name if available")
    country: Optional[str] = Field(None, description="Country name if available")
