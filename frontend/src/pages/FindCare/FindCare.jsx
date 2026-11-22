import "./FindCare.css";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import FacilityMap from "./FacilityMap";
import {
  FaHospital,
  FaVial,
  FaMapMarkerAlt,
  FaSearch,
  FaLocationArrow,
  FaDirections,
  FaPhone,
  FaStar,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
  FaMapMarkedAlt,
  FaList,
  FaClock,
  FaCompass,
  FaInfoCircle,
  FaShieldAlt,
  FaRedoAlt,
  FaSignInAlt,
} from "react-icons/fa";
import { nearbyCareService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";

const RADIUS_OPTIONS = [
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
];

function FindCare() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("hospital"); // 'hospital' | 'laboratory'
  const [radius, setRadius] = useState(5000); // 5000 meters = 5 km default
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'

  // Location & Search state
  const [location, setLocation] = useState(null); // { lat, lng, name, accuracy, details }
  const [locationStatus, setLocationStatus] = useState("idle"); // 'idle' | 'locating' | 'success' | 'error'
  const [locationError, setLocationError] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [searchStage, setSearchStage] = useState("idle"); // 'idle' | 'validating_pin' | 'finding_postal' | 'searching_facilities' | 'complete' | 'error'

  // Results state
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [searchWarning, setSearchWarning] = useState(null);
  const [providerStatus, setProviderStatus] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestIdRef = useRef(0);

  // Check authentication status on mount & listen for 401 events
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setSessionExpired(true);
    }

    const handleUnauthorized = () => {
      setSessionExpired(true);
      setLoading(false);
      setLocationStatus("error");
    };

    window.addEventListener("diasense:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("diasense:unauthorized", handleUnauthorized);
  }, []);

  // Request user's current GPS location with high precision and accuracy tracking
  const handleUseCurrentLocation = () => {
    if (sessionExpired || !localStorage.getItem("access_token")) {
      setSessionExpired(true);
      toast.warn("🔐 Please log in to search healthcare facilities using GPS.");
      return;
    }

    if (!navigator.geolocation) {
      const err = "Geolocation is not supported by your browser.";
      setLocationStatus("error");
      setLocationError(err);
      toast.error(err);
      return;
    }

    setLocationStatus("locating");
    setLocationError("");
    setSearchStage("searching_facilities");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracyMeters = position.coords.accuracy ? Math.round(position.coords.accuracy) : null;

        // Validate finite numbers within India bounds
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          const invalidErr = "Received invalid geographical coordinates from device.";
          setLocationStatus("error");
          setLocationError(invalidErr);
          toast.error(invalidErr);
          setSearchStage("error");
          return;
        }

        const coords = {
          lat,
          lng,
          name: accuracyMeters ? `Current GPS (±${accuracyMeters}m)` : "Current GPS Location",
          accuracy: accuracyMeters,
          details: null,
        };

        setLocation(coords);
        setLocationStatus("success");
        setLocationError("");
        toast.success(`📍 GPS location acquired (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`);
        fetchFacilities(coords.lat, coords.lng, activeTab, radius, "Current GPS Location");
      },
      (err) => {
        setLocationStatus("error");
        setSearchStage("error");
        let msg = "We couldn't determine your current location. Please try again or search manually.";
        if (err.code === 1) {
          msg = t("findCare.permissionDenied") || "Location permission was denied. Please allow location access or type your locality/PIN code.";
        } else if (err.code === 2) {
          msg = t("findCare.locationUnavailable") || "Location position unavailable. Please type your city, area, or PIN code.";
        } else if (err.code === 3) {
          msg = t("findCare.locationTimeout") || "Location request timed out. Please retry or enter your area name manually.";
        }
        setLocationError(msg);
        toast.warn(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  // Manual search by PIN code / locality / city
  const handleManualSearch = async (e) => {
    if (e) e.preventDefault();

    if (sessionExpired || !localStorage.getItem("access_token")) {
      setSessionExpired(true);
      toast.warn("🔐 Please log in to search healthcare facilities.");
      return;
    }

    const cleanQuery = manualQuery.trim();
    if (!cleanQuery) {
      toast.error(t("findCare.enterLocationPrompt") || "Please enter a 6-digit Indian PIN code or city name.");
      return;
    }

    const isSixDigitPin = /^[1-9]\d{5}$/.test(cleanQuery);
    const isDigitsOnly = /^\d+$/.test(cleanQuery);

    if (isDigitsOnly && !isSixDigitPin) {
      toast.warn("Indian PIN codes must be exactly 6 digits (e.g. 560039, 110001). Searching with available postal index...");
    }

    setLocationStatus("locating");
    setLocationError("");
    setLoading(true);

    if (isSixDigitPin) {
      setSearchStage("validating_pin");
    } else {
      setSearchStage("finding_postal");
    }

    try {
      if (isSixDigitPin) {
        setSearchStage("finding_postal");
      }

      const res = await nearbyCareService.geocodeLocation(cleanQuery);
      if (res && res.data) {
        const data = res.data;
        const coords = {
          lat: data.latitude,
          lng: data.longitude,
          name: data.display_name,
          accuracy: null,
          details: data,
        };

        setLocation(coords);
        setLocationStatus("success");
        setLocationError("");

        const locLabel = data.post_office || data.city || data.display_name.split(",")[0];
        toast.success(t("findCare.foundLocation", { location: locLabel }) || `📍 Resolved postal area: ${locLabel}`);

        setSearchStage("searching_facilities");
        fetchFacilities(coords.lat, coords.lng, activeTab, radius, data.display_name);
      } else {
        throw new Error(`Unable to resolve location for "${cleanQuery}".`);
      }
    } catch (err) {
      if (
        err.isAuthError ||
        err.status === 401 ||
        (err.message && (err.message.toLowerCase().includes("credentials") || err.message.toLowerCase().includes("token")))
      ) {
        setSessionExpired(true);
        setLocationStatus("error");
        setSearchStage("error");
        setLoading(false);
        return;
      }

      setLocationStatus("error");
      setSearchStage("error");
      const msg =
        err.message ||
        t("findCare.locateError", { query: cleanQuery }) ||
        `Unable to locate "${cleanQuery}". Please verify your 6-digit Indian PIN code or city name.`;
      setLocationError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  // Fetch facilities from backend with strict radius filtering & diagnostic capture
  const fetchFacilities = async (lat, lng, type, rad, locName) => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setSearchedOnce(true);
    setSearchWarning(null);

    try {
      const response = await nearbyCareService.getNearbyCare({
        latitude: lat,
        longitude: lng,
        type: type,
        radius: rad,
      });

      // Ignore response if a newer search request was initiated
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (response && response.data) {
        const data = response.data;
        setSearchWarning(data.search_warning || null);
        setProviderStatus(data.provider_status || null);

        if (data.facilities && data.facilities.length > 0) {
          // Strict client-side boundary safeguard: distance <= (radius / 1000)
          const maxAllowedKm = rad / 1000.0;
          const validFacilities = data.facilities.filter((fac) => {
            return fac.distance <= maxAllowedKm;
          });

          // Sort nearest first
          validFacilities.sort((a, b) => a.distance - b.distance);

          setFacilities(validFacilities);
          setSelectedFacility(validFacilities.length > 0 ? validFacilities[0] : null);
        } else {
          setFacilities([]);
          setSelectedFacility(null);
        }
      } else {
        setFacilities([]);
        setSelectedFacility(null);
      }
      setSearchStage("complete");
    } catch (err) {
      if (
        err.isAuthError ||
        err.status === 401 ||
        (err.message && (err.message.toLowerCase().includes("credentials") || err.message.toLowerCase().includes("token")))
      ) {
        setSessionExpired(true);
        setLoading(false);
        setSearchStage("error");
        return;
      }

      if (currentRequestId === requestIdRef.current) {
        const errorMsg =
          err.message ||
          t("findCare.facilitiesFetchError") ||
          "Unable to find nearby healthcare facilities right now. Please try again.";
        toast.error(errorMsg);
        setFacilities([]);
        setSelectedFacility(null);
        setSearchStage("error");
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle Tab Switch
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (location) {
      fetchFacilities(location.lat, location.lng, newTab, radius, location.name);
    }
  };

  // Handle Radius Change
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (location) {
      fetchFacilities(location.lat, location.lng, activeTab, newRadius, location.name);
    }
  };

  // Increase radius for empty state
  const handleIncreaseRadius = () => {
    let nextRadius = 10000;
    if (radius === 2000) nextRadius = 5000;
    else if (radius === 5000) nextRadius = 10000;
    else if (radius === 10000) nextRadius = 20000;
    else nextRadius = 50000;

    setRadius(nextRadius);
    if (location) {
      fetchFacilities(location.lat, location.lng, activeTab, nextRadius, location.name);
    }
  };

  const handleRetrySearch = () => {
    if (location) {
      fetchFacilities(location.lat, location.lng, activeTab, radius, location.name);
    } else {
      handleUseCurrentLocation();
    }
  };

  return (
    <>
      <Navbar />

      <div className="find-care-page">
        <div className="find-care-container">
          <BackButton />

          {/* Hero Header */}
          <div className="find-care-header text-center">
            <span className="badge-pill">
              <FaMapMarkerAlt /> {t("findCare.headerBadge") || "Medical Care Network"}
            </span>
            <h1>{t("findCare.headerTitle") || "Find Nearby Hospitals & Diagnostic Centers"}</h1>
            <p>
              {t("findCare.headerDesc") ||
                "Locate authentic healthcare facilities, multi-specialty hospitals, and diabetes pathology testing labs across India using any 6-digit PIN code or GPS coordinates."}
            </p>
          </div>

          {/* Session Expired / Authentication Banner */}
          {sessionExpired && (
            <div className="session-expired-card">
              <div className="session-alert-content">
                <div className="session-alert-icon-box">
                  <FaShieldAlt />
                </div>
                <div>
                  <h3>Authentication Required</h3>
                  <p>
                    Your login session has expired or is unverified. Please sign in to search real healthcare facilities, access interactive mapping, and get Google Maps navigation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-session-signin"
                onClick={() => navigate("/login", { state: { from: "/find-care" } })}
              >
                <FaSignInAlt /> Sign In to Continue
              </button>
            </div>
          )}

          {/* Location Action Card */}
          <div className="location-card">
            <div className="location-card-header">
              <div className="location-icon-title">
                <div className="loc-pin-icon">
                  <FaCompass />
                </div>
                <div>
                  <h2>{t("findCare.yourLocation") || "Your Location"}</h2>
                  <p className="card-subtext">
                    Enter any 6-digit Indian PIN code (e.g. 560039, 110001, 781001) or use GPS
                  </p>
                </div>
              </div>

              {locationStatus === "success" && location && (
                <div className="location-status-badge success">
                  <FaCheckCircle /> {t("findCare.locationDetected") || "Active Origin"}:{" "}
                  <strong>
                    {location.name?.length > 45 ? location.name.slice(0, 45) + "..." : location.name}
                  </strong>
                  {location.accuracy && (
                    <span className="accuracy-pill" title="GPS reported horizontal accuracy">
                      (±{location.accuracy}m)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="location-inputs-grid">
              {/* GPS Button */}
              <button
                type="button"
                className="btn-use-location"
                onClick={handleUseCurrentLocation}
                disabled={locationStatus === "locating" || loading}
              >
                {locationStatus === "locating" && searchStage === "searching_facilities" && !manualQuery ? (
                  <>
                    <FaSpinner className="spin-icon" /> {t("findCare.obtainingGps") || "Acquiring GPS Fix..."}
                  </>
                ) : (
                  <>
                    <FaLocationArrow /> {t("findCare.useGpsBtn") || "Use My GPS Location"}
                  </>
                )}
              </button>

              <div className="divider-text">{t("findCare.or") || "OR"}</div>

              {/* Manual Form */}
              <form onSubmit={handleManualSearch} className="manual-location-form">
                <div className="input-with-button">
                  <input
                    type="text"
                    placeholder="Enter any 6-digit Indian PIN code (e.g. 560039, 110001) or City..."
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                  />
                  <button type="submit" className="btn-search-manual" disabled={loading}>
                    {loading && locationStatus === "locating" ? (
                      <FaSpinner className="spin-icon" />
                    ) : (
                      <>
                        <FaSearch /> {t("findCare.searchBtn") || "Search"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Search Stage Progress Indicator */}
            {loading && searchStage && searchStage !== "idle" && (
              <div className="search-stage-pill">
                <FaSpinner className="spin-icon stage-spin" />
                <span>
                  {searchStage === "validating_pin" && "Validating 6-digit Indian PIN code..."}
                  {searchStage === "finding_postal" && "Resolving postal jurisdiction from Department of Posts..."}
                  {searchStage === "searching_facilities" && `Discovering real healthcare facilities within ${(radius / 1000).toFixed(0)} km...`}
                  {searchStage === "loading_map" && "Loading interactive map..."}
                </span>
              </div>
            )}

            {/* Error Message Box */}
            {locationStatus === "error" && locationError && !sessionExpired && (
              <div className="location-error-banner">
                <FaExclamationTriangle className="err-icon" />
                <div>
                  <strong>{t("findCare.locationNotice") || "Location Notice"}: </strong>
                  <span>{locationError}</span>
                </div>
              </div>
            )}
          </div>

          {/* Resolved Postal Details & Accuracy Card */}
          {location && location.details && (
            <div className="postal-details-card">
              <div className="postal-header-row">
                <div className="postal-main-meta">
                  <span className="pincode-badge">
                    📮 {location.details.pincode ? `PIN ${location.details.pincode}` : "Locality Search"}
                  </span>
                  <h3>{location.details.formatted_address || location.name}</h3>
                </div>
                {location.details.confidence && (
                  <span className="confidence-pill" title="Geocoding Confidence">
                    {Math.round(location.details.confidence * 100)}% Confidence
                  </span>
                )}
              </div>

              {location.details.post_offices && location.details.post_offices.length > 1 && (
                <div className="covered-offices-box">
                  <span className="offices-label">Covered Post Offices in Postal Area:</span>
                  <div className="offices-tags">
                    {location.details.post_offices.slice(0, 6).map((po, idx) => (
                      <span key={idx} className="office-tag">
                        {po}
                      </span>
                    ))}
                    {location.details.post_offices.length > 6 && (
                      <span className="office-tag more">
                        +{location.details.post_offices.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Required Location Accuracy Notice */}
              <div className="approximate-notice-box">
                <FaInfoCircle className="notice-icon" />
                <p>
                  {location.details.approximate_notice ||
                    "PIN-code searches identify an approximate postal area centroid, not your exact home address. Use GPS for more precise nearby results."}
                </p>
              </div>
            </div>
          )}

          {/* Facility Type Switcher & Controls */}
          <div className="care-controls-bar">
            {/* Primary Tabs */}
            <div className="facility-tabs">
              <button
                className={`tab-item ${activeTab === "hospital" ? "active" : ""}`}
                onClick={() => handleTabChange("hospital")}
              >
                <FaHospital /> 🏥 {t("findCare.hospitalsTab") || "Hospitals & Clinics"}
              </button>
              <button
                className={`tab-item ${activeTab === "laboratory" ? "active" : ""}`}
                onClick={() => handleTabChange("laboratory")}
              >
                <FaVial /> 🧪 {t("findCare.labsTab") || "Diagnostic Laboratories"}
              </button>
            </div>

            {/* Radius & View Selector */}
            <div className="controls-right">
              <div className="radius-selector">
                <span className="ctrl-label">{t("findCare.radiusLabel") || "Search Radius:"}</span>
                <div className="radius-chips">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`chip-btn ${radius === opt.value ? "active" : ""}`}
                      onClick={() => handleRadiusChange(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <FaList /> {t("findCare.listView") || "List"}
                </button>
                <button
                  className={`view-btn ${viewMode === "map" ? "active" : ""}`}
                  onClick={() => setViewMode("map")}
                  title="Interactive Map View"
                >
                  <FaMapMarkedAlt /> {t("findCare.mapView") || "Interactive Map"}
                </button>
              </div>
            </div>
          </div>

          {/* Diagnostic Warning Banner if live provider was slow / throttled */}
          {searchWarning && (
            <div className="search-warning-banner">
              <FaShieldAlt className="warn-icon" />
              <div>
                <strong>Information:</strong> {searchWarning}
              </div>
            </div>
          )}

          {/* Diagnostic Labs Informational Note */}
          {activeTab === "laboratory" && (
            <div className="lab-info-banner">
              <FaInfoCircle className="info-icon" />
              <div>
                <strong>{t("findCare.labNoteTitle") || "Diagnostic Testing Note:"}</strong>{" "}
                {t("findCare.labNoteDesc") ||
                  "Showing certified pathology and blood testing laboratories for HbA1c, Fasting Blood Sugar (FBS), and lipid profile screenings."}
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className="results-container">
            {/* Loading State */}
            {loading && (
              <div className="loading-state-card">
                <FaSpinner className="spin-icon-large" />
                <h3>{t("findCare.findingCare") || "Searching Real Healthcare Facilities..."}</h3>
                <p>
                  Querying verified medical providers strictly within {(radius / 1000).toFixed(0)} km radius.
                </p>
              </div>
            )}

            {/* Prompt to set location */}
            {!loading && !location && !searchedOnce && (
              <div className="initial-prompt-card">
                <div className="prompt-icon">
                  <FaCompass />
                </div>
                <h3>{t("findCare.readyPrompt") || "Discover Healthcare Facilities Near You"}</h3>
                <p>
                  Enter any 6-digit Indian PIN code (e.g. 560039, 110001, 781001) or click 'Use My GPS Location' above to find nearby hospitals, clinics, and diabetes testing laboratories.
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && location && facilities.length === 0 && (
              <div className="empty-state-card">
                <div className="empty-icon">
                  <FaExclamationTriangle />
                </div>
                <h3>
                  {t("findCare.noResults") || "No healthcare facilities found within"} {(radius / 1000).toFixed(0)} km
                </h3>
                <p>
                  No matching {activeTab === "hospital" ? "hospitals or medical clinics" : "diagnostic laboratories"}{" "}
                  were identified strictly within {(radius / 1000).toFixed(0)} km of your active origin ({location.name}).
                </p>
                <div className="empty-actions">
                  <button className="btn-increase-radius" onClick={handleIncreaseRadius}>
                    <FaSearch /> Expand search radius to {radius < 10000 ? "10 km" : "20 km"}
                  </button>
                  <button className="btn-retry-search" onClick={handleRetrySearch}>
                    <FaRedoAlt /> Retry Search
                  </button>
                </div>
              </div>
            )}

            {/* Results Summary Bar */}
            {!loading && facilities.length > 0 && (
              <div className="results-summary-bar">
                <span className="count-badge">
                  Found <strong>{facilities.length}</strong>{" "}
                  {activeTab === "hospital" ? "Hospitals & Clinics" : "Diagnostic Laboratories"}
                </span>
                <span className="radius-indicator">
                  Strictly within {(radius / 1000).toFixed(0)} km • Sorted by Distance
                </span>
              </div>
            )}

            {/* View Mode 1: List View */}
            {!loading && facilities.length > 0 && viewMode === "list" && (
              <div className="facilities-grid">
                {facilities.map((fac) => (
                  <div key={fac.id} className="facility-card">
                    <div className="card-top-row">
                      <div className="fac-icon-wrapper">
                        {fac.category === "laboratory" ? <FaVial /> : <FaHospital />}
                      </div>
                      <div className="fac-title-area">
                        <div className="fac-badge-row">
                          <span className="fac-type-pill">{fac.type}</span>
                          {fac.source === "verified_directory" && (
                            <span className="fac-source-pill" title="Verified Hospital Directory">
                              <FaShieldAlt /> Verified
                            </span>
                          )}
                        </div>
                        <h3>{fac.name}</h3>
                      </div>
                    </div>

                    <div className="fac-details">
                      <p className="fac-address">
                        <FaMapMarkerAlt className="detail-icon" />
                        <span>{fac.address}</span>
                      </p>

                      <div className="fac-meta-row">
                        <div className="meta-item distance">
                          <FaLocationArrow />
                          <strong>{fac.distance} km</strong> {t("findCare.distanceAway") || "away"}
                        </div>

                        {fac.open_now !== null && fac.open_now !== undefined && (
                          <div className={`meta-item status ${fac.open_now ? "open" : "closed"}`}>
                            <FaClock />
                            <span>{fac.open_now ? "Open Now (24/7)" : "Regular Hours"}</span>
                          </div>
                        )}

                        {fac.rating && (
                          <div className="meta-item rating">
                            <FaStar />
                            <span>{fac.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      {fac.phone && (
                        <p className="fac-phone">
                          <FaPhone className="detail-icon" />
                          <a href={`tel:${fac.phone}`}>{fac.phone}</a>
                        </p>
                      )}
                    </div>

                    <div className="card-actions">
                      <a
                        href={
                          fac.maps_url ||
                          fac.mapsUrl ||
                          `https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-directions"
                      >
                        <FaDirections /> {t("common.getDirections") || "Get Directions"}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View Mode 2: Real Interactive Geographic Map View */}
            {!loading && facilities.length > 0 && viewMode === "map" && (
              <div className="map-view-layout">
                {/* Facilities Sidebar */}
                <div className="map-sidebar">
                  <h3>Discovered Facilities ({facilities.length})</h3>
                  <div className="map-sidebar-list">
                    {facilities.map((fac) => (
                      <div
                        key={fac.id}
                        className={`map-sidebar-item ${selectedFacility?.id === fac.id ? "active" : ""}`}
                        onClick={() => setSelectedFacility(fac)}
                      >
                        <div className="sidebar-item-header">
                          <strong>{fac.name}</strong>
                          <span className="dist-tag">{fac.distance} km</span>
                        </div>
                        <p className="sidebar-address">{fac.address}</p>
                        <a
                          href={
                            fac.maps_url ||
                            fac.mapsUrl ||
                            `https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sidebar-dir-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FaDirections /> Directions
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map Display Card */}
                <div className="map-display-card">
                  {selectedFacility && (
                    <div className="map-selected-preview">
                      <div className="preview-header">
                        <div>
                          <span className="fac-type-pill">{selectedFacility.type}</span>
                          <h4>{selectedFacility.name}</h4>
                          <p className="prev-address">{selectedFacility.address}</p>
                        </div>
                        <div className="prev-dist">
                          <strong>{selectedFacility.distance} km</strong>
                        </div>
                      </div>
                      <div className="preview-action-row">
                        <a
                          href={
                            selectedFacility.maps_url ||
                            selectedFacility.mapsUrl ||
                            `https://www.google.com/maps/dir/?api=1&destination=${selectedFacility.latitude},${selectedFacility.longitude}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-directions-sm"
                        >
                          <FaDirections /> {t("common.openGoogleMaps") || "Open Google Maps"}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Leaflet Multi-Marker Interactive Map */}
                  <FacilityMap
                    facilities={facilities}
                    location={location}
                    radius={radius}
                    selectedFacility={selectedFacility}
                    onSelectFacility={setSelectedFacility}
                    activeTab={activeTab}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Medical Legal Disclaimer */}
          <div className="find-care-disclaimer">
            <h4>
              <FaInfoCircle /> {t("common.disclaimerTitle") || "Clinical Directory Disclaimer"}
            </h4>
            <p>
              {t("common.disclaimerText") ||
                "DiaSense AI provides healthcare facility locations and contact information for emergency accessibility and preventive diabetes care. Always verify bed and emergency department availability directly with the hospital before transit in life-threatening scenarios."}
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default FindCare;
