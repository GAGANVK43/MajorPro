import React from "react";
import "./AuthShowcase.css";
import { 
  FaHeartbeat, 
  FaBrain, 
  FaChartLine, 
  FaShieldAlt, 
  FaUsers, 
  FaTint, 
  FaCheckCircle,
  FaStethoscope,
  FaDna
} from "react-icons/fa";

function AuthShowcase() {
  return (
    <div className="auth-showcase-panel">
      {/* Dynamic Background Mesh Gradients */}
      <div className="showcase-mesh-glow-1" />
      <div className="showcase-mesh-glow-2" />
      <div className="showcase-mesh-glow-3" />

      {/* Top Header Branding */}
      <div className="showcase-top-brand">
        <div className="brand-icon-capsule">
          <FaHeartbeat className="brand-pulse-icon" />
        </div>
        <div className="brand-text-block">
          <h3>DiaSense AI</h3>
          <span>Diabetes Prediction</span>
        </div>
      </div>

      {/* Hero Headings */}
      <div className="showcase-hero-heading">
        <h2>
          AI-Powered <span className="text-gradient-cyan">Diabetes Prediction</span> for a Healthier Tomorrow
        </h2>
        <p>
          Predict risk, take control, and live a healthier life with the power of Machine Learning.
        </p>
      </div>

      {/* Main Interactive Visual Centerpiece */}
      <div className="showcase-visual-container">
        {/* Left Side: 3 Feature Capsules */}
        <div className="showcase-feature-list">
          <div className="feature-pill-card">
            <div className="pill-icon-circle cyan">
              <FaBrain />
            </div>
            <div className="pill-text">
              <h4>ML Based Prediction</h4>
              <p>Advanced machine learning models for accurate results.</p>
            </div>
          </div>

          <div className="feature-pill-card">
            <div className="pill-icon-circle blue">
              <FaChartLine />
            </div>
            <div className="pill-text">
              <h4>Health Insights</h4>
              <p>Get personalized insights and tips.</p>
            </div>
          </div>

          <div className="feature-pill-card">
            <div className="pill-icon-circle indigo">
              <FaShieldAlt />
            </div>
            <div className="pill-text">
              <h4>Secure & Private</h4>
              <p>Your data is safe with us and never shared.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Designed Medical Device & Telemetry Visual */}
        <div className="medical-visual-display">
          {/* Radar Target Circles */}
          <div className="radar-circle radar-outer" />
          <div className="radar-circle radar-middle" />
          <div className="radar-circle radar-inner" />

          {/* Glowing Pancreas & Organ Cell Hologram */}
          <div className="pancreas-hologram-card">
            <div className="hologram-bubble">
              <FaDna className="organ-holo-icon" />
              <span className="organ-tag">Beta Cells • Active</span>
            </div>
            <div className="hologram-glow-orbit" />
          </div>

          {/* Designed Glucometer Device */}
          <div className="glucometer-device-mockup">
            <div className="glucometer-case">
              <div className="glucometer-screen">
                <div className="screen-header">
                  <span className="blood-icon"><FaTint /></span>
                  <span className="screen-tag">GLUCOSE</span>
                </div>
                <div className="screen-reading">
                  <span className="reading-value">105</span>
                  <span className="reading-unit">mg/dL</span>
                </div>
                <div className="screen-status-bar">
                  <span className="status-dot green" />
                  <span className="status-label">Optimal Fasting</span>
                </div>
              </div>

              {/* Device Buttons */}
              <div className="device-controls">
                <button type="button" className="dev-btn btn-up" tabIndex={-1}>▲</button>
                <button type="button" className="dev-btn btn-down" tabIndex={-1}>▼</button>
              </div>

              {/* Test Strip */}
              <div className="device-test-strip">
                <div className="strip-sensor-pad" />
              </div>
            </div>
          </div>

          {/* Real-Time Live ECG Pulse Wave SVG */}
          <div className="ecg-waveform-card">
            <svg className="ecg-svg" viewBox="0 0 200 45" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ecgGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(14, 165, 233, 0.2)" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <path
                d="M 0 25 L 30 25 L 35 22 L 40 25 L 55 25 L 60 10 L 65 38 L 70 5 L 75 28 L 80 25 L 110 25 L 115 12 L 120 35 L 125 7 L 130 25 L 160 25 L 165 20 L 170 25 L 200 25"
                fill="none"
                stroke="url(#ecgGlow)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="ecg-telemetry-badge">
              <span className="live-pulse-dot" /> 72 BPM • Normal Rhythm
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Social Proof Pill Card */}
      <div className="showcase-bottom-card">
        <div className="users-icon-circle">
          <FaUsers />
        </div>
        <span>Join thousands who are taking charge of their metabolic health.</span>
      </div>

      {/* Footer Copyright */}
      <div className="showcase-footer-note">
        © 2025 DiaSense AI. All rights reserved.
      </div>
    </div>
  );
}

export default AuthShowcase;
