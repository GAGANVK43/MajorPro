import "./FindCare.css";
import { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
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

  // Single Authoritative Search Origin State
  // type: 'gps' | 'pincode' | 'manual'
  const [activeOrigin, setActiveOrigin] = useState(null); // { type, lat, lng, label, query }
  const [locationStatus, setLocationStatus] = useState("idle"); // 'idle' | 'locating' | 'success' | 'error'
  const [locationError, setLocationError] = useState("");
  const [manualQuery, setManualQuery] = useState("");

  // Results state
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  const currentRequestIdRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Request user's current GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      const err = "Geolocation is not supported by your browser.";
      setLocationStatus("error");
      setLocationError(err);
      toast.error(err);
      return;
    }

    // Cancel in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentRequestIdRef.current = null;

    setLocationStatus("locating");
    setLocationError("");
    setManualQuery(""); // Clear manual input so no conflicting postal code is displayed

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          type: "gps",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: `Current GPS Location (${position.coords.latitude.toFixed(4)}°N, ${position.coords.longitude.toFixed(4)}°E)`,
        };
        setActiveOrigin(origin);
        setLocationStatus("success");
        setLocationError("");
        toast.success("📍 Device GPS location detected successfully!");
        fetchFacilities(origin.lat, origin.lng, activeTab, radius, origin);
      },
      (err) => {
        setLocationStatus("error");
        let msg = "We couldn't determine your current location. Please try again or search manually.";
        if (err.code === 1) {
          msg = t("findCare.permissionDenied") || "Location permission denied. Please allow location access or search manually.";
        } else if (err.code === 2) {
          msg = t("findCare.locationUnavailable") || "Location information is currently unavailable.";
        } else if (err.code === 3) {
          msg = t("findCare.locationTimeout") || "The request to get user location timed out.";
        }
        setLocationError(msg);
        toast.warn(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  // Manual search by city / locality / pincode
  const handleManualSearch = async (e) => {
    if (e) e.preventDefault();
    if (!manualQuery.trim()) {
      toast.error("Please enter a city, area, or PIN code.");
      return;
    }

    // Cancel in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentRequestIdRef.current = null;

    setLocationStatus("locating");
    setLocationError("");
    setLoading(true);

    const isPin = /^\d{6}$/.test(manualQuery.trim());

    try {
      const res = await nearbyCareService.geocodeLocation(manualQuery.trim());
      if (res && res.data) {
        const origin = {
          type: isPin ? "pincode" : "manual",
          lat: res.data.latitude,
          lng: res.data.longitude,
          label: isPin
            ? `Postal Code ${manualQuery.trim()} (${res.data.city || res.data.display_name.split(",")[0]})`
            : res.data.display_name,
          query: manualQuery.trim(),
        };
        setActiveOrigin(origin);
        setLocationStatus("success");
        setLocationError("");
        toast.success(`📍 Found location: ${origin.label}`);
        fetchFacilities(origin.lat, origin.lng, activeTab, radius, origin);
      }
    } catch (err) {
      setLocationStatus("error");
      const msg = err.message || `Unable to locate "${manualQuery}". Please try another city or PIN code.`;
      setLocationError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  // Fetch facilities from backend with strict radius filtering and zero-staleness guards
  const fetchFacilities = async (lat, lng, type, rad, originObj) => {
    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    currentRequestIdRef.current = reqId;

    setLoading(true);
    setSearchedOnce(true);

    try {
      const params = {
        latitude: lat,
        longitude: lng,
        type: type,
        radius: rad,
      };
      if (originObj?.query) {
        params.query = originObj.query;
      }

      const response = await nearbyCareService.getNearbyCare(params, { signal: controller.signal });

      // Zero-staleness guard: only process if this matches the current active request
      if (currentRequestIdRef.current !== reqId) {
        return;
      }

      if (response && response.data && response.data.facilities) {
        // Enforce strict client-side radius invariant check (distance <= radius_km + 0.05 tolerance)
        const maxAllowedKm = (rad / 1000.0) + 0.05;
        const validFacilities = response.data.facilities.filter(
          (fac) => fac.distance <= maxAllowedKm && fac.category === type
        );
        validFacilities.sort((a, b) => a.distance - b.distance);

        setFacilities(validFacilities);
        setSelectedFacility(validFacilities.length > 0 ? validFacilities[0] : null);
      } else {
        setFacilities([]);
        setSelectedFacility(null);
      }
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED" || err.message === "canceled") {
        return; // Silently ignore cleanly cancelled requests
      }
      if (currentRequestIdRef.current === reqId) {
        toast.error(err.message || "Unable to find nearby healthcare facilities right now. Please try again.");
        setFacilities([]);
        setSelectedFacility(null);
      }
    } finally {
      if (currentRequestIdRef.current === reqId) {
        setLoading(false);
      }
    }
  };

  // Handle Tab Switch
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (activeOrigin) {
      fetchFacilities(activeOrigin.lat, activeOrigin.lng, newTab, radius, activeOrigin);
    }
  };

  // Handle Radius Change
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (activeOrigin) {
      fetchFacilities(activeOrigin.lat, activeOrigin.lng, activeTab, newRadius, activeOrigin);
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
    if (activeOrigin) {
      fetchFacilities(activeOrigin.lat, activeOrigin.lng, activeTab, nextRadius, activeOrigin);
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
              <FaMapMarkerAlt /> {t("findCare.headerBadge")}
            </span>
            <h1>{t("findCare.headerTitle")}</h1>
            <p>{t("findCare.headerDesc")}</p>
          </div>

          {/* Location Action Card */}
          <div className="location-card">
            <div className="location-card-header">
              <div className="location-icon-title">
                <div className="loc-pin-icon">
                  <FaCompass />
                </div>
                <div>
                  <h2>{t("findCare.yourLocation")}</h2>
                  <p className="card-subtext">{t("findCare.locationSubtext")}</p>
                </div>
              </div>

              {locationStatus === "success" && activeOrigin && (
                <div className="location-status-badge success">
                  <FaCheckCircle /> {t("findCare.locationDetected")}:{" "}
                  <strong>
                    {activeOrigin.label.length > 45
                      ? activeOrigin.label.slice(0, 45) + "..."
                      : activeOrigin.label}
                  </strong>
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
                    <FaSpinner className="spin-icon" /> {t("findCare.obtainingGps")}
                  </>
                ) : (
                  <>
                    <FaLocationArrow /> {t("findCare.useGpsBtn")}
                  </>
                )}
              </button>

              <div className="divider-text">{t("findCare.or")}</div>

              {/* Manual Form */}
              <form onSubmit={handleManualSearch} className="manual-location-form">
                <div className="input-with-button">
                  <input
                    type="text"
                    placeholder={t("findCare.searchPlaceholder")}
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                  />
                  <button type="submit" className="btn-search-manual" disabled={loading}>
                    {loading && locationStatus === "locating" ? (
                      <FaSpinner className="spin-icon" />
                    ) : (
                      <>
                        <FaSearch /> {t("findCare.searchBtn")}
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
                  <strong>{t("findCare.locationNotice")}: </strong>
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
                <FaHospital /> 🏥 {t("findCare.hospitalsTab")}
              </button>
              <button
                className={`tab-item ${activeTab === "laboratory" ? "active" : ""}`}
                onClick={() => handleTabChange("laboratory")}
              >
                <FaVial /> 🧪 {t("findCare.labsTab")}
              </button>
            </div>

            {/* Radius & View Selector */}
            <div className="controls-right">
              <div className="radius-selector">
                <span className="ctrl-label">{t("findCare.radiusLabel")}</span>
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
                  <FaList /> {t("findCare.listView")}
                </button>
                <button
                  className={`view-btn ${viewMode === "map" ? "active" : ""}`}
                  onClick={() => setViewMode("map")}
                  title="Map View"
                >
                  <FaMapMarkedAlt /> {t("findCare.mapView")}
                </button>
              </div>
            </div>
          </div>

          {/* Diagnostic Labs Informational Note */}
          {activeTab === "laboratory" && (
            <div className="lab-info-banner">
              <FaInfoCircle className="info-icon" />
              <div>
                <strong>{t("findCare.labNoteTitle")}</strong> {t("findCare.labNoteDesc")}
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className="results-container">
            {/* Loading State */}
            {loading && (
              <div className="loading-state-card">
                <FaSpinner className="spin-icon-large" />
                <h3>{t("findCare.findingCare")}</h3>
                <p>Querying real medical facilities within {radius / 1000} km radius.</p>
              </div>
            )}

            {/* Prompt to set location */}
            {!loading && !activeOrigin && !searchedOnce && (
              <div className="initial-prompt-card">
                <div className="prompt-icon">
                  <FaCompass />
                </div>
                <h3>{t("findCare.readyPrompt")}</h3>
                <p>{t("findCare.readyDesc")}</p>
              </div>
            )}

            {/* Active Search Origin Banner */}
            {!loading && activeOrigin && (
              <div className="active-origin-banner">
                <FaCompass className="origin-icon" />
                <div className="origin-text-group">
                  <span className="origin-title">Active Search Origin:</span>
                  <span className="origin-desc">
                    {activeOrigin.type === "gps"
                      ? `Searching around your current device location (${activeOrigin.lat.toFixed(4)}°N, ${activeOrigin.lng.toFixed(4)}°E)`
                      : activeOrigin.type === "pincode"
                      ? `Searching around Postal Code ${activeOrigin.query} (${activeOrigin.label})`
                      : `Searching around ${activeOrigin.label}`}
                  </span>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && activeOrigin && facilities.length === 0 && (
              <div className="empty-state-card">
                <div className="empty-icon">
                  <FaExclamationTriangle />
                </div>
                <h3>{t("findCare.noResults")} {radius / 1000} km</h3>
                <p>
                  No {activeTab === "hospital" ? "hospitals or medical clinics" : "diagnostic laboratories"} found within {radius / 1000} km of your active location. Try expanding the search radius.
                </p>
                <button className="btn-increase-radius" onClick={handleIncreaseRadius}>
                  <FaSearch /> {t("findCare.expandRadius")} to {radius < 10000 ? "10 km" : "20 km"}
                </button>
              </div>
            )}

            {/* Results Header */}
            {!loading && facilities.length > 0 && (
              <div className="results-summary-bar">
                <span className="count-badge">
                  Found <strong>{facilities.length}</strong> {activeTab === "hospital" ? t("findCare.hospitalsTab") : t("findCare.labsTab")}
                </span>
                <span className="radius-indicator">
                  Strictly filtered and sorted nearest to farthest within {radius / 1000} km
                </span>
              </div>
            )}

            {/* View Mode 1: List View */}
            {!loading && facilities.length > 0 && viewMode === "list" && (
              <div className="facilities-grid">
                {facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className={`facility-card ${selectedFacility?.id === fac.id ? "selected-highlight" : ""}`}
                    onClick={() => setSelectedFacility(fac)}
                  >
                    <div className="card-top-row">
                      <div className="fac-icon-wrapper">
                        {fac.category === "laboratory" ? <FaVial /> : <FaHospital />}
                      </div>
                      <div className="fac-title-area">
                        <span className="fac-type-pill">{fac.type}</span>
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
                          <strong>{fac.distance} km</strong> {t("findCare.distanceAway")}
                        </div>

                        {fac.open_now !== null && fac.open_now !== undefined && (
                          <div className={`meta-item status ${fac.open_now ? "open" : "closed"}`}>
                            <FaClock />
                            <span>{fac.open_now ? t("findCare.openNow") : t("findCare.closed")}</span>
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
                        href={fac.mapsUrl || fac.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-directions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FaDirections /> {t("common.getDirections")}
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
                  <h3>{t("findCare.facilitiesList")} ({facilities.length})</h3>
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
                          href={fac.maps_url || fac.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sidebar-dir-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FaDirections /> {t("common.getDirections")}
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
                          href={selectedFacility.maps_url || selectedFacility.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${selectedFacility.latitude},${selectedFacility.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-directions-sm"
                        >
                          <FaDirections /> {t("common.openGoogleMaps")}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* OpenStreetMap Interactive Embed */}
                  <div className="map-iframe-wrapper">
                    {activeOrigin && (
                      <iframe
                        title="Healthcare Facilities Map"
                        width="100%"
                        height="480"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight="0"
                        marginWidth="0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${(selectedFacility?.longitude || activeOrigin.lng) - 0.03}%2C${(selectedFacility?.latitude || activeOrigin.lat) - 0.02}%2C${(selectedFacility?.longitude || activeOrigin.lng) + 0.03}%2C${(selectedFacility?.latitude || activeOrigin.lat) + 0.02}&layer=mapnik&marker=${selectedFacility?.latitude || activeOrigin.lat}%2C${selectedFacility?.longitude || activeOrigin.lng}`}
                      ></iframe>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Medical Legal Disclaimer */}
          <div className="find-care-disclaimer">
            <h4>
              <FaInfoCircle /> {t("common.disclaimerTitle")}
            </h4>
            <p>{t("common.disclaimerText")}</p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default FindCare;
