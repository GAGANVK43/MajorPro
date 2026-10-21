import React, { useState } from "react";
import "./FacilityMap.css";
import {
  FaHospital,
  FaVial,
  FaLocationArrow,
  FaCrosshairs,
  FaMapMarkedAlt,
  FaLayerGroup,
  FaDirections,
  FaExternalLinkAlt,
  FaCheckCircle,
} from "react-icons/fa";

/**
 * FacilityMap
 * 
 * Interactive Multi-Facility Map & Spatial Radar:
 * - Plots the active user origin coordinate with GPS accuracy radius
 * - Draws the strict search radius boundary (2km, 5km, 10km, 20km)
 * - Renders interactive marker pins for EVERY discovered facility
 * - Synchronizes selection between map and list
 * - Toggleable between Interactive Vector Plot and OpenStreetMap Street View
 */
export default function FacilityMap({
  facilities = [],
  location,
  radius = 5000,
  selectedFacility,
  onSelectFacility,
  activeTab = "hospital",
}) {
  const [mapType, setMapType] = useState("interactive"); // 'interactive' | 'osm'

  if (!location) {
    return (
      <div className="facility-map-empty">
        <p>Set a location to view nearby facilities on the map.</p>
      </div>
    );
  }

  const originLat = location.lat;
  const originLng = location.lng;

  // Viewport projection: Center = (250, 250) on 500x500 SVG
  const SVG_SIZE = 500;
  const CENTER = SVG_SIZE / 2;
  const MAX_PLOT_RADIUS = 210; // Pixels corresponding to radius meters

  // Convert (lat, lng) to (x, y) relative to origin using equirectangular projection
  // Delta meters: dy = dLat * 111,195 m; dx = dLng * 111,195 * cos(lat) m
  const latFactor = 111195.0;
  const lngFactor = 111195.0 * Math.cos((originLat * Math.PI) / 180.0);

  const projectToSvg = (lat, lng) => {
    const dLatMeters = (lat - originLat) * latFactor;
    const dLngMeters = (lng - originLng) * lngFactor;

    // SVG coordinates: +x is East, +y is South (so North is -dy)
    const scale = MAX_PLOT_RADIUS / radius;
    const x = CENTER + dLngMeters * scale;
    const y = CENTER - dLatMeters * scale;

    return { x, y, dLngMeters, dLatMeters };
  };

  const radiusKm = radius / 1000;

  return (
    <div className="facility-map-container">
      {/* Map Control Bar */}
      <div className="facility-map-controls">
        <div className="map-type-toggles">
          <button
            type="button"
            className={`map-toggle-btn ${mapType === "interactive" ? "active" : ""}`}
            onClick={() => setMapType("interactive")}
            title="Interactive Multi-Marker Radar View"
          >
            <FaLayerGroup /> Interactive Radar Map ({facilities.length} Pins)
          </button>
          <button
            type="button"
            className={`map-toggle-btn ${mapType === "osm" ? "active" : ""}`}
            onClick={() => setMapType("osm")}
            title="OpenStreetMap Street View"
          >
            <FaMapMarkedAlt /> OpenStreetMap View
          </button>
        </div>

        <div className="map-legend">
          <span className="legend-item origin">
            <span className="legend-dot origin-dot" /> Search Origin
          </span>
          <span className="legend-item hospital">
            <span className="legend-dot hospital-dot" /> Hospital
          </span>
          <span className="legend-item lab">
            <span className="legend-dot lab-dot" /> Diagnostic Lab
          </span>
        </div>
      </div>

      {mapType === "interactive" ? (
        <div className="interactive-svg-wrapper">
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="facility-svg-canvas"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Radial gradient for origin radar pulse */}
              <radialGradient id="radarPulseGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
              </radialGradient>

              {/* Boundary ring gradient */}
              <linearGradient id="boundaryRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
              </linearGradient>

              {/* Filter glow for active selection */}
              <filter id="markerActiveGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Radar Background & Grid Circles */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={MAX_PLOT_RADIUS}
              className="map-boundary-circle"
              fill="url(#radarPulseGrad)"
            />

            {/* Concentric Distance Rings: 25%, 50%, 75%, 100% */}
            {[0.25, 0.5, 0.75, 1.0].map((frac) => {
              const r = MAX_PLOT_RADIUS * frac;
              const distLabel = `${(radiusKm * frac).toFixed(frac === 1 ? 0 : 1)} km`;
              return (
                <g key={frac} className="distance-ring-group">
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={r}
                    className={`distance-ring ${frac === 1.0 ? "boundary-edge" : ""}`}
                  />
                  <text
                    x={CENTER + 6}
                    y={CENTER - r + 13}
                    className="distance-ring-label"
                  >
                    {distLabel}
                  </text>
                </g>
              );
            })}

            {/* Crosshair Cardinal Axes (N-S, E-W) */}
            <line
              x1={CENTER}
              y1={CENTER - MAX_PLOT_RADIUS - 10}
              x2={CENTER}
              y2={CENTER + MAX_PLOT_RADIUS + 10}
              className="crosshair-axis"
            />
            <line
              x1={CENTER - MAX_PLOT_RADIUS - 10}
              y1={CENTER}
              x2={CENTER + MAX_PLOT_RADIUS + 10}
              y2={CENTER}
              className="crosshair-axis"
            />

            {/* Cardinal Direction Indicators */}
            <text x={CENTER} y={CENTER - MAX_PLOT_RADIUS - 16} className="cardinal-label">N</text>
            <text x={CENTER + MAX_PLOT_RADIUS + 16} y={CENTER + 4} className="cardinal-label">E</text>
            <text x={CENTER} y={CENTER + MAX_PLOT_RADIUS + 22} className="cardinal-label">S</text>
            <text x={CENTER - MAX_PLOT_RADIUS - 20} y={CENTER + 4} className="cardinal-label">W</text>

            {/* Center Origin: User Location */}
            <g className="origin-marker-group">
              <circle cx={CENTER} cy={CENTER} r="18" className="origin-radar-ping" />
              <circle cx={CENTER} cy={CENTER} r="7" className="origin-center-dot" />
              <circle cx={CENTER} cy={CENTER} r="3" fill="#ffffff" />
            </g>

            {/* Facility Marker Pins */}
            {facilities.map((fac, idx) => {
              const { x, y } = projectToSvg(fac.latitude, fac.longitude);
              const isSelected = selectedFacility?.id === fac.id;
              const isLab = fac.category === "laboratory";

              return (
                <g
                  key={fac.id || idx}
                  className={`map-facility-pin ${isSelected ? "selected" : ""} ${isLab ? "lab-pin" : "hospital-pin"}`}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => onSelectFacility && onSelectFacility(fac)}
                  cursor="pointer"
                >
                  {/* Highlight ring if selected */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r="16"
                      className="selected-highlight-ring"
                      filter="url(#markerActiveGlow)"
                    />
                  )}

                  {/* Marker Pin Base */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? "9" : "7.5"}
                    className="pin-circle"
                  />

                  {/* Center Dot */}
                  <circle cx="0" cy="0" r="3" fill="#ffffff" />

                  {/* Micro Distance Badge */}
                  <text
                    x="0"
                    y={isSelected ? "-14" : "-11"}
                    className="pin-dist-text"
                  >
                    {fac.distance}km
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Map Overlay Badge */}
          <div className="map-overlay-info">
            <span className="origin-badge">
              <FaLocationArrow /> Origin: <strong>{location.name || "GPS"}</strong>
            </span>
            <span className="radius-badge">
              <FaCrosshairs /> Boundary: <strong>{radiusKm} km Strict</strong>
            </span>
            <span className="count-badge">
              <FaCheckCircle /> <strong>{facilities.length}</strong> facilities plotted
            </span>
          </div>
        </div>
      ) : (
        /* OpenStreetMap Embed View */
        <div className="osm-embed-wrapper">
          <iframe
            title="OpenStreetMap Street View"
            width="100%"
            height="500"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${(selectedFacility?.longitude || originLng) - 0.035}%2C${(selectedFacility?.latitude || originLat) - 0.025}%2C${(selectedFacility?.longitude || originLng) + 0.035}%2C${(selectedFacility?.latitude || originLat) + 0.025}&layer=mapnik&marker=${selectedFacility?.latitude || originLat}%2C${selectedFacility?.longitude || originLng}`}
          />
        </div>
      )}
    </div>
  );
}
