import "./FoodAnalyzer.css";
import { useState, useRef } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import {
  FaCamera,
  FaSearch,
  FaUtensils,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCloudUploadAlt,
  FaFire,
  FaBreadSlice,
  FaDrumstickBite,
  FaChartPie,
  FaLightbulb,
  FaSpinner,
  FaShieldAlt,
  FaRedo
} from "react-icons/fa";
import { foodService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";

const SAMPLE_DISH_KEYS = [
  "dishOatsDosa",
  "dishPalakPaneer",
  "dishMoongKhichdi",
  "dishChickenTikka",
  "dishBrownRiceRajma",
  "dishGulabJamun",
  "dishMasalaDosa",
];

function FoodAnalyzer() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("image"); // "image" or "text"
  const [textQuery, setTextQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // Concurrency guard: track current in-flight request ID
  const activeRequestId = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error(t("foodAnalyzer.invalidImageToast") || "Please upload a valid image file (.jpg, .png, .jpeg, .webp)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image file size must be less than 10MB.");
        return;
      }

      // Immediately invalidate any previous result, error, or pending request
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setAnalysisResult(null);
      setAnalysisError(null);
      activeRequestId.current = null;
    }
    // Clear input value so re-selecting the exact same file fires onChange
    e.target.value = "";
  };

  const handleImageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      toast.error(t("foodAnalyzer.selectImageToast") || "Please select a food image to upload.");
      return;
    }

    // Generate unique request ID to guard against stale responses
    const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    activeRequestId.current = reqId;

    setLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null); // Clear previous result so old data is never presented as new

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("client_request_id", reqId);

    try {
      const res = await foodService.analyzeImage(formData);
      // Discard response if user changed the image or triggered a newer request
      if (activeRequestId.current !== reqId) {
        console.warn("[FoodAnalyzer] Discarded stale response for request:", reqId);
        return;
      }

      if (res && res.data) {
        setAnalysisResult(res.data);
        if (res.data.identification_status === "provider_unconfigured") {
          toast.info("AI Vision Provider is not configured (GEMINI_API_KEY required).");
        } else if (res.data.identification_status === "provider_error" || res.data.identification_status === "unrecognized") {
          toast.warn("Could not recognize food in photo. Please check lighting or search by dish name.");
        } else {
          toast.success(`✅ ${t("foodAnalyzer.imageSuccess") || "Food Image Analysis Completed!"}`);
        }
      }
    } catch (err) {
      if (activeRequestId.current === reqId) {
        setAnalysisError(err.message || "Failed to analyze food image.");
        toast.error(err.message || "Failed to analyze food image.");
      }
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  };

  const handleTextSubmit = async (queryToUse) => {
    const query = queryToUse || textQuery;
    if (!query.trim()) {
      toast.error(t("foodAnalyzer.enterMealToast") || "Please enter a meal or dish description.");
      return;
    }

    const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    activeRequestId.current = reqId;

    setLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const res = await foodService.analyzeText(query);
      if (activeRequestId.current !== reqId) return;

      if (res && res.data) {
        setAnalysisResult(res.data);
        if (res.data.identification_status === "unrecognized") {
          toast.warn("Dish not in verified clinical database. Please check spelling or select from known dishes.");
        } else {
          toast.success(`✅ ${t("foodAnalyzer.textSuccess") || "Meal Nutritional Analysis Completed!"}`);
        }
      }
    } catch (err) {
      if (activeRequestId.current === reqId) {
        setAnalysisError(err.message || "Failed to calculate meal nutrition.");
        toast.error(err.message || "Failed to calculate meal nutrition.");
      }
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  };

  const getSuitabilityBadge = (suitability, color) => {
    if (!suitability || suitability.toLowerCase().includes("unverified") || suitability.toLowerCase().includes("unconfigured")) {
      return (
        <div className="suitability-pill amber">
          <FaExclamationTriangle /> 🟡 {suitability || "Unverified"}
        </div>
      );
    }

    let localizedLabel = suitability;
    if (color === "emerald" || suitability.toLowerCase().includes("friendly") || suitability.toLowerCase().includes("ಸ್ನೇಹಿ")) {
      localizedLabel = t("foodAnalyzer.suitDiabeticFriendly") || "Diabetic Friendly";
      return (
        <div className="suitability-pill emerald">
          <FaCheckCircle /> 🟢 {localizedLabel} ({t("foodAnalyzer.lowGi") || "Low GI"})
        </div>
      );
    } else if (color === "amber" || suitability.toLowerCase().includes("moderate") || suitability.toLowerCase().includes("ಮಧ್ಯಮ")) {
      localizedLabel = t("foodAnalyzer.suitModeratePortion") || "Moderate / Control Portion";
      return (
        <div className="suitability-pill amber">
          <FaExclamationTriangle /> 🟡 {localizedLabel} ({t("foodAnalyzer.modGi") || "Mod GI"})
        </div>
      );
    }
    localizedLabel = t("foodAnalyzer.suitHighRiskLimit") || "High Risk / Limit Intake";
    return (
      <div className="suitability-pill red">
        <FaExclamationTriangle /> 🔴 {localizedLabel} ({t("foodAnalyzer.highGi") || "High GI"})
      </div>
    );
  };

  return (
    <>
      <Navbar />

      <div className="food-analyzer-page">
        <div className="food-analyzer-container">
          <BackButton />

          {/* Page Header */}
          <div className="food-header text-center">
            <span className="badge-pill"><FaUtensils /> {t("foodAnalyzer.headerBadge") || "AI Medical Vision Engine"}</span>
            <h1>{t("foodAnalyzer.headerTitle") || "Food Image & Nutrition Calorie Analyzer"}</h1>
            <p>{t("foodAnalyzer.headerDesc") || "Upload any food photo or type your meal to receive instant nutritional facts, Glycemic Index (GI), net carbs, and diabetic plan suitability."}</p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="analyzer-tabs">
            <button
              className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("image");
                setAnalysisError(null);
              }}
            >
              <FaCamera /> 📸 {t("foodAnalyzer.tabImage") || "AI Food Image Recognition"}
            </button>
            <button
              className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("text");
                setAnalysisError(null);
              }}
            >
              <FaSearch /> 🔍 {t("foodAnalyzer.tabText") || "Calorie & Nutrition Search"}
            </button>
          </div>

          {/* Mode 1: AI Food Image Upload */}
          {activeTab === "image" && (
            <div className="analyzer-card">
              <h2>📸 {t("foodAnalyzer.uploadTitle") || "Upload Food Photo for AI Vision Scanning"}</h2>
              <p className="card-subtext">{t("foodAnalyzer.uploadSubtext") || "Supported formats: JPG, PNG, WEBP. Maximum file size: 10MB."}</p>

              <form onSubmit={handleImageSubmit} className="image-upload-form">
                <div className="upload-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    id="food-image-input"
                    className="file-input-hidden"
                  />
                  <label htmlFor="food-image-input" className="dropzone-label">
                    {imagePreview ? (
                      <div className="preview-box">
                        <img src={imagePreview} alt="Food Preview" className="uploaded-preview-img" />
                        <span className="change-img-text">{t("foodAnalyzer.clickChange") || "Click to Change Image"}</span>
                      </div>
                    ) : (
                      <div className="dropzone-prompt">
                        <FaCloudUploadAlt className="upload-icon" />
                        <h3>{t("foodAnalyzer.dropPrompt") || "Drag & drop food photo here, or browse"}</h3>
                        <p>{t("foodAnalyzer.dropDesc") || "AI will detect dishes, calculate calories, net carbs, and glycemic load"}</p>
                      </div>
                    )}
                  </label>
                </div>

                <button type="submit" className="analyze-btn" disabled={loading || !selectedFile}>
                  {loading ? (
                    <>
                      <FaSpinner className="spin-icon" /> {t("foodAnalyzer.scanningBtn") || "AI Scanning Food Image..."}
                    </>
                  ) : (
                    <>
                      <FaCamera /> {t("foodAnalyzer.analyzeBtn") || "Analyze Food Image with AI Vision"}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Mode 2: Meal Text Search */}
          {activeTab === "text" && (
            <div className="analyzer-card">
              <h2>🔍 {t("foodAnalyzer.textTitle") || "Enter Meal or Dish Name"}</h2>
              <p className="card-subtext">{t("foodAnalyzer.textSubtext") || "Type any Indian or global meal (e.g., '2 Oats Dosa', 'Palak Paneer with Roti', 'Chicken Biryani')."}</p>

              <div className="text-search-box">
                <input
                  type="text"
                  placeholder={t("foodAnalyzer.textPlaceholder") || "e.g. 2 Oats Dosa with Mint Chutney"}
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleTextSubmit()}
                />
                <button className="search-btn" onClick={() => handleTextSubmit()} disabled={loading}>
                  {loading ? <FaSpinner className="spin-icon" /> : <><FaSearch /> {t("common.search") || "Search"}</>}
                </button>
              </div>

              {/* Sample Quick Chips */}
              <div className="sample-chips-bar">
                <span className="chips-title"><FaLightbulb /> {t("foodAnalyzer.tryQuick") || "Try Quick Examples:"}</span>
                <div className="chips-wrapper">
                  {SAMPLE_DISH_KEYS.map((dishKey, idx) => {
                    const localizedDish = t(`foodAnalyzer.${dishKey}`) || dishKey;
                    return (
                      <button
                        key={idx}
                        className="sample-chip-btn"
                        onClick={() => {
                          setTextQuery(localizedDish);
                          handleTextSubmit(localizedDish);
                        }}
                        disabled={loading}
                      >
                        {localizedDish}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error Banner with Retry Option */}
          {analysisError && (
            <div className="food-error-card">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", marginBottom: "0.5rem" }}>
                <FaExclamationTriangle size={20} />
                <span>Analysis Could Not Be Completed</span>
              </div>
              <p style={{ color: "#cbd5e1", fontSize: "0.92rem", margin: "0 0 1rem 0" }}>{analysisError}</p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {activeTab === "image" && (
                  <button type="button" className="sample-chip-btn" onClick={handleImageSubmit}>
                    <FaRedo /> Retry Analysis
                  </button>
                )}
                <button type="button" className="sample-chip-btn" onClick={() => setActiveTab("text")}>
                  <FaSearch /> Search by Dish Name Instead
                </button>
              </div>
            </div>
          )}

          {/* Analysis Results Display */}
          {analysisResult && (
            <>
              {analysisResult.identification_status === "provider_unconfigured" ? (
                /* Unconfigured Vision Provider Notice */
                <div className="food-warning-box">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                    <FaLightbulb size={22} color="#f59e0b" />
                    <span>AI Vision Provider Not Configured</span>
                  </div>
                  <p style={{ color: "#e2e8f0", fontSize: "0.92rem", lineHeight: "1.5", margin: "0 0 0.5rem 0" }}>
                    {analysisResult.warning_message || "AI Vision requires GEMINI_API_KEY in backend/.env."}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 1rem 0" }}>
                    {analysisResult.clinical_recommendation}
                  </p>
                  <button
                    type="button"
                    className="sample-chip-btn"
                    onClick={() => setActiveTab("text")}
                    style={{ background: "linear-gradient(135deg, #0d9488 0%, #0284c7 100%)", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
                  >
                    🔍 Switch to Calorie & Nutrition Search →
                  </button>
                </div>
              ) : analysisResult.identification_status === "provider_error" || analysisResult.identification_status === "unrecognized" ? (
                /* Unrecognized / Uncertain Result Notice */
                <div className="food-warning-box">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                    <FaExclamationTriangle size={22} color="#f59e0b" />
                    <span>Food Recognition Uncertain</span>
                  </div>
                  <p style={{ color: "#e2e8f0", fontSize: "0.92rem", lineHeight: "1.5", margin: "0 0 0.5rem 0" }}>
                    {analysisResult.warning_message || "The vision system was unable to identify a verified meal in this image."}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 1rem 0" }}>
                    {analysisResult.clinical_recommendation}
                  </p>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {activeTab === "image" && (
                      <button type="button" className="sample-chip-btn" onClick={handleImageSubmit}>
                        <FaRedo /> Retry Image Scan
                      </button>
                    )}
                    <button type="button" className="sample-chip-btn" onClick={() => setActiveTab("text")}>
                      🔍 Search Dish Manually
                    </button>
                  </div>
                </div>
              ) : (
                /* Identified Dish Result Card */
                <div className="food-result-card">
                  <div className="result-header-row">
                    <div className="dish-header-details">
                      <span className="dish-eyebrow">{t("foodAnalyzer.identifiedDish") || "Identified Dish"}</span>
                      <h2>{analysisResult.dish_name}</h2>
                      {/* Provenance Tag */}
                      <span className={`food-provenance-tag ${analysisResult.provenance === "verified_database" ? "verified" : analysisResult.provenance === "ai_vision" ? "ai" : "unverified"}`}>
                        <FaShieldAlt size={12} />
                        {analysisResult.provenance === "verified_database"
                          ? "Verified Clinical Database"
                          : analysisResult.provenance === "ai_vision"
                          ? "AI Vision Estimate"
                          : "Dietary Estimate"}
                      </span>
                    </div>
                    {getSuitabilityBadge(analysisResult.overall_suitability, analysisResult.suitability_color)}
                  </div>

                  {/* 4 Essential Metrics Summary */}
                  <div className="nutrition-stats-grid">
                    <div className="nutri-stat-box cal">
                      <FaFire className="stat-icon" />
                      <span className="stat-value">
                        {analysisResult.total_calories_kcal !== null ? analysisResult.total_calories_kcal : "N/A"}
                      </span>
                      <span className="stat-label">{t("foodAnalyzer.calories") || "Calories"} (kcal)</span>
                    </div>
                    <div className="nutri-stat-box carbs">
                      <FaBreadSlice className="stat-icon" />
                      <span className="stat-value">
                        {analysisResult.total_carbohydrates_g !== null ? `${analysisResult.total_carbohydrates_g}g` : "N/A"}
                      </span>
                      <span className="stat-label">{t("foodAnalyzer.totalCarbs") || "Carbohydrates"}</span>
                    </div>
                    <div className="nutri-stat-box protein">
                      <FaDrumstickBite className="stat-icon" />
                      <span className="stat-value">
                        {analysisResult.total_protein_g !== null ? `${analysisResult.total_protein_g}g` : "N/A"}
                      </span>
                      <span className="stat-label">{t("foodAnalyzer.protein") || "Dietary Protein"}</span>
                    </div>
                    <div className="nutri-stat-box gi">
                      <FaChartPie className="stat-icon" />
                      <span className="stat-value">
                        {analysisResult.average_glycemic_index !== null ? analysisResult.average_glycemic_index : "N/A"}
                      </span>
                      <span className="stat-label">{t("foodAnalyzer.glycemicIndex") || "Glycemic Index (GI)"}</span>
                    </div>
                  </div>

                  {/* Additional Nutritional Details (Fats, Fiber, Net Carbs, Portion) */}
                  <div className="secondary-metrics-row">
                    <div className="sec-metric-item">
                      <span className="sec-label">{t("foodAnalyzer.netCarbs") || "Net Carbs"}:</span>
                      <span className="sec-val">
                        {analysisResult.total_net_carbs_g !== null ? `${analysisResult.total_net_carbs_g}g` : "N/A"}
                      </span>
                    </div>
                    <div className="sec-metric-item">
                      <span className="sec-label">{t("foodAnalyzer.fiber") || "Dietary Fiber"}:</span>
                      <span className="sec-val">
                        {analysisResult.total_fiber_g !== null ? `${analysisResult.total_fiber_g}g` : "N/A"}
                      </span>
                    </div>
                    <div className="sec-metric-item">
                      <span className="sec-label">{t("foodAnalyzer.healthyFats") || "Healthy Fats"}:</span>
                      <span className="sec-val">
                        {analysisResult.total_fats_g !== null ? `${analysisResult.total_fats_g}g` : "N/A"}
                      </span>
                    </div>
                    <div className="sec-metric-item">
                      <span className="sec-label">{t("foodAnalyzer.portionSize") || "Suggested Portion"}:</span>
                      <span className="sec-val">{analysisResult.suggested_portion || "Standard Serving"}</span>
                    </div>
                  </div>

                  {/* Clinical AI Recommendation Box */}
                  {analysisResult.clinical_recommendation && (
                    <div className="clinical-recommendation-box">
                      <h4><FaLightbulb /> {t("foodAnalyzer.clinicalAdviceTitle") || "Clinical Nutrition Guidance"}</h4>
                      <p>{analysisResult.clinical_recommendation}</p>
                    </div>
                  )}

                  {/* Medical Disclaimer Note */}
                  <div className="food-disclaimer-note">
                    {analysisResult.disclaimer || "Nutritional values are estimates for dietary awareness and do not replace clinical advice."}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

export default FoodAnalyzer;
