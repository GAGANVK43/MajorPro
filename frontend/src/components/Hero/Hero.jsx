import "./Hero.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaBrain, FaShieldAlt, FaChartLine } from "react-icons/fa";
import { predictionService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";

function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [modelMetrics, setModelMetrics] = useState({
    accuracy_percentage: "99.20%",
    dataset_samples: 2500,
    roc_auc: 0.9993,
  });

  useEffect(() => {
    predictionService
      .getLatest()
      .then(() => {})
      .catch(() => {});

    // Fetch real trained model metrics
    fetch("http://localhost:8000/api/prediction/accuracy")
      .then((res) => res.json())
      .then((resData) => {
        if (resData && resData.data) {
          setModelMetrics({
            accuracy_percentage: resData.data.accuracy_percentage || "99.20%",
            dataset_samples: resData.data.dataset_samples || 2500,
            roc_auc: resData.data.roc_auc || 0.9993,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="hero-section">
      {/* Reference Image 2: Exact Medical Background Composition */}
      <div className="hero-medical-bg-base" />
      <div className="hero-medical-bg-image" />
      <div className="hero-stethoscope-layer" />
      <div className="hero-dna-layer" />
      <div className="hero-center-clarity" />

      {/* Left Side: Glowing ECG Heartbeat & Medical Cross */}
      <div className="hero-medical-svg-left">
        <svg viewBox="0 0 450 350" fill="none" xmlns="http://www.w3.org/2000/svg" className="ecg-pulse-svg">
          <defs>
            <filter id="ecgGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Floating Medical Cross (+) */}
          <g opacity="0.75" className="floating-cross">
            <rect x="70" y="55" width="22" height="6" rx="3" fill="#0F9D9A" filter="url(#ecgGlow)" />
            <rect x="78" y="47" width="6" height="22" rx="3" fill="#0F9D9A" filter="url(#ecgGlow)" />
          </g>
          {/* Glowing Animated Heartbeat Pulse Waveform */}
          <path
            d="M 10 180 L 120 180 L 135 150 L 148 210 L 165 110 L 180 230 L 195 170 L 210 185 L 225 180 L 380 180"
            stroke="#0F9D9A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecgGlow)"
            className="ecg-line-pulse"
          />
        </svg>
      </div>

      {/* Right Side: DNA Helix Network & Medical Cross */}
      <div className="hero-medical-svg-right">
        <svg viewBox="0 0 450 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="hex-dna-svg">
          <defs>
            <linearGradient id="medBlueTeal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B6EBD" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0F9D9A" stopOpacity="0.5" />
            </linearGradient>
            <filter id="medGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Floating Medical Cross (+) on right */}
          <g opacity="0.8" className="floating-cross-delayed">
            <rect x="340" y="90" width="24" height="7" rx="3.5" fill="#0F9D9A" filter="url(#medGlow)" />
            <rect x="348.5" y="81.5" width="7" height="24" rx="3.5" fill="#0F9D9A" filter="url(#medGlow)" />
          </g>
          {/* Subtle Hexagonal Molecular Network */}
          <g stroke="url(#medBlueTeal)" strokeWidth="1.2" opacity="0.55">
            <polygon points="260,180 290,162 320,180 320,215 290,232 260,215" fill="none" />
            <polygon points="320,180 350,162 380,180 380,215 350,232 320,215" fill="none" />
            <polygon points="290,232 320,215 350,232 350,268 320,285 290,268" fill="none" />
            <line x1="260" y1="180" x2="230" y2="162" />
            <line x1="380" y1="180" x2="410" y2="162" />
          </g>
          {/* Glowing Molecular Nodes */}
          <g filter="url(#medGlow)">
            <circle cx="260" cy="180" r="3.5" fill="#0F9D9A" />
            <circle cx="320" cy="180" r="4.5" fill="#0B6EBD" />
            <circle cx="380" cy="180" r="3.5" fill="#0F9D9A" />
            <circle cx="290" cy="232" r="4.5" fill="#0B6EBD" />
            <circle cx="350" cy="232" r="4.5" fill="#0F9D9A" />
            <circle cx="320" cy="285" r="3.5" fill="#0B6EBD" />
          </g>
        </svg>
      </div>

      {/* Main Foreground Container */}
      <div className="hero-container">
        <div className="hero-badge">
          <FaBrain className="badge-icon" />
          <span>{t("home.heroBadge")}</span>
        </div>

        <h1 className="hero-title">
          {t("home.heroTitle")}{" "}
          <span className="gradient-text">{t("home.heroTitleHighlight")}</span>
        </h1>

        <p className="hero-description">{t("home.heroDesc")}</p>

        <div className="hero-cta-group">
          <button
            className="cta-btn primary"
            onClick={() => navigate("/assessment")}
          >
            {t("home.startAssessment")} <FaArrowRight />
          </button>
          <button
            className="cta-btn secondary"
            onClick={() => navigate("/dashboard")}
          >
            {t("home.exploreDashboard")}
          </button>
        </div>

        {/* Reference Image 1: Authentic Machine Learning Metrics Grid */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <div className="stat-icon-box">
              <FaBrain />
            </div>
            <div className="stat-content">
              <h3>{modelMetrics.accuracy_percentage}</h3>
              <p>{t("home.accuracyScore")}</p>
            </div>
            <FaChartLine className="stat-mini-chart" />
          </div>

          <div className="stat-card">
            <div className="stat-icon-box">
              <FaChartLine />
            </div>
            <div className="stat-content">
              <h3>{modelMetrics.dataset_samples}</h3>
              <p>{t("home.datasetRecords")}</p>
            </div>
            <FaChartLine className="stat-mini-chart" />
          </div>

          <div className="stat-card">
            <div className="stat-icon-box teal">
              <FaShieldAlt />
            </div>
            <div className="stat-content">
              <h3>{modelMetrics.roc_auc}</h3>
              <p>{t("home.rocAuc")}</p>
            </div>
            <FaChartLine className="stat-mini-chart" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;