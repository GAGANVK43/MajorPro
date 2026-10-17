import "./FoodAnalyzer.css";
import { useState } from "react";
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
  FaInfoCircle,
  FaLayerGroup,
  FaShieldAlt,
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
  const [customDishInput, setCustomDishInput] = useState("");

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setAnalysisResult(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error(t("foodAnalyzer.invalidImageToast") || "Please upload a valid image file.");
        return;
      }
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setAnalysisResult(null); // Clear stale results immediately
    }
  };

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error(t("foodAnalyzer.selectImageToast") || "Please select an image first.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await foodService.analyzeImage(formData);
      if (res && res.data) {
        setAnalysisResult(res.data);
        if (res.data.status === "needs_confirmation") {
          toast.info("Image received. Please confirm your dish to view verified nutrition.");
        } else if (res.data.status === "unrecognized") {
          toast.warn("Image lacks clear food features. Please select an alternative or search by text.");
        } else {
          toast.success(`✅ ${t("foodAnalyzer.imageSuccess") || "Food identified successfully."}`);
        }
      }
    } catch (err) {
      setAnalysisResult(null);
      toast.error(err.message || "Failed to analyze food image.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (queryToUse) => {
    const query = queryToUse || textQuery;
    if (!query.trim()) {
      toast.error(t("foodAnalyzer.enterMealToast") || "Please enter a meal description.");
      return;
    }

    setLoading(true);
    try {
      const res = await foodService.analyzeText(query);
      if (res && res.data) {
        setAnalysisResult(res.data);
        toast.success(`✅ ${t("foodAnalyzer.textSuccess") || "Nutrition calculated."}`);
      }
    } catch (err) {
      setAnalysisResult(null);
      toast.error(err.message || "Failed to calculate meal nutrition.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDish = async (dishName) => {
    if (!dishName || !dishName.trim()) return;
    setLoading(true);
    try {
      const res = await foodService.confirm(dishName.trim());
      if (res && res.data) {
        setAnalysisResult(res.data);
        toast.success(`Verified: ${res.data.dish_name}`);
      }
    } catch (err) {
      toast.error(err.message || "Failed to verify nutrition for selected dish.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomCorrection = async () => {
    if (!customDishInput.trim()) return;
    await handleConfirmDish(customDishInput.trim());
    setCustomDishInput("");
  };

  const getSuitabilityBadge = (suitability, color) => {
    if (!suitability || color === "neutral") {
      return (
        <div className="suitability-pill neutral">
          <FaInfoCircle /> ℹ️ Confirmation Required
        </div>
      );
    }
    let localizedLabel = suitability;
    if (color === "emerald" || suitability?.toLowerCase().includes("friendly") || suitability?.toLowerCase().includes("ಸ್ನೇಹಿ")) {
      localizedLabel = t("foodAnalyzer.suitDiabeticFriendly") || "Diabetic Friendly";
      return (
        <div className="suitability-pill emerald">
          <FaCheckCircle /> 🟢 {localizedLabel} ({t("foodAnalyzer.lowGi") || "Low GI"})
        </div>
      );
    } else if (color === "amber" || suitability?.toLowerCase().includes("moderate") || suitability?.toLowerCase().includes("ಮಧ್ಯಮ")) {
      localizedLabel = t("foodAnalyzer.suitModeratePortion") || "Moderate / Control Portion";
      return (
        <div className="suitability-pill amber">
          <FaExclamationTriangle /> 🟡 {localizedLabel} ({t("foodAnalyzer.modGi") || "Moderate GI"})
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
            <span className="badge-pill">
              <FaUtensils /> {t("foodAnalyzer.headerBadge") || "Clinical Food Intelligence"}
            </span>
            <h1>{t("foodAnalyzer.headerTitle") || "AI Food & Nutrition Analyzer"}</h1>
            <p>
              {t("foodAnalyzer.headerDesc") ||
                "Upload a meal photograph or enter dish names to retrieve authenticated glycemic index ratings, macronutrients, and evidence-based diabetic dietary guidance."}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="analyzer-tabs">
            <button
              className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
              onClick={() => handleTabSwitch("image")}
            >
              <FaCamera /> 📸 {t("foodAnalyzer.tabImage") || "Scan Food Photo"}
            </button>
            <button
              className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
              onClick={() => handleTabSwitch("text")}
            >
              <FaSearch /> 🔍 {t("foodAnalyzer.tabText") || "Search by Food Name"}
            </button>
          </div>

          {/* Mode 1: AI Food Image Upload */}
          {activeTab === "image" && (
            <div className="analyzer-card">
              <h2>📸 {t("foodAnalyzer.uploadTitle") || "Upload Meal Photograph"}</h2>
              <p className="card-subtext">
                {t("foodAnalyzer.uploadSubtext") ||
                  "Capture or select a clear, well-lit photo of your prepared meal. DiaSense will analyze visual features and retrieve verified glycemic data."}
              </p>

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
                        <span className="change-img-text">
                          {t("foodAnalyzer.clickChange") || "Click to change photo"}
                        </span>
                      </div>
                    ) : (
                      <div className="dropzone-prompt">
                        <FaCloudUploadAlt className="upload-icon" />
                        <h3>{t("foodAnalyzer.dropPrompt") || "Drop your meal photo here or browse"}</h3>
                        <p>{t("foodAnalyzer.dropDesc") || "Supports JPEG, PNG, and WebP up to 10MB"}</p>
                      </div>
                    )}
                  </label>
                </div>

                <button type="submit" className="analyze-btn" disabled={loading || !selectedFile}>
                  {loading ? (
                    <>
                      <FaSpinner className="spin-icon" /> {t("foodAnalyzer.scanningBtn") || "Analyzing meal..."}
                    </>
                  ) : (
                    <>
                      <FaCamera /> {t("foodAnalyzer.analyzeBtn") || "Analyze Food Image"}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Mode 2: Meal Text Search */}
          {activeTab === "text" && (
            <div className="analyzer-card">
              <h2>🔍 {t("foodAnalyzer.textTitle") || "Search Meal or Ingredients"}</h2>
              <p className="card-subtext">
                {t("foodAnalyzer.textSubtext") ||
                  "Type your meal name or ingredients (e.g. '2 Chapati with Dal Tadka' or 'Grilled Chicken Salad') to calculate instant clinical nutrition."}
              </p>

              <div className="text-search-box">
                <input
                  type="text"
                  placeholder={t("foodAnalyzer.textPlaceholder") || "e.g., 2 Ragi Roti with Palak Paneer..."}
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                />
                <button className="search-btn" onClick={() => handleTextSubmit()} disabled={loading}>
                  {loading ? (
                    <FaSpinner className="spin-icon" />
                  ) : (
                    <>
                      <FaSearch /> {t("common.search") || "Analyze"}
                    </>
                  )}
                </button>
              </div>

              {/* Sample Quick Chips */}
              <div className="sample-chips-bar">
                <span className="chips-title">
                  <FaLightbulb /> {t("foodAnalyzer.tryQuick") || "Quick Clinical Suggestions:"}
                </span>
                <div className="chips-wrapper">
                  {SAMPLE_DISH_KEYS.map((dishKey, idx) => {
                    const localizedDish = t(`foodAnalyzer.${dishKey}`);
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

          {/* =================================================================== */}
          {/* RESULT STATE 1: UNRECOGNIZED / BLANK IMAGE                          */}
          {/* =================================================================== */}
          {analysisResult && analysisResult.status === "unrecognized" && (
            <div className="food-result-card warning-state">
              <div className="state-banner unrecognized">
                <FaExclamationTriangle className="state-banner-icon" />
                <div>
                  <h3>Could Not Recognize Food in Photograph</h3>
                  <p>{analysisResult.clinical_recommendation}</p>
                </div>
              </div>

              <div className="unrecognized-guidance">
                <h4>Helpful Photo Tips:</h4>
                <ul>
                  <li>Ensure good room lighting without excessive shadows or glares.</li>
                  <li>Center the prepared plate so all meal items are clearly visible.</li>
                  <li>Avoid uploading blank, dark, or non-food images.</li>
                </ul>
              </div>

              {/* Offer quick search alternative */}
              <div className="candidate-alternatives-bar">
                <span className="alt-label">
                  <FaLightbulb /> Or select a meal from our clinical database:
                </span>
                <div className="alt-chips">
                  {analysisResult.candidate_alternatives?.map((alt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="alt-chip-btn"
                      onClick={() => handleConfirmDish(alt)}
                      disabled={loading}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* RESULT STATE 2: NEEDS CONFIRMATION (OFFLINE OR LOW CONFIDENCE)     */}
          {/* =================================================================== */}
          {analysisResult && analysisResult.status === "needs_confirmation" && (
            <div className="food-result-card confirmation-state">
              <div className="state-banner confirmation">
                <FaShieldAlt className="state-banner-icon" />
                <div>
                  <h3>Meal Confirmation Required</h3>
                  <p>{analysisResult.clinical_recommendation}</p>
                </div>
              </div>

              <div className="candidate-selection-panel">
                <h4>
                  <FaUtensils /> Is your meal one of these dishes? Click to view verified clinical nutrition:
                </h4>
                <div className="alt-chips large">
                  {analysisResult.candidate_alternatives?.map((candidate, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="candidate-choice-btn"
                      onClick={() => handleConfirmDish(candidate)}
                      disabled={loading}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Dish Entry for Instant Recalculation */}
              <div className="dish-correction-box">
                <label htmlFor="dish-confirmation-input" className="correction-label">
                  <FaSearch /> Or type the exact name of your dish:
                </label>
                <div className="correction-input-group">
                  <input
                    id="dish-confirmation-input"
                    type="text"
                    placeholder="e.g. Burger, Chicken Meal, Chapati, Moong Dal Khichdi, Idli..."
                    value={customDishInput}
                    onChange={(e) => setCustomDishInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomCorrection()}
                  />
                  <button
                    type="button"
                    className="recalc-btn"
                    onClick={handleCustomCorrection}
                    disabled={loading || !customDishInput.trim()}
                  >
                    {loading ? <FaSpinner className="spin-icon" /> : "Verify Nutrition"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* RESULT STATE 3: IDENTIFIED OR MULTIPLE FOODS DETECTED               */}
          {/* =================================================================== */}
          {analysisResult &&
            (analysisResult.status === "identified" || analysisResult.status === "multiple_foods_detected") && (
              <div className="food-result-card verified-state">
                <div className="result-header-row">
                  <div>
                    <span className="dish-eyebrow">
                      {analysisResult.status === "multiple_foods_detected" ? (
                        <>
                          <FaLayerGroup /> Composite Plate Detected
                        </>
                      ) : (
                        t("foodAnalyzer.identifiedDish") || "Verified Meal"
                      )}
                    </span>
                    <h2>{analysisResult.dish_name}</h2>

                    {/* Honest Confidence & Source Badges */}
                    <div className="confidence-pill-row">
                      {analysisResult.is_user_confirmed ? (
                        <span className="confidence-pill confirmed">
                          <FaCheckCircle /> Confirmed by User (Clinical Database Verified)
                        </span>
                      ) : analysisResult.confidence_score ? (
                        <span className="confidence-pill ai-vision">
                          <FaCheckCircle /> AI Vision Verified ({Math.round(analysisResult.confidence_score * 100)}% Match)
                        </span>
                      ) : (
                        <span className="confidence-pill verified">
                          <FaCheckCircle /> Verified Clinical Database
                        </span>
                      )}
                    </div>
                  </div>
                  {getSuitabilityBadge(analysisResult.overall_suitability, analysisResult.suitability_color)}
                </div>

                {/* Multiple Food Component Tags */}
                {analysisResult.status === "multiple_foods_detected" && analysisResult.identified_items?.length > 1 && (
                  <div className="plate-components-bar">
                    <span className="comp-label">Detected Plate Components:</span>
                    <div className="comp-tags">
                      {analysisResult.identified_items.map((item, idx) => (
                        <span key={idx} className="comp-tag-pill">
                          🥗 {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4 Essential Metrics Summary */}
                <div className="nutrition-stats-grid">
                  <div className="nutri-stat-box cal">
                    <FaFire className="stat-icon" />
                    <span className="stat-value">{analysisResult.total_calories_kcal ?? "--"}</span>
                    <span className="stat-label">{t("foodAnalyzer.calories") || "Calories"} (kcal)</span>
                  </div>
                  <div className="nutri-stat-box carbs">
                    <FaBreadSlice className="stat-icon" />
                    <span className="stat-value">{analysisResult.total_carbohydrates_g ?? "--"}g</span>
                    <span className="stat-label">{t("foodAnalyzer.totalCarbs") || "Total Carbs"}</span>
                  </div>
                  <div className="nutri-stat-box protein">
                    <FaDrumstickBite className="stat-icon" />
                    <span className="stat-value">{analysisResult.total_protein_g ?? "--"}g</span>
                    <span className="stat-label">{t("foodAnalyzer.protein") || "Protein"}</span>
                  </div>
                  <div className="nutri-stat-box gi">
                    <FaChartPie className="stat-icon" />
                    <span className="stat-value">{analysisResult.average_glycemic_index ?? "--"}</span>
                    <span className="stat-label">{t("foodAnalyzer.glycemicIndex") || "Glycemic Index"} (GI)</span>
                  </div>
                </div>

                {/* Secondary Metrics Row */}
                <div className="secondary-metrics-row">
                  <div className="sec-metric-item">
                    <span className="sec-label">{t("foodAnalyzer.netCarbs") || "Net Carbs"}:</span>
                    <span className="sec-val">{analysisResult.total_net_carbs_g ?? "--"}g</span>
                  </div>
                  <div className="sec-metric-item">
                    <span className="sec-label">{t("foodAnalyzer.fiber") || "Dietary Fiber"}:</span>
                    <span className="sec-val">{analysisResult.total_fiber_g ?? "--"}g</span>
                  </div>
                  <div className="sec-metric-item">
                    <span className="sec-label">{t("foodAnalyzer.healthyFats") || "Fats"}:</span>
                    <span className="sec-val">{analysisResult.total_fats_g ?? "--"}g</span>
                  </div>
                  <div className="sec-metric-item">
                    <span className="sec-label">{t("foodAnalyzer.portionSize") || "Portion"}:</span>
                    <span className="sec-val">{analysisResult.suggested_portion || "1 serving"}</span>
                  </div>
                </div>

                {/* Clinical Recommendation Box */}
                {analysisResult.clinical_recommendation && (
                  <div className="clinical-recommendation-box">
                    <h4>
                      <FaLightbulb /> {t("foodAnalyzer.clinicalAdviceTitle") || "Clinical Dietary Guidance"}
                    </h4>
                    <p>{analysisResult.clinical_recommendation}</p>
                  </div>
                )}

                {/* Candidate Alternatives Bar */}
                {analysisResult.candidate_alternatives && analysisResult.candidate_alternatives.length > 0 && (
                  <div className="candidate-alternatives-bar">
                    <span className="alt-label">
                      <FaLightbulb /> Healthy Low-GI Alternatives:
                    </span>
                    <div className="alt-chips">
                      {analysisResult.candidate_alternatives.map((alt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="alt-chip-btn"
                          onClick={() => handleConfirmDish(alt)}
                          disabled={loading}
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Dish Correction Box */}
                <div className="dish-correction-box">
                  <label htmlFor="dish-correction-input" className="correction-label">
                    <FaUtensils /> Not the right dish? Enter correct name to recalculate:
                  </label>
                  <div className="correction-input-group">
                    <input
                      id="dish-correction-input"
                      type="text"
                      placeholder="e.g. Burger, Chicken Meal, Moong Dal Khichdi, Oats Dosa..."
                      value={customDishInput}
                      onChange={(e) => setCustomDishInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCustomCorrection()}
                    />
                    <button
                      type="button"
                      className="recalc-btn"
                      onClick={handleCustomCorrection}
                      disabled={loading || !customDishInput.trim()}
                    >
                      {loading ? <FaSpinner className="spin-icon" /> : "Recalculate"}
                    </button>
                  </div>
                </div>

                {/* Medical Safety Disclaimer Strip */}
                <div className="medical-disclaimer-strip">
                  <FaShieldAlt className="disclaimer-icon" />
                  <p>
                    {analysisResult.disclaimer ||
                      "Clinical nutrition values and glycemic index estimations are for educational awareness and dietary self-management only. Consult your physician or registered dietitian for medical meal planning."}
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>

      <Footer />
    </>
  );
}

export default FoodAnalyzer;
