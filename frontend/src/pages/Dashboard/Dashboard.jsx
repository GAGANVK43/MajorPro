import "./Dashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeartbeat, FaBrain, FaUtensils, FaRunning, FaFileAlt, FaPlusCircle, FaLightbulb, FaHistory, FaMapMarkerAlt, FaCamera } from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { dashboardService, predictionService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";

function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [hasScreening, setHasScreening] = useState(false);

  const [snapshot, setSnapshot] = useState({
    healthScore: null,
    riskLevel: null,
    riskPercentage: null,
    bmi: null,
    lastAssessment: null,
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
          const hasData = (hs.total_assessments > 0) || (hs.health_score !== null) || (latestPred !== null);
          setHasScreening(Boolean(hasData));

          setSnapshot({
            healthScore: hs.health_score,
            riskLevel: hs.risk_level,
            riskPercentage: latestPred ? `${latestPred.risk_percentage}%` : null,
            bmi: hs.latest_bmi ? hs.latest_bmi.toFixed(1) : null,
            lastAssessment: hs.last_assessed_at
              ? new Date(hs.last_assessed_at).toLocaleDateString()
              : null,
          });
        }

        // Fetch prediction history
        const historyRes = await predictionService.getHistory();
        if (historyRes.data && historyRes.data.predictions) {
          setHistoryList(historyRes.data.predictions);
          if (historyRes.data.predictions.length > 0) {
            setHasScreening(true);
          }
        }
      } catch (err) {
        setHasScreening(false);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const getSnapshotRiskLabel = (level) => {
    if (!level) return "Not Screened";
    if (level === "Low Risk" || level === "Low") return t("result.lowRisk") || "Low Risk";
    if (level === "Moderate Risk" || level === "Moderate") return t("result.moderateRisk") || "Moderate Risk";
    if (level === "High Risk" || level === "High") return t("result.highRisk") || "High Risk";
    return level;
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-page">
        <div className="dashboard-container">
          <BackButton />

          {/* Hero Header */}
          <section className="dashboard-hero">
            <div className="hero-badge">
              <FaHeartbeat /> {t("dashboard.heroBadge")}
            </div>

            <h1>
              {t("dashboard.heroTitle")}{" "}
              <span className="gradient-text">{t("dashboard.heroTitleHighlight")}</span>
            </h1>

            <p>{t("dashboard.heroDesc")}</p>

            <div className="hero-action-buttons">
              <button className="btn-dash primary" onClick={() => navigate("/assessment")}>
                <FaPlusCircle /> {t("dashboard.startNewAssessment")}
              </button>
              <button className="btn-dash secondary" onClick={() => navigate("/result")}>
                <FaFileAlt /> {t("dashboard.viewLatestReport")}
              </button>
            </div>
          </section>

          {/* Onboarding Empty State Banner for New/Unassessed Users */}
          {!loading && !hasScreening && (
            <section className="onboarding-banner-card">
              <div className="onboarding-badge">
                <FaHeartbeat /> Baseline Screening Recommended
              </div>
              <div className="onboarding-content">
                <h2>Establish Your Personal Metabolic Baseline</h2>
                <p>
                  You haven't completed an assessment yet. Complete our comprehensive 2-minute screening
                  to calculate your verified clinical health score, diabetes risk trajectory, and personalized meal plan.
                </p>
                <div className="onboarding-btn-row">
                  <button className="btn-dash primary" onClick={() => navigate("/assessment")}>
                    <FaPlusCircle /> Start Health Screening Now
                  </button>
                  <button className="btn-dash secondary" onClick={() => navigate("/food-analyzer")}>
                    <FaCamera /> Try Food AI Analyzer
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Real Backend Snapshot Metric Cards */}
          <section className="snapshot-section">
            <h2 className="section-heading">{t("dashboard.overviewTitle")}</h2>

            <div className="snapshot-grid">
              <div className="snapshot-card" onClick={() => navigate(hasScreening ? "/result" : "/assessment")}>
                <div className="snap-icon-box">❤️</div>
                <div className="snap-details">
                  <h3>{t("dashboard.healthScore")}</h3>
                  <span className="snap-value">
                    {snapshot.healthScore !== null ? `${snapshot.healthScore} / 100` : "--"}
                  </span>
                  <p className="snap-status">
                    {snapshot.healthScore !== null ? t("dashboard.optimalRange") : "Complete assessment to compute"}
                  </p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate(hasScreening ? "/result" : "/assessment")}>
                <div className="snap-icon-box cyan">🩸</div>
                <div className="snap-details">
                  <h3>{t("dashboard.diabetesRisk")}</h3>
                  <span className="snap-value">{getSnapshotRiskLabel(snapshot.riskLevel)}</span>
                  <p className="snap-status">
                    {snapshot.riskPercentage ? `${t("dashboard.probability")}: ${snapshot.riskPercentage}` : "Screening required"}
                  </p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate("/assessment")}>
                <div className="snap-icon-box emerald">⚖️</div>
                <div className="snap-details">
                  <h3>{t("dashboard.bmiScore")}</h3>
                  <span className="snap-value">{snapshot.bmi !== null ? snapshot.bmi : "--"}</span>
                  <p className="snap-status">{snapshot.bmi !== null ? "kg/m²" : "Pending measurement"}</p>
                </div>
              </div>

              <div className="snapshot-card" onClick={() => navigate(hasScreening ? "/result" : "/assessment")}>
                <div className="snap-icon-box purple">📅</div>
                <div className="snap-details">
                  <h3>{t("dashboard.lastScreening")}</h3>
                  <span className="snap-value">
                    {snapshot.lastAssessment ? (snapshot.lastAssessment === "Today" ? t("dashboard.today") : snapshot.lastAssessment) : "No Record"}
                  </span>
                  <p className="snap-status">
                    {snapshot.lastAssessment ? t("dashboard.verified") : "Not established"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Services Grid */}
          <section className="services-section">
            <h2 className="section-heading">{t("dashboard.coreModules")}</h2>

            <div className="services-grid">
              <div className="dash-service-card" onClick={() => navigate("/assessment")}>
                <div className="service-icon"><FaBrain /></div>
                <h3>{t("dashboard.modPredictionTitle")}</h3>
                <p>{t("dashboard.modPredictionDesc")}</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/diet-plan")}>
                <div className="service-icon utensils"><FaUtensils /></div>
                <h3>{t("dashboard.modDietTitle")}</h3>
                <p>{t("dashboard.modDietDesc")}</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/diet-plan")}>
                <div className="service-icon running"><FaRunning /></div>
                <h3>{t("dashboard.modExerciseTitle")}</h3>
                <p>{t("dashboard.modExerciseDesc")}</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/find-care")}>
                <div className="service-icon findcare"><FaMapMarkerAlt /></div>
                <h3>{t("dashboard.modCareTitle")}</h3>
                <p>{t("dashboard.modCareDesc")}</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/food-analyzer")}>
                <div className="service-icon food"><FaCamera /></div>
                <h3>{t("dashboard.modFoodTitle")}</h3>
                <p>{t("dashboard.modFoodDesc")}</p>
              </div>

              <div className="dash-service-card" onClick={() => navigate("/result")}>
                <div className="service-icon report"><FaFileAlt /></div>
                <h3>{t("dashboard.modReportsTitle")}</h3>
                <p>{t("dashboard.modReportsDesc")}</p>
              </div>
            </div>
          </section>

          {/* Assessment History Table */}
          {historyList.length > 0 && (
            <section className="history-section">
              <h2 className="section-heading"><FaHistory /> {t("dashboard.historyTitle")}</h2>

              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>{t("dashboard.date")}</th>
                      <th>{t("dashboard.classification")}</th>
                      <th>{t("dashboard.probability")}</th>
                      <th>{t("dashboard.confidence")}</th>
                      <th>{t("dashboard.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((item, idx) => (
                      <tr key={idx}>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`risk-pill ${(item.prediction === "Diabetic" || item.prediction === "Higher Risk Pattern" || item.risk_percentage >= 31.0) ? "high" : "low"}`}>
                            {(item.prediction === "Diabetic" || item.prediction === "Higher Risk Pattern" || item.risk_percentage >= 31.0) ? t("result.diabetic") : t("result.nonDiabetic")}
                          </span>
                        </td>
                        <td><strong>{item.risk_percentage}%</strong></td>
                        <td>{item.confidence}%</td>
                        <td>
                          <button className="tbl-btn" onClick={() => navigate("/result")}>
                            {t("common.viewReport")}
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
              <h3>{t("dashboard.dailyTipTitle")}</h3>
              <p>{t("dashboard.dailyTipDesc")}</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Dashboard;