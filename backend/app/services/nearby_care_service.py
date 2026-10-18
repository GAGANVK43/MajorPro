import math
import os
import re
import time
from typing import Dict, Any, List, Optional, Tuple
import httpx

from app.config.settings import settings
from app.schemas.nearby_care_schema import (
    NearbyFacilityItem,
    NearbyCareListResponse,
    GeocodeResult,
)
from app.utils.logger import logger

EARTH_RADIUS_METERS = 6371008.8  # IUGG mean Earth radius in meters
TOLERANCE_METERS = 5.0  # 5 meters strict boundary tolerance for floating-point precision


def calculate_haversine_distance_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two points on the Earth (specified in decimal degrees)
    in meters using the Haversine formula with the standard IUGG mean Earth radius (6,371,008.8 m).
    Returns exact unrounded floating-point distance in meters.
    """
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate distance in kilometers rounded to 2 decimal places.
    Maintained for backward compatibility across existing endpoints and tests.
    """
    dist_m = calculate_haversine_distance_meters(lat1, lon1, lat2, lon2)
    return round(dist_m / 1000.0, 2)


def is_valid_coordinate(lat: Any, lon: Any) -> bool:
    """
    Validates that latitude and longitude are valid finite floating-point numbers
    within valid geographic boundaries (-90 to +90, -180 to +180).
    """
    try:
        if lat is None or lon is None:
            return False
        f_lat = float(lat)
        f_lon = float(lon)
        if not math.isfinite(f_lat) or not math.isfinite(f_lon):
            return False
        if not (-90.0 <= f_lat <= 90.0) or not (-180.0 <= f_lon <= 180.0):
            return False
        return True
    except (ValueError, TypeError):
        return False


class CandidateCacheEntry:
    def __init__(self, candidates: List[NearbyFacilityItem], timestamp: float, max_radius: int):
        self.candidates = candidates
        self.timestamp = timestamp
        self.max_radius = max_radius


# In-memory candidate cache keyed by (round(lat, 3), round(lon, 3), facility_type)
# Guarantees subset monotonicity: F(2km) <= F(5km) <= F(10km) <= F(20km)
_CANDIDATE_CACHE: Dict[Tuple[float, float, str], CandidateCacheEntry] = {}
CACHE_TTL_SECONDS = 900  # 15 minutes


# Curated verified Indian healthcare hubs providing resilient fallback if Overpass/Nominatim are unreachable
VERIFIED_INDIAN_HEALTHCARE_HUBS: List[Dict[str, Any]] = [
    # Bengaluru - Central & East
    {
        "id": "hub_blr_01",
        "name": "Manipal Hospital Old Airport Road",
        "type": "Multispeciality Hospital",
        "category": "hospital",
        "address": "98, HAL Old Airport Rd, Kodihalli, Bengaluru, Karnataka 560017",
        "lat": 12.9592,
        "lon": 77.6534,
        "rating": 4.6,
        "phone": "+91 80 2502 4444",
        "website": "https://www.manipalhospitals.com",
    },
    {
        "id": "hub_blr_02",
        "name": "Fortis Hospital Cunningham Road",
        "type": "Super Speciality Hospital",
        "category": "hospital",
        "address": "14, Cunningham Rd, Vasanth Nagar, Bengaluru, Karnataka 560052",
        "lat": 12.9866,
        "lon": 77.5956,
        "rating": 4.5,
        "phone": "+91 80 4199 4444",
        "website": "https://www.fortishealthcare.com",
    },
    {
        "id": "hub_blr_03",
        "name": "Apollo Hospital Bannerghatta Road",
        "type": "Multispeciality Hospital",
        "category": "hospital",
        "address": "154/11, Opp. IIMB, Bannerghatta Rd, Bengaluru, Karnataka 560076",
        "lat": 12.8936,
        "lon": 77.5978,
        "rating": 4.5,
        "phone": "+91 80 2630 4050",
        "website": "https://www.apollohospitals.com",
    },
    {
        "id": "hub_blr_04",
        "name": "Manipal Hospital Whitefield",
        "type": "Multispeciality Hospital",
        "category": "hospital",
        "address": "ITPL Main Rd, KIADB Export Promotion Industrial Area, Whitefield, Bengaluru, Karnataka 560066",
        "lat": 12.9880,
        "lon": 77.7289,
        "rating": 4.4,
        "phone": "+91 80 6165 6666",
        "website": "https://www.manipalhospitals.com",
    },
    {
        "id": "hub_blr_05",
        "name": "Victoria Hospital (BMCRI)",
        "type": "Government General Hospital",
        "category": "hospital",
        "address": "Fort Rd, Near City Market, Kalasipalya, Bengaluru, Karnataka 560002",
        "lat": 12.9634,
        "lon": 77.5756,
        "rating": 4.2,
        "phone": "+91 80 2670 1150",
        "website": "https://bmcri.edu.in",
    },
    {
        "id": "hub_blr_06",
        "name": "Bowring & Lady Curzon Hospital",
        "type": "Government Hospital",
        "category": "hospital",
        "address": "Lady Curzon Rd, Shivaji Nagar, Bengaluru, Karnataka 560001",
        "lat": 12.9833,
        "lon": 77.6047,
        "rating": 4.1,
        "phone": "+91 80 2559 1325",
        "website": None,
    },
    {
        "id": "hub_blr_07",
        "name": "St. John's Medical College Hospital",
        "type": "Teaching & Multispeciality Hospital",
        "category": "hospital",
        "address": "Sarjapur - Marathahalli Rd, John Nagar, Koramangala, Bengaluru, Karnataka 560034",
        "lat": 12.9304,
        "lon": 77.6206,
        "rating": 4.5,
        "phone": "+91 80 2206 5000",
        "website": "https://www.stjohns.in",
    },
    {
        "id": "hub_blr_08",
        "name": "Aster CMI Hospital",
        "type": "Super Speciality Hospital",
        "category": "hospital",
        "address": "No. 43/42, Bellary Rd, Sahakar Nagar, Hebbal, Bengaluru, Karnataka 560092",
        "lat": 13.0560,
        "lon": 77.5930,
        "rating": 4.6,
        "phone": "+91 80 4342 0100",
        "website": "https://www.asterhospitals.in",
    },
    {
        "id": "hub_blr_09",
        "name": "Sakra World Hospital",
        "type": "Multispeciality Hospital",
        "category": "hospital",
        "address": "SY NO 52/2 & 52/3, Devarabeesanahalli, Bellandur, Bengaluru, Karnataka 560103",
        "lat": 12.9268,
        "lon": 77.6834,
        "rating": 4.5,
        "phone": "+91 80 4969 4969",
        "website": "https://www.sakraworldhospital.com",
    },
    {
        "id": "hub_blr_10",
        "name": "Narayana Health City",
        "type": "Super Speciality Health City",
        "category": "hospital",
        "address": "258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru, Karnataka 560099",
        "lat": 12.8185,
        "lon": 77.6937,
        "rating": 4.6,
        "phone": "+91 80 7122 2222",
        "website": "https://www.narayanahealth.org",
    },
    # Bengaluru - Diagnostic Laboratories
    {
        "id": "hub_blr_lab01",
        "name": "Anand Diagnostic Laboratory (Neuberg)",
        "type": "Central Diagnostic Laboratory",
        "category": "laboratory",
        "address": "No. 54, Bowring Hospital Rd, Shivaji Nagar, Bengaluru, Karnataka 560001",
        "lat": 12.9822,
        "lon": 77.6075,
        "rating": 4.7,
        "phone": "+91 80 2559 1088",
        "website": "https://anandlab.com",
    },
    {
        "id": "hub_blr_lab02",
        "name": "Metropolis Healthcare Indiranagar",
        "type": "Clinical Pathology & Diagnostic Lab",
        "category": "laboratory",
        "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
        "lat": 12.9719,
        "lon": 77.6412,
        "rating": 4.5,
        "phone": "+91 80 4030 0400",
        "website": "https://www.metropolisindia.com",
    },
    {
        "id": "hub_blr_lab03",
        "name": "Dr Lal PathLabs Koramangala",
        "type": "Diagnostic & Diabetes Testing Lab",
        "category": "laboratory",
        "address": "80 Feet Rd, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
        "lat": 12.9344,
        "lon": 77.6258,
        "rating": 4.4,
        "phone": "+91 80 4088 0700",
        "website": "https://www.lalpathlabs.com",
    },
    {
        "id": "hub_blr_lab04",
        "name": "Thyrocare Aarogyam Center Jayanagar",
        "type": "Preventive Diagnostic Laboratory",
        "category": "laboratory",
        "address": "9th Main Rd, 4th Block, Jayanagar, Bengaluru, Karnataka 560011",
        "lat": 12.9250,
        "lon": 77.5938,
        "rating": 4.4,
        "phone": "+91 80 4227 0000",
        "website": "https://www.thyrocare.com",
    },
    {
        "id": "hub_blr_lab05",
        "name": "SRL Diagnostics Malleshwaram",
        "type": "Pathology & Diabetes Lab",
        "category": "laboratory",
        "address": "Margosa Rd, Between 15th & 16th Cross, Malleshwaram, Bengaluru, Karnataka 560055",
        "lat": 12.9988,
        "lon": 77.5704,
        "rating": 4.3,
        "phone": "+91 80 2346 0888",
        "website": "https://www.agilusdiagnostics.com",
    },
    # Delhi NCR
    {
        "id": "hub_del_01",
        "name": "AIIMS New Delhi",
        "type": "Apex Multispeciality Hospital",
        "category": "hospital",
        "address": "Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029",
        "lat": 28.5672,
        "lon": 77.2100,
        "rating": 4.7,
        "phone": "+91 11 2658 8500",
        "website": "https://www.aiims.edu",
    },
    {
        "id": "hub_del_02",
        "name": "Safdarjung Hospital",
        "type": "Central Government Hospital",
        "category": "hospital",
        "address": "Ansari Nagar West, New Delhi 110029",
        "lat": 28.5683,
        "lon": 77.2064,
        "rating": 4.2,
        "phone": "+91 11 2616 5060",
        "website": None,
    },
    {
        "id": "hub_del_lab01",
        "name": "Dr Lal PathLabs National Reference Lab Rohini",
        "type": "National Reference Laboratory",
        "category": "laboratory",
        "address": "Sector 18, Block E, Rohini, New Delhi 110085",
        "lat": 28.7041,
        "lon": 77.1025,
        "rating": 4.7,
        "phone": "+91 11 3988 5050",
        "website": "https://www.lalpathlabs.com",
    },
    # Mumbai
    {
        "id": "hub_bom_01",
        "name": "Lilavati Hospital & Research Centre",
        "type": "Multispeciality Hospital",
        "category": "hospital",
        "address": "A-791, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050",
        "lat": 19.0519,
        "lon": 72.8291,
        "rating": 4.6,
        "phone": "+91 22 2675 1000",
        "website": "https://www.lilavatihospital.com",
    },
    {
        "id": "hub_bom_lab01",
        "name": "Metropolis Healthcare Central Laboratory",
        "type": "Global Reference Laboratory",
        "category": "laboratory",
        "address": "Commercial Building 1A, Kohinoor Mall, Kirol Rd, Kurla West, Mumbai, Maharashtra 400070",
        "lat": 19.0682,
        "lon": 72.8856,
        "rating": 4.7,
        "phone": "+91 22 6650 5555",
        "website": "https://www.metropolisindia.com",
    },
]


class NearbyCareService:
    """
    Service responsible for querying real healthcare facilities (Hospitals, Clinics, Diagnostic Labs)
    near a given user location using OpenStreetMap Overpass API, Nominatim Geocoder, and optional Google Places API.
    Strictly enforces distance filtering: D <= radius_meters + 5m boundary tolerance.
    """

    OVERPASS_ENDPOINTS = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]

    NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
    USER_AGENT = "DiaSenseAI-HealthcarePlatform/1.0 (contact@diasense.ai)"

    def __init__(self):
        self.google_api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "").strip() or os.getenv(
            "GOOGLE_PLACES_API_KEY", ""
        ).strip()

    KNOWN_INDIAN_PIN_CLUSTERS = {
        "560049": (13.0163, 77.7056, "560049 (Bhattarahalli / Virgonagar, Bangalore East, Bengaluru)"),
        "560001": (12.9716, 77.5946, "560001 (MG Road / Central Bangalore, Bengaluru)"),
        "560034": (12.9279, 77.6271, "560034 (Koramangala, Bengaluru)"),
        "560037": (12.9698, 77.7500, "560037 (Marathahalli / Whitefield, Bengaluru)"),
        "560066": (12.9698, 77.7500, "560066 (Whitefield, Bengaluru)"),
        "560076": (12.8996, 77.6101, "560076 (BTM Layout / Bannerghatta Road, Bengaluru)"),
        "560100": (12.8452, 77.6602, "560100 (Electronic City, Bengaluru)"),
        "560078": (12.9081, 77.5855, "560078 (JP Nagar, Bengaluru)"),
        "560085": (12.9250, 77.5467, "560085 (Banashankari, Bengaluru)"),
        "110001": (28.6139, 77.2090, "110001 (Connaught Place, New Delhi)"),
        "400001": (18.9388, 72.8354, "400001 (Fort / South Mumbai, Mumbai)"),
        "500001": (17.3850, 78.4867, "500001 (Abids / Central Hyderabad)"),
        "600001": (13.0827, 80.2707, "600001 (George Town, Chennai)"),
        "411001": (18.5204, 73.8567, "411001 (Shivajinagar / Camp, Pune)"),
        "570001": (12.2958, 76.6394, "570001 (Devaraja Market / Central Mysuru)"),
    }

    def geocode_location(self, query: str) -> Optional[GeocodeResult]:
        """
        Geocodes a user-entered location query (PIN code, City, Locality, Area)
        into latitude and longitude coordinates.
        Supports 6-digit Indian PIN codes, city names, and areas with multiple fallback tiers.
        """
        if not query or not query.strip():
            return None

        clean_query = query.strip()

        # 1. Check known PIN code cache for instant ultra-accurate match
        if clean_query in self.KNOWN_INDIAN_PIN_CLUSTERS:
            lat, lon, display = self.KNOWN_INDIAN_PIN_CLUSTERS[clean_query]
            return GeocodeResult(
                latitude=lat,
                longitude=lon,
                display_name=display,
                city="Bengaluru" if "560" in clean_query else "India",
                state="Karnataka" if "560" in clean_query or "570" in clean_query else "India",
                country="India",
            )

        headers = {"User-Agent": self.USER_AGENT}
        is_pin = bool(re.match(r"^\d{6}$", clean_query))

        # 2. If 6-digit PIN code, query Nominatim with structured postalcode + India
        if is_pin:
            try:
                params = {
                    "postalcode": clean_query,
                    "country": "India",
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 1,
                }
                with httpx.Client(timeout=8.0) as client:
                    res = client.get(f"{self.NOMINATIM_BASE}/search", params=params, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        if data and len(data) > 0:
                            top = data[0]
                            addr = top.get("address", {})
                            city = (
                                addr.get("city")
                                or addr.get("town")
                                or addr.get("village")
                                or addr.get("city_district")
                                or addr.get("county")
                                or addr.get("state_district")
                            )
                            return GeocodeResult(
                                latitude=float(top["lat"]),
                                longitude=float(top["lon"]),
                                display_name=top.get("display_name", f"{clean_query}, India"),
                                city=city,
                                state=addr.get("state"),
                                country=addr.get("country", "India"),
                            )
            except Exception as e:
                logger.warning(f"Nominatim postal query error for '{clean_query}': {e}")

            # 2b. Indian Postal PIN API fallback (api.postalpincode.in)
            try:
                with httpx.Client(timeout=6.0) as client:
                    pin_res = client.get(f"https://api.postalpincode.in/pincode/{clean_query}")
                    if pin_res.status_code == 200:
                        pin_json = pin_res.json()
                        if pin_json and len(pin_json) > 0 and pin_json[0].get("Status") == "Success":
                            post_offices = pin_json[0].get("PostOffice", [])
                            if post_offices:
                                po = post_offices[0]
                                po_name = po.get("Name", "")
                                district = po.get("District", "")
                                state = po.get("State", "")
                                fallback_search = f"{po_name}, {district}, {state}, India" if po_name else f"{district}, {state}, India"

                                # Geocode the resolved district / place name
                                geo_res = client.get(
                                    f"{self.NOMINATIM_BASE}/search",
                                    params={"q": fallback_search, "format": "json", "limit": 1},
                                    headers=headers,
                                )
                                if geo_res.status_code == 200:
                                    gdata = geo_res.json()
                                    if gdata:
                                        return GeocodeResult(
                                            latitude=float(gdata[0]["lat"]),
                                            longitude=float(gdata[0]["lon"]),
                                            display_name=f"{clean_query} ({po_name}, {district}, {state})",
                                            city=district,
                                            state=state,
                                            country="India",
                                        )
            except Exception as e:
                logger.warning(f"India Postal API fallback error for '{clean_query}': {e}")

        # 3. Standard City / Locality Geocoding via Nominatim
        search_queries = [clean_query]
        if "india" not in clean_query.lower():
            search_queries.append(f"{clean_query}, India")

        for sq in search_queries:
            try:
                params = {
                    "q": sq,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 1,
                }
                with httpx.Client(timeout=8.0) as client:
                    res = client.get(f"{self.NOMINATIM_BASE}/search", params=params, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        if data and len(data) > 0:
                            top = data[0]
                            addr = top.get("address", {})
                            city = (
                                addr.get("city")
                                or addr.get("town")
                                or addr.get("village")
                                or addr.get("county")
                                or addr.get("state_district")
                            )
                            return GeocodeResult(
                                latitude=float(top["lat"]),
                                longitude=float(top["lon"]),
                                display_name=top.get("display_name", clean_query),
                                city=city,
                                state=addr.get("state"),
                                country=addr.get("country"),
                            )
            except Exception as e:
                logger.warning(f"Nominatim search error for '{sq}': {e}")

        # 4. PIN Prefix Cluster Fallback if external APIs are completely unreachable
        if is_pin and clean_query.startswith("560"):
            return GeocodeResult(
                latitude=12.9716,
                longitude=77.5946,
                display_name=f"Bengaluru ({clean_query}, Karnataka, India)",
                city="Bengaluru",
                state="Karnataka",
                country="India",
            )

        return None

    def get_nearby_facilities(
        self,
        latitude: float,
        longitude: float,
        facility_type: str = "hospital",
        radius_meters: int = 5000,
        location_name: Optional[str] = None,
    ) -> NearbyCareListResponse:
        """
        Fetch real healthcare facilities near (latitude, longitude) strictly within radius_meters.
        Enforces subset monotonicity: F(2km) <= F(5km) <= F(10km) <= F(20km) via candidate caching.
        Strictly filters out any facility where distance > radius_meters + TOLERANCE_METERS.
        """
        if not is_valid_coordinate(latitude, longitude):
            return NearbyCareListResponse(
                facilities=[],
                total_count=0,
                facility_type=facility_type,
                radius_meters=radius_meters,
                radius_km=round(radius_meters / 1000.0, 2),
                tolerance_meters=TOLERANCE_METERS,
                center_lat=0.0,
                center_lng=0.0,
                location_name=location_name,
                origin_type="manual" if location_name else "gps",
                origin_label=location_name or "Unknown Origin",
            )

        norm_type = "laboratory" if "lab" in facility_type.lower() else "hospital"
        radius = max(500, min(radius_meters, 50000))

        # Check candidate cache to enforce monotonicity and eliminate Overpass flapping
        cache_key = (round(latitude, 3), round(longitude, 3), norm_type)
        now = time.time()
        cached_entry = _CANDIDATE_CACHE.get(cache_key)

        candidate_pool: List[NearbyFacilityItem] = []
        if (
            cached_entry
            and (now - cached_entry.timestamp < CACHE_TTL_SECONDS)
            and cached_entry.max_radius >= radius
        ):
            candidate_pool = cached_entry.candidates
        else:
            # Query candidate pool with max(radius, 20000) so all standard radius options (2, 5, 10, 20 km)
            # share the same underlying pool, ensuring strict mathematical subset monotonicity
            fetch_radius = max(radius, 20000)
            fetched: List[NearbyFacilityItem] = []

            # 1. Google Places (if configured)
            if self.google_api_key:
                try:
                    fetched = self._fetch_from_google_places(
                        latitude, longitude, norm_type, fetch_radius
                    )
                except Exception as e:
                    logger.warning(
                        f"Google Places API fetch failed: {e}. Falling back to OpenStreetMap Overpass."
                    )
                    fetched = []

            # 2. OpenStreetMap Overpass
            if not fetched:
                fetched = self._fetch_from_overpass(
                    latitude, longitude, norm_type, fetch_radius
                )

            # 3. Nominatim POI search fallback
            if not fetched:
                fetched = self._fetch_from_nominatim_poi(
                    latitude, longitude, norm_type, fetch_radius
                )

            # 4. Verified Hubs fallback
            hubs = self._get_verified_hub_fallbacks(
                latitude, longitude, norm_type, fetch_radius
            )
            if not fetched:
                fetched = hubs
            else:
                fetched.extend(hubs)

            # Deduplicate candidate pool by coordinate and normalized name
            seen_keys = set()
            deduped_pool: List[NearbyFacilityItem] = []
            for f in fetched:
                if not is_valid_coordinate(f.latitude, f.longitude):
                    continue
                key = f"{round(f.latitude, 4)}_{round(f.longitude, 4)}_{f.name.strip().lower()}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    deduped_pool.append(f)

            candidate_pool = deduped_pool
            _CANDIDATE_CACHE[cache_key] = CandidateCacheEntry(
                candidates=candidate_pool,
                timestamp=now,
                max_radius=fetch_radius,
            )

        # STRICT RADIUS FILTER CONTRACT:
        # Distance must be <= radius_meters + TOLERANCE_METERS (5.0 m)
        max_allowed_meters = radius + TOLERANCE_METERS
        eligible_facilities: List[NearbyFacilityItem] = []

        for fac in candidate_pool:
            if not is_valid_coordinate(fac.latitude, fac.longitude):
                continue

            # Compute exact distance from active search origin in meters
            exact_meters = calculate_haversine_distance_meters(
                latitude, longitude, fac.latitude, fac.longitude
            )

            # Apply strict boundary check
            if exact_meters <= max_allowed_meters:
                item = fac.model_copy()
                item.distance_meters = round(exact_meters, 1)
                item.distance = round(exact_meters / 1000.0, 2)
                if not item.maps_url:
                    item.maps_url = f"https://www.google.com/maps/dir/?api=1&destination={fac.latitude},{fac.longitude}"
                eligible_facilities.append(item)

        # Sort strictly by distance (nearest to farthest)
        eligible_facilities.sort(
            key=lambda x: x.distance_meters if x.distance_meters is not None else (x.distance * 1000.0)
        )

        origin_type = "manual" if location_name else "gps"
        origin_label = location_name or "Current GPS Location"

        return NearbyCareListResponse(
            facilities=eligible_facilities,
            total_count=len(eligible_facilities),
            facility_type=norm_type,
            radius_meters=radius,
            radius_km=round(radius / 1000.0, 2),
            tolerance_meters=TOLERANCE_METERS,
            center_lat=latitude,
            center_lng=longitude,
            location_name=location_name,
            origin_type=origin_type,
            origin_label=origin_label,
        )

    def _get_verified_hub_fallbacks(
        self, latitude: float, longitude: float, facility_type: str, radius: int
    ) -> List[NearbyFacilityItem]:
        """
        Retrieves verified healthcare hub facilities within the search radius.
        Always strictly filtered by distance <= radius + TOLERANCE_METERS.
        """
        results: List[NearbyFacilityItem] = []
        max_allowed_meters = radius + TOLERANCE_METERS

        for hub in VERIFIED_INDIAN_HEALTHCARE_HUBS:
            if hub.get("category") != facility_type:
                continue

            hub_lat = hub.get("lat")
            hub_lon = hub.get("lon")
            if not is_valid_coordinate(hub_lat, hub_lon):
                continue

            dist_m = calculate_haversine_distance_meters(latitude, longitude, hub_lat, hub_lon)
            if dist_m <= max_allowed_meters:
                results.append(
                    NearbyFacilityItem(
                        id=hub["id"],
                        name=hub["name"],
                        type=hub["type"],
                        category=hub["category"],
                        address=hub["address"],
                        latitude=hub_lat,
                        longitude=hub_lon,
                        distance=round(dist_m / 1000.0, 2),
                        distance_meters=round(dist_m, 1),
                        distance_unit="km",
                        rating=hub.get("rating"),
                        open_now=True,
                        phone=hub.get("phone"),
                        website=hub.get("website"),
                        maps_url=f"https://www.google.com/maps/dir/?api=1&destination={hub_lat},{hub_lon}",
                    )
                )

        return results

    def _fetch_from_overpass(
        self, latitude: float, longitude: float, facility_type: str, radius: int
    ) -> List[NearbyFacilityItem]:
        """
        Queries OpenStreetMap Overpass API for real hospitals, clinics, or diagnostic laboratories.
        """
        if facility_type == "laboratory":
            query = f"""
            [out:json][timeout:10];
            (
              nwr["amenity"="laboratory"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="laboratory"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="blood_bank"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="pathology"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="sample_collection"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="medical_laboratory"](around:{radius},{latitude},{longitude});
              nwr["craft"="laboratory"](around:{radius},{latitude},{longitude});
              node["amenity"="clinic"](around:{radius},{latitude},{longitude})[name~"Diagnostic|Pathology|Lab|Thyrocare|Lal PathLabs|Metropolis|SRL|Blood",i];
              node["healthcare"](around:{radius},{latitude},{longitude})[name~"Diagnostic|Pathology|Lab|Thyrocare|Lal PathLabs|Metropolis|SRL|Blood",i];
            );
            out center tags;
            """
        else:
            query = f"""
            [out:json][timeout:15];
            (
              nwr["amenity"="hospital"](around:{radius},{latitude},{longitude});
              nwr["amenity"="clinic"](around:{radius},{latitude},{longitude});
              nwr["amenity"="doctors"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="hospital"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="clinic"](around:{radius},{latitude},{longitude});
              nwr["healthcare"="centre"](around:{radius},{latitude},{longitude});
            );
            out center tags;
            """

        headers = {"User-Agent": self.USER_AGENT}

        for endpoint in self.OVERPASS_ENDPOINTS:
            try:
                with httpx.Client(timeout=6.0) as client:
                    res = client.post(endpoint, data={"data": query}, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        elements = data.get("elements", [])
                        return self._parse_overpass_elements(
                            elements, latitude, longitude, facility_type
                        )
                    else:
                        logger.warning(
                            f"Overpass endpoint {endpoint} returned status {res.status_code}"
                        )
            except Exception as e:
                logger.warning(f"Overpass endpoint {endpoint} error: {e}. Trying next mirror...")

        return []

    def _parse_overpass_elements(
        self,
        elements: List[Dict[str, Any]],
        user_lat: float,
        user_lon: float,
        facility_type: str,
    ) -> List[NearbyFacilityItem]:
        results: List[NearbyFacilityItem] = []

        for el in elements:
            # Extract coordinates (node lat/lon or way/relation center)
            lat = el.get("lat")
            lon = el.get("lon")
            if lat is None or lon is None:
                center = el.get("center", {})
                lat = center.get("lat")
                lon = center.get("lon")

            if not is_valid_coordinate(lat, lon):
                continue

            lat = float(lat)
            lon = float(lon)
            tags = el.get("tags", {})

            # Name extraction
            name = (
                tags.get("name")
                or tags.get("name:en")
                or tags.get("official_name")
                or tags.get("operator")
            )

            # Determine facility specific type
            amenity = tags.get("amenity", "")
            healthcare = tags.get("healthcare", "")

            specific_type = "Healthcare Facility"
            if facility_type == "laboratory":
                if any(x in (name or "").lower() for x in ["pathology", "path"]):
                    specific_type = "Pathology Laboratory"
                elif any(x in (name or "").lower() for x in ["diagnostic", "diagnostics"]):
                    specific_type = "Diagnostic Center"
                elif "blood" in (name or "").lower() or healthcare == "blood_bank":
                    specific_type = "Blood Testing Center"
                elif healthcare == "laboratory" or amenity == "laboratory":
                    specific_type = "Medical Diagnostic Laboratory"
                else:
                    specific_type = "Clinical Diagnostic Laboratory"
            else:
                if amenity == "hospital" or healthcare == "hospital":
                    specific_type = "Hospital"
                elif amenity == "clinic" or healthcare == "clinic":
                    specific_type = "Medical Clinic"
                elif amenity == "doctors":
                    specific_type = "Doctor's Medical Center"
                elif healthcare == "centre":
                    specific_type = "Health Care Centre"
                else:
                    specific_type = "Hospital / Medical Center"

            if not name:
                name = f"{specific_type} (Nearby)"

            # Construct clean address
            address_parts = []
            if tags.get("addr:housenumber"):
                address_parts.append(tags["addr:housenumber"])
            if tags.get("addr:street"):
                address_parts.append(tags["addr:street"])
            if tags.get("addr:suburb"):
                address_parts.append(tags["addr:suburb"])
            if tags.get("addr:district"):
                address_parts.append(tags["addr:district"])
            if tags.get("addr:city"):
                address_parts.append(tags["addr:city"])
            if tags.get("addr:postcode"):
                address_parts.append(tags["addr:postcode"])

            if address_parts:
                address = ", ".join(address_parts)
            elif tags.get("addr:full"):
                address = tags["addr:full"]
            else:
                address = f"Near {round(lat, 3)}°N, {round(lon, 3)}°E"

            # Check 24/7 or opening hours
            opening_hours = tags.get("opening_hours", "")
            open_now = None
            if opening_hours:
                if "24/7" in opening_hours:
                    open_now = True

            # Contact
            phone = tags.get("phone") or tags.get("contact:phone") or tags.get("emergency:phone")
            website = tags.get("website") or tags.get("contact:website")

            dist_m = calculate_haversine_distance_meters(user_lat, user_lon, lat, lon)
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lon}"

            results.append(
                NearbyFacilityItem(
                    id=f"osm_{el.get('type', 'node')}_{el.get('id', len(results)+1)}",
                    name=name,
                    type=specific_type,
                    category=facility_type,
                    address=address,
                    latitude=lat,
                    longitude=lon,
                    distance=round(dist_m / 1000.0, 2),
                    distance_meters=round(dist_m, 1),
                    distance_unit="km",
                    rating=None,  # OSM does not have verified reviews
                    open_now=open_now,
                    phone=phone,
                    website=website,
                    maps_url=maps_url,
                )
            )

        return results

    def _fetch_from_nominatim_poi(
        self, latitude: float, longitude: float, facility_type: str, radius: int
    ) -> List[NearbyFacilityItem]:
        """
        Fallback POI query using Nominatim when Overpass is busy.
        Enforces strict radius boundary (distance_meters <= radius + TOLERANCE_METERS).
        """
        results: List[NearbyFacilityItem] = []
        search_terms = (
            ["diagnostic laboratory", "pathology lab", "blood test lab"]
            if facility_type == "laboratory"
            else ["hospital", "clinic", "medical center"]
        )

        max_allowed_meters = radius + TOLERANCE_METERS
        headers = {"User-Agent": self.USER_AGENT}
        for term in search_terms:
            try:
                # Viewbox roughly spanning the query radius
                deg_offset = min(0.25, (radius / 111000.0) * 1.1)
                params = {
                    "q": f"{term}",
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 20,
                    "viewbox": f"{longitude - deg_offset},{latitude + deg_offset},{longitude + deg_offset},{latitude - deg_offset}",
                    "bounded": 1,
                }
                with httpx.Client(timeout=8.0) as client:
                    res = client.get(f"{self.NOMINATIM_BASE}/search", params=params, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        for item in data:
                            lat_val = item.get("lat")
                            lon_val = item.get("lon")
                            if not is_valid_coordinate(lat_val, lon_val):
                                continue

                            lat = float(lat_val)
                            lon = float(lon_val)
                            dist_m = calculate_haversine_distance_meters(latitude, longitude, lat, lon)
                            if dist_m <= max_allowed_meters:
                                results.append(
                                    NearbyFacilityItem(
                                        id=f"nom_{item.get('place_id', len(results)+1)}",
                                        name=item.get("name") or item.get("display_name", "").split(",")[0],
                                        type="Diagnostic Laboratory" if facility_type == "laboratory" else "Hospital / Clinic",
                                        category=facility_type,
                                        address=item.get("display_name", "Local Address"),
                                        latitude=lat,
                                        longitude=lon,
                                        distance=round(dist_m / 1000.0, 2),
                                        distance_meters=round(dist_m, 1),
                                        distance_unit="km",
                                        maps_url=f"https://www.google.com/maps/dir/?api=1&destination={lat},{lon}",
                                    )
                                )
            except Exception as e:
                logger.warning(f"Nominatim POI query error for '{term}': {e}")

        return results

    def _fetch_from_google_places(
        self, latitude: float, longitude: float, facility_type: str, radius: int
    ) -> List[NearbyFacilityItem]:
        """
        Queries Google Places Nearby Search API if GOOGLE_PLACES_API_KEY is configured.
        Enforces strict radius boundary (distance_meters <= radius + TOLERANCE_METERS).
        """
        results: List[NearbyFacilityItem] = []
        keyword = "diagnostic laboratory pathology blood test HbA1c" if facility_type == "laboratory" else "hospital clinic"
        g_type = "medical_lab" if facility_type == "laboratory" else "hospital"

        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{latitude},{longitude}",
            "radius": radius,
            "keyword": keyword,
            "type": g_type,
            "key": self.google_api_key,
        }

        max_allowed_meters = radius + TOLERANCE_METERS

        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                places = data.get("results", [])
                for p in places:
                    geom = p.get("geometry", {}).get("location", {})
                    lat = geom.get("lat")
                    lng = geom.get("lng")
                    if not is_valid_coordinate(lat, lng):
                        continue

                    lat = float(lat)
                    lng = float(lng)
                    dist_m = calculate_haversine_distance_meters(latitude, longitude, lat, lng)
                    if dist_m <= max_allowed_meters:
                        rating = p.get("rating")
                        open_now = p.get("opening_hours", {}).get("open_now")

                        results.append(
                            NearbyFacilityItem(
                                id=f"gplace_{p.get('place_id', len(results)+1)}",
                                name=p.get("name", "Healthcare Facility"),
                                type="Diagnostic Laboratory" if facility_type == "laboratory" else "Hospital",
                                category=facility_type,
                                address=p.get("vicinity", "Local Area"),
                                latitude=lat,
                                longitude=lng,
                                distance=round(dist_m / 1000.0, 2),
                                distance_meters=round(dist_m, 1),
                                distance_unit="km",
                                rating=float(rating) if rating is not None else None,
                                open_now=open_now,
                                maps_url=f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}",
                            )
                        )

        return results
