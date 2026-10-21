import "./FindCare.css";
import { useState, useRef } from "react";
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
  const [activeTab, setActiveTab] = useState("hospital"); // 'hospital' | 'laboratory'
  const [radius, setRadius] = useState(5000); // 5000 meters = 5 km default
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'map'

  // Location state
  const [location, setLocation] = useState(null); // { lat, lng, name, accuracy }
  const [locationStatus, setLocationStatus] = useState("idle"); // 'idle' | 'locating' | 'success' | 'error'
  const [locationError, setLocationError] = useState("");
  const [manualQuery, setManualQuery] = useState("");

  // Results state
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [searchWarning, setSearchWarning] = useState(null);
  const [providerStatus, setProviderStatus] = useState(null);
  const requestIdRef = useRef(0);

  // Request user's current GPS location with high precision and accuracy tracking
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      const err = "Geolocation is not supported by your browser.";
      setLocationStatus("error");
      setLocationError(err);
      toast.error(err);
      return;
    }

    setLocationStatus("locating");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracyMeters = position.coords.accuracy ? Math.round(position.coords.accuracy) : null;

        // Validate finite numbers
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          const invalidErr = "Received invalid geographical coordinates from device.";
          setLocationStatus("error");
          setLocationError(invalidErr);
          toast.error(invalidErr);
          return;
        }

        const coords = {
          lat,
          lng,
          name: accuracyMeters ? `Current GPS (±${accuracyMeters}m)` : "Current GPS Location",
          accuracy: accuracyMeters,
        };

        setLocation(coords);
        setLocationStatus("success");
        setLocationError("");
        toast.success(`📍 GPS location acquired (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`);
        fetchFacilities(coords.lat, coords.lng, activeTab, radius, "Current GPS Location");
      },
      (err) => {
        setLocationStatus("error");
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

  // Manual search by city / locality / pincode
  const handleManualSearch = async (e) => {
    if (e) e.preventDefault();
    if (!manualQuery.trim()) {
      toast.error(t("findCare.enterLocationPrompt") || "Please enter a city, area, or PIN code.");
      return;
    }

    setLocationStatus("locating");
    setLocationError("");
    setLoading(true);

    try {
      const res = await nearbyCareService.geocodeLocation(manualQuery.trim());
      if (res && res.data) {
        const coords = {
          lat: res.data.latitude,
          lng: res.data.longitude,
          name: res.data.display_name,
          accuracy: null,
        };
        setLocation(coords);
        setLocationStatus("success");
        setLocationError("");
        const locLabel = res.data.city || res.data.display_name.split(",")[0];
        toast.success(t("findCare.foundLocation", { location: locLabel }) || `📍 Found location: ${locLabel}`);
        fetchFacilities(coords.lat, coords.lng, activeTab, radius, res.data.display_name);
      } else {
        throw new Error(`Unable to resolve location for "${manualQuery.trim()}".`);
      }
    } catch (err) {
      setLocationStatus("error");
      const msg = err.message || t("findCare.locateError", { query: manualQuery }) || `Unable to locate "${manualQuery}". Please verify your city or PIN code.`;
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
          // Enforce strict client-side boundary contract: distance <= (radius / 1000) + 5m tolerance
          const maxAllowedKm = (rad / 1000.0) + 0.005;
          const validFacilities = data.facilities.filter((fac) => {
            return fac.distance <= maxAllowedKm;
          });

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
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        const errorMsg = err.message || t("findCare.facilitiesFetchError") || "Unable to find nearby healthcare facilities right now. Please try again.";
        toast.error(errorMsg);
        setFacilities([]);
        setSelectedFacility(null);
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
                "Locate authentic healthcare facilities, multi-specialty hospitals, and diabetes pathology testing labs near your exact coordinates or postal zone."}
            </p>
          </div>

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
                    {t("findCare.locationSubtext") || "Use high-accuracy GPS or enter an Indian PIN code / city area"}
                  </p>
                </div>
              </div>

              {locationStatus === "success" && location && (
                <div className="location-status-badge success">
                  <FaCheckCircle /> {t("findCare.locationDetected") || "Active Search Origin"}:{" "}
                  <strong>
                    {location.name?.length > 40 ? location.name.slice(0, 40) + "..." : location.name}
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
                {locationStatus === "locating" ? (
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
                    placeholder={t("findCare.searchPlaceholder") || "Enter Area, PIN code (e.g. 560049, 560001) or City..."}
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

            {/* Error Message Box */}
            {locationStatus === "error" && locationError && (
              <div className="location-error-banner">
                <FaExclamationTriangle className="err-icon" />
                <div>
                  <strong>{t("findCare.locationNotice") || "Location Notice"}: </strong>
                  <span>{locationError}</span>
                </div>
              </div>
            )}
          </div>

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
                <h3>{t("findCare.findingCare") || "Searching Healthcare Facilities..."}</h3>
                <p>Querying verified medical providers strictly within {radius / 1000} km radius.</p>
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
                  {t("findCare.readyDesc") ||
                    "Click 'Use My GPS Location' or enter your area name/PIN code above to find nearby hospitals, clinics, and diabetes testing laboratories."}
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
                  {t("findCare.noResults") || "No healthcare facilities found within"} {radius / 1000} km
                </h3>
                <p>
                  No matching {activeTab === "hospital" ? "hospitals or medical clinics" : "diagnostic laboratories"}{" "}
                  were identified strictly within {radius / 1000} km of your active origin ({location.name}).
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

            {/* Results Header */}
            {!loading && facilities.length > 0 && (
              <div className="results-summary-bar">
                <span className="count-badge">
                  Found <strong>{facilities.length}</strong>{" "}
                  {activeTab === "hospital" ? "Hospitals & Clinics" : "Diagnostic Laboratories"}
                </span>
                <span className="radius-indicator">
                  Strictly within {radius / 1000} km • Sorted by Distance
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

            {/* View Mode 2: Interactive Map View */}
            {!loading && facilities.length > 0 && viewMode === "map" && (
              <div className="map-view-layout">
                {/* Facilities Sidebar on Desktop */}
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
                          <FaDirections /> {t("common.getDirections") || "Directions"}
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
                          <FaDirections /> {t("common.openGoogleMaps") || "Open Directions"}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Multi-Facility Interactive Map Canvas */}
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
                "DiaSense AI provides facility locations and contact information for healthcare accessibility and emergency guidance. Always verify emergency availability and bed status directly with the hospital before transit in life-threatening scenarios."}
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default FindCare;
