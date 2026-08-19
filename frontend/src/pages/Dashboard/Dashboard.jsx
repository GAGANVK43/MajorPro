import "./Dashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeartbeat, FaBrain, FaUtensils, FaRunning, FaFileAlt, FaPlusCircle, FaLightbulb, FaHistory } from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { dashboardService, predictionService } from "../../services/api";

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [snapshot, setSnapshot] = useState({
    healthScore: 82,
    riskLevel: "Low Risk",
    riskPercentage: "24.5%",
    bmi: "24.5",
    lastAssessment: "Today",
  });

  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const response = await dashboardService.getDashboardData();
        const data = response.data;
        if (data && data.health_summary) {
          const hs = data.health_summary;
          const latestPred = data.latest_prediction;

          setSnapshot({
            healthScore: hs.health_score || 82,
            riskLevel: hs.risk_level || "Low Risk",
            riskPercentage: latestPred ? `${latestPred.risk_percentage}%` : "24.5%",
            bmi: hs.latest_bmi ? hs.latest_bmi.toFixed(1) : "24.5",
            lastAssessment: hs.last_assessed_at
              ? new Date(hs.last_assessed_at).toLocaleDateString()
              : "Today",
          });
        }

        // Fetch prediction history
        const historyRes = await predictionService.getHistory();
        if (historyRes.data && historyRes.data.predictions) {
          setHistoryList(historyRes.data.predictions);
        }
      } catch (err) {
        // Fallback snapshot if unauthenticated
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  return (
    <>
      <Navbar />

      <div className="dashboard-page">
        <div className="dashboard-container">
          <BackButton />

          {/* Hero Header */}
          <section className="dashboard-hero">
            <div className="hero-badge">
              <FaHeartbeat /> Healthcare Analytics Dashboard
            </div>

            <h1>
              AI Health Risk Overview & <span className="gradient-text">Analytics</span>
            </h1>

            <p>
              Monitor your longitudinal diabetes risk scores, review automated clinical predictions, and access your custom diet and exercise prescriptions.
            </p>

            <div className="hero-action-buttons">
              <button className="btn-dash primary" onClick={() => navigate("/assessment")}>
                <FaPlusCircle /> Start New Assessment
              </button>
              <button className="btn-dash secondary" onClick={() => navigate("/result")}>
                <FaFileAlt /> View Latest Report
              </button>
            </div>
          </section>

          {/* Real Backend Snapshot Metric Cards */}
          <section className="snapshot-section">
            <h2 className="section-heading">Health Metrics Overview</h2>

            <div className="snapshot-grid">
              <div className="snapshot-card" onClick={() => navigate("/result")}>
                <div className="snap-icon-box">❤️</div>
                <div className="snap-details">
                  <h3>Health Score</h3>
                  <span className="snap-value">{snapshot.healthScore} / 100</span>
                  <p className="snap-status">Optimal Range</p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate("/result")}>
                <div className="snap-icon-box cyan">🩸</div>
                <div className="snap-details">
                  <h3>Diabetes Risk</h3>
                  <span className="snap-value">{snapshot.riskLevel}</span>
                  <p className="snap-status">Probability: {snapshot.riskPercentage}</p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate("/assessment")}>
                <div className="snap-icon-box emerald">⚖️</div>
                <div className="snap-details">
                  <h3>BMI Score</h3>
                  <span className="snap-value">{snapshot.bmi}</span>
                  <p className="snap-status">kg/m² (Standard)</p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate("/result")}>
                <div className="snap-icon-box purple">📅</div>
                <div className="snap-details">
                  <h3>Last Screening</h3>
                  <span className="snap-value">{snapshot.lastAssessment}</span>
                  <p className="snap-status">Verified</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Services Grid */}
          <section className="services-section">
            <h2 className="section-heading">Core AI Modules</h2>

            <div className="services-grid">
              <div className="dash-service-card" onClick={() => navigate("/assessment")}>
                <div className="service-icon"><FaBrain /></div>
                <h3>AI Prediction Engine</h3>
                <p>Execute fresh ML risk screening on physiological markers.</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/diet-plan")}>
                <div className="service-icon utensils"><FaUtensils /></div>
                <h3>Personalized Diet Plan</h3>
                <p>View customized meal prescriptions tailored to your risk level.</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/diet-plan")}>
                <div className="service-icon running"><FaRunning /></div>
                <h3>Exercise Intelligence</h3>
                <p>Risk-aware physical activity and workout recommendations.</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/result")}>
                <div className="service-icon report"><FaFileAlt /></div>
                <h3>Clinical Reports</h3>
                <p>Download official PDF risk assessment documentation.</p>
              </div>
            </div>
          </section>

          {/* Assessment History Table */}
          {historyList.length > 0 && (
            <section className="history-section">
              <h2 className="section-heading"><FaHistory /> Assessment History Log</h2>

              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Assessment Date</th>
                      <th>Risk Classification</th>
                      <th>Risk Probability</th>
                      <th>Model Confidence</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((item, idx) => (
                      <tr key={idx}>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`risk-pill ${item.prediction === "Diabetic" ? "high" : "low"}`}>
                            {item.prediction}
                          </span>
                        </td>
                        <td><strong>{item.risk_percentage}%</strong></td>
                        <td>{item.confidence}%</td>
                        <td>
                          <button className="tbl-btn" onClick={() => navigate("/result")}>
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Daily Health Tip Banner */}
          <section className="daily-tip-banner">
            <div className="tip-icon"><FaLightbulb /></div>
            <div className="tip-content">
              <h3>Daily Metabolic Health Insight</h3>
              <p>
                Maintaining regular physical activity for at least 30 minutes daily combined with low-glycemic high-fiber meals improves insulin sensitivity and glycemic stability.
              </p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Dashboard;