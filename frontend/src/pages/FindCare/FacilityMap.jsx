import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./FacilityMap.css";
import {
  FaHospital,
  FaVial,
  FaMapMarkerAlt,
  FaDirections,
  FaCrosshairs,
  FaExternalLinkAlt,
  FaInfoCircle,
} from "react-icons/fa";

/**
 * FacilityMap Component
 *
 * Production-quality interactive geographic map powered by Leaflet & OpenStreetMap:
 * - Real geographic projection with drag, pan, zoom, and touch controls
 * - Search origin marker with pulsating GPS beacon
 * - Search radius boundary circle (2km, 5km, 10km, 20km)
 * - Custom pins for hospitals, clinics, and diagnostic laboratories with distance tags
 * - Synchronized marker popups with Google Maps navigation links
 * - Full list <-> map selection bidirectional synchronization
 */
export default function FacilityMap({
  facilities = [],
  location,
  radius = 5000,
  selectedFacility,
  onSelectFacility,
  activeTab = "hospital",
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerMapRef = useRef({});

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = location ? location.lat : 20.5937; // India centroid default
      const initialLng = location ? location.lng : 78.9629;
      const initialZoom = location ? 13 : 5;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Standard OSM Tile Layer with attribution
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | DiaSense AI',
        maxZoom: 19,
        minZoom: 3,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Invalidate size once DOM stabilizes
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        markerMapRef.current = {};
      }
    };
  }, []);

  // 2. Update Markers, Radius Circle, and View whenever location, facilities, or radius change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer || !location) return;

    // Invalidate map size in case container dimensions changed
    map.invalidateSize();

    // Clear previous markers & circles
    markersLayer.clearLayers();
    markerMapRef.current = {};

    const originLat = location.lat;
    const originLng = location.lng;

    // Draw strict Search Radius Circle Boundary
    const radiusCircle = L.circle([originLat, originLng], {
      radius: radius,
      color: "#38bdf8",
      fillColor: "#0284c7",
      fillOpacity: 0.08,
      weight: 2,
      dashArray: "6, 8",
    }).addTo(markersLayer);

    // Origin GPS Beacon Pin
    const originIcon = L.divIcon({
      className: "diasense-origin-marker",
      html: `
        <div class="origin-beacon-pin">
          <div class="beacon-wave"></div>
          <div class="beacon-dot">📍</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const originMarker = L.marker([originLat, originLng], {
      icon: originIcon,
      zIndexOffset: 1000,
    }).addTo(markersLayer);

    originMarker.bindPopup(`
      <div class="diasense-popup-content origin-popup">
        <h4>📍 Search Origin</h4>
        <p class="origin-name">${location.name || "Selected Location"}</p>
        <p class="origin-coords">${originLat.toFixed(4)}° N, ${originLng.toFixed(4)}° E</p>
        <div class="origin-radius-tag">Search Boundary: ${(radius / 1000).toFixed(0)} km</div>
      </div>
    `);

    // Plot Facility Markers
    facilities.forEach((fac) => {
      if (
        !Number.isFinite(fac.latitude) ||
        !Number.isFinite(fac.longitude)
      ) {
        return;
      }

      const isLab = fac.category === "laboratory";
      const isSelected = selectedFacility && selectedFacility.id === fac.id;
      const symbol = isLab ? "🧪" : "🏥";
      const pinClass = `diasense-fac-pin ${isLab ? "lab-pin" : "hospital-pin"} ${isSelected ? "selected" : ""}`;

      const facIcon = L.divIcon({
        className: "custom-leaflet-pin-wrapper",
        html: `
          <div class="${pinClass}">
            <span class="pin-icon">${symbol}</span>
            <span class="pin-tag">${fac.distance}km</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([fac.latitude, fac.longitude], {
        icon: facIcon,
        zIndexOffset: isSelected ? 800 : 200,
      }).addTo(markersLayer);

      markerMapRef.current[fac.id] = marker;

      // Popup card HTML
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${fac.latitude},${fac.longitude}`;
      const popupHtml = `
        <div class="diasense-popup-content">
          <div class="popup-type-bar">
            <span class="popup-badge ${isLab ? "lab-badge" : "hosp-badge"}">${fac.type || (isLab ? "Diagnostic Lab" : "Hospital")}</span>
            <span class="popup-dist">${fac.distance} km</span>
          </div>
          <h4 class="popup-title">${fac.name}</h4>
          <p class="popup-address">${fac.address || "Address available via Google Maps"}</p>
          <div class="popup-meta-row">
            ${fac.rating ? `<span class="popup-pill rating">★ ${fac.rating}</span>` : ""}
            ${fac.open_now === true ? `<span class="popup-pill open">Verified 24/7</span>` : ""}
            ${fac.phone ? `<span class="popup-pill phone">📞 ${fac.phone}</span>` : ""}
          </div>
          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="popup-nav-button">
            🧭 Navigate on Google Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 320,
        className: "diasense-leaflet-popup-card",
      });

      marker.on("click", () => {
        if (onSelectFacility) {
          onSelectFacility(fac);
        }
      });
    });

    // Auto-fit bounds so the origin circle & pins are nicely visible
    map.fitBounds(radiusCircle.getBounds(), {
      padding: [25, 25],
      maxZoom: 15,
      animate: true,
    });
  }, [location, facilities, radius]);

  // 3. Focus and open popup when selectedFacility changes from outside (e.g. list click)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedFacility) return;

    const marker = markerMapRef.current[selectedFacility.id];
    if (marker) {
      marker.openPopup();
      map.setView(
        [selectedFacility.latitude, selectedFacility.longitude],
        Math.max(map.getZoom(), 14),
        { animate: true }
      );
    }
  }, [selectedFacility]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (map && location) {
      map.setView([location.lat, location.lng], 13, { animate: true });
    }
  };

  if (!location) {
    return (
      <div className="facility-map-empty">
        <FaMapMarkerAlt className="empty-map-icon" />
        <p>Enter an Indian PIN code or use GPS to display nearby facilities on the map.</p>
      </div>
    );
  }

  return (
    <div className="facility-map-wrapper">
      {/* Map Header Toolbar */}
      <div className="map-toolbar">
        <div className="map-stats-pill">
          <span className="live-pulse" />
          <span>
            {facilities.length > 0
              ? `Found ${facilities.length} ${activeTab === "laboratory" ? "diagnostic labs" : "hospitals"} within ${(radius / 1000).toFixed(0)} km`
              : `No ${activeTab === "laboratory" ? "labs" : "hospitals"} within ${(radius / 1000).toFixed(0)} km`}
          </span>
        </div>

        <div className="map-toolbar-actions">
          <button
            type="button"
            className="recenter-btn"
            onClick={handleRecenter}
            title="Recenter Map to Search Origin"
          >
            <FaCrosshairs /> Recenter
          </button>
        </div>
      </div>

      {/* Leaflet Map DOM Container */}
      <div
        ref={mapContainerRef}
        id="leaflet-facility-map"
        className="leaflet-map-element"
      />

      {/* Map Legend */}
      <div className="map-footer-legend">
        <div className="legend-entry">
          <span className="legend-indicator origin-ind">📍</span>
          <span>Search Origin ({(radius / 1000).toFixed(0)} km radius)</span>
        </div>
        <div className="legend-entry">
          <span className="legend-indicator hosp-ind">🏥</span>
          <span>Hospital / Clinic</span>
        </div>
        <div className="legend-entry">
          <span className="legend-indicator lab-ind">🧪</span>
          <span>Diagnostic Laboratory</span>
        </div>
      </div>
    </div>
  );
}
