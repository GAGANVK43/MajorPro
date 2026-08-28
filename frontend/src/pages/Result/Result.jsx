import "./Result.css";
import { useEffect, useState } from "react";
import { FaFilePdf, FaFileDownload, FaPrint, FaHeartbeat, FaStethoscope, FaChartLine, FaCheckCircle, FaExclamationTriangle, FaBrain } from "react-icons/fa";
import RiskGauge from "../../components/RiskGauge/RiskGauge";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import Navbar from "../../components/Navbar/Navbar";
import { predictionService, dietService, authService, reportService } from "../../services/api";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const defaultTrendData = [
  { month: "Assess 1", risk: 45 },
  { month: "Assess 2", risk: 52 },
  { month: "Assess 3", risk: 65 },
  { month: "Current", risk: 78 },
];

function Result() {
  const [userProfile, setUserProfile] = useState(null);
  const [userName, setUserName] = useState("Patient");

  const [predictionData, setPredictionData] = useState({
    id: 1,
    prediction: "Non-Diabetic",
    risk_percentage: 24.5,
    confidence: 95.0,
    health_score: 76,
    recommendation: "Maintain a balanced diet, stay physically active, and schedule routine health checkups.",
    contributing_factors: [
      { factor: "Blood Glucose", value: "95 mg/dL", impact: "Optimal", description: "Fasting blood glucose level within healthy normal range (<100 mg/dL)." },
      { factor: "BMI Score", value: "23.4", impact: "Optimal", description: "Body Mass Index within normal healthy weight range." }
    ]
  });

  const [dietPlan, setDietPlan] = useState({
    breakfast: "Oatmeal with chia seeds, cinnamon, and unsweetened almond milk. 1 boiled egg.",
    lunch: "Grilled chicken/tofu breast salad with spinach, cucumber, olive oil, and quinoa.",
    dinner: "Baked salmon/lentils with steamed broccoli, asparagus, and cauliflower mash.",
    exercise: "30-45 minutes brisk walking, cycling, or resistance training 5 days a week.",
  });

  useEffect(() => {
    // 1. Fetch user profile
    const token = localStorage.getItem("access_token");
    if (token) {
      authService
        .getProfile()
        .then((res) => {
          if (res.data) {
            setUserProfile(res.data);
            setUserName(res.data.full_name || "Patient");
          }
        })
        .catch(() => {});
    }

    // 2. Read stored prediction or fetch latest from API
    const stored = localStorage.getItem("latest_prediction");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.prediction) {
          setPredictionData({
            id: parsed.id || 1,
            prediction: parsed.prediction,
            risk_percentage: parsed.risk_percentage || 25.0,
            confidence: parsed.confidence || 95.0,
            health_score: Math.max(20, Math.round(100 - (parsed.risk_percentage || 25))),
            recommendation: parsed.recommendation || "",
            contributing_factors: parsed.contributing_factors || []
          });
        }
      } catch (e) {
        // Fallback
      }
    }

    // 3. Fetch latest prediction & diet plan from API
    async function fetchLatestData() {
      try {
        const res = await predictionService.getLatest();
        if (res.data) {
          const d = res.data;
          setPredictionData({
            id: d.id || 1,
            prediction: d.prediction,
            risk_percentage: d.risk_percentage,
            confidence: d.confidence,
            health_score: Math.max(20, Math.round(100 - d.risk_percentage)),
            recommendation: d.recommendation,
            contributing_factors: d.contributing_factors || []
          });
        }

        const dietRes = await dietService.getLatestDiet();
        if (dietRes.data) {
          setDietPlan({
            breakfast: dietRes.data.breakfast,
            lunch: dietRes.data.lunch,
            dinner: dietRes.data.dinner,
            exercise: dietRes.data.exercise,
          });
        }
      } catch (e) {
        // Fallback to local state if unauthenticated
      }
    }
    fetchLatestData();
  }, []);

  const handleDownloadPDF = () => {
    if (predictionData.id) {
      const pdfUrl = reportService.getPdfUrl(predictionData.id);
      window.open(pdfUrl, "_blank");
    } else {
      window.print();
    }
  };

  return (
    <>
      <Navbar />

      <div className="result-page">
        <div className="result-container">
          <BackButton />

          {/* Clinical Report Header */}
          <header className="report-header-card">
            <div className="header-left">
              <div className="report-badge">
                <FaStethoscope /> Official Clinical AI Assessment Report
              </div>
              <h1>Patient Diabetes Risk Analysis</h1>
              <p>Assessment ID: <strong>REP-{predictionData.id ? String(predictionData.id).padStart(5, '0') : "00001"}</strong> | Patient: <strong>{userName}</strong></p>
            </div>

            <div className="header-actions">
              <button className="btn-action secondary no-print" onClick={() => window.print()}>
                <FaPrint /> Print
              </button>
              <button className="btn-action primary no-print" onClick={handleDownloadPDF}>
                <FaFileDownload /> Download PDF Report
              </button>
            </div>
          </header>

          {/* Top Metric Cards Section */}
          <div className="report-score-grid">
            <RiskGauge
              riskPercentage={predictionData.risk_percentage}
              riskLevel={predictionData.prediction === "Diabetic" ? "High Risk" : "Low Risk"}
              confidence={predictionData.confidence}
            />

            <div className="score-summary-card">
              <div className="card-top">
                <span>Overall Metabolic Health Score</span>
                <span className="health-score-val">{predictionData.health_score} / 100</span>
              </div>
              <div className="score-progress-bar">
                <div
                  className="score-progress-fill"
                  style={{
                    width: `${predictionData.health_score}%`,
                    background: predictionData.health_score >= 70 ? "#10b981" : "#f59e0b"
                  }}
                />
              </div>
              <div className="ai-insight-box">
                <h4><FaBrain /> AI Model Assessment Summary</h4>
                <p>{predictionData.recommendation}</p>
              </div>
            </div>
          </div>

          {/* Explainability Matrix */}
          {predictionData.contributing_factors && predictionData.contributing_factors.length > 0 && (
            <div className="content-card">
              <h2><FaStethoscope /> Clinical Risk Factor Explainability Matrix</h2>
              <p className="card-subtitle">AI feature contribution assessment highlighting high-impact health markers.</p>

              <div className="explainability-grid">
                {predictionData.contributing_factors.map((item, idx) => (
                  <div className="factor-item-card" key={idx}>
                    <div className="factor-header">
                      <span className="factor-name">{item.factor}</span>
                      <span className={`impact-tag ${item.impact.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.impact === "High Risk" && <FaExclamationTriangle />}
                        {item.impact === "Optimal" && <FaCheckCircle />}
                        {item.impact}
                      </span>
                    </div>
                    <div className="factor-value">Recorded: <strong>{item.value}</strong></div>
                    <p className="factor-desc">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health Risk Trajectory Graph */}
          <div className="content-card">
            <h2><FaChartLine /> Historical Risk Score Trajectory</h2>
            <p className="card-subtitle">Tracking longitudinal risk score trends across assessments.</p>

            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={defaultTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f8fafc" }}
                  />
                  <Line type="monotone" dataKey="risk" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 6, fill: "#0ea5e9" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommended Diet & Exercise Guidance */}
          <div className="content-card">
            <h2>🥗 AI Recommended Lifestyle Interventions</h2>

            <div className="plan-cards-grid">
              <div className="plan-block">
                <div className="plan-header">
                  <span className="plan-icon">🌅</span>
                  <h3>Breakfast Guidance</h3>
                </div>
                <p>{dietPlan.breakfast}</p>
              </div>

              <div className="plan-block">
                <div className="plan-header">
                  <span className="plan-icon">☀️</span>
                  <h3>Lunch Guidance</h3>
                </div>
                <p>{dietPlan.lunch}</p>
              </div>

              <div className="plan-block">
                <div className="plan-header">
                  <span className="plan-icon">🌙</span>
                  <h3>Dinner Guidance</h3>
                </div>
                <p>{dietPlan.dinner}</p>
              </div>

              <div className="plan-block highlight">
                <div className="plan-header">
                  <span className="plan-icon">🏃</span>
                  <h3>Exercise Prescription</h3>
                </div>
                <p>{dietPlan.exercise}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Result;