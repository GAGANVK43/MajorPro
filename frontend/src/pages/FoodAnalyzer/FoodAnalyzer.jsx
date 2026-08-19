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
  FaAppleAlt,
  FaChartPie,
  FaLightbulb,
  FaSpinner
} from "react-icons/fa";
import { foodService } from "../../services/api";

const QUICK_DISH_SAMPLES = [
  "Oats & Ragi Dosa",
  "Palak Paneer with Bajra Roti",
  "Moong Dal Khichdi",
  "Chicken Tikka with Salad",
  "Brown Rice with Rajma",
  "Gulab Jamun",
  "Masala Dosa",
];

function FoodAnalyzer() {
  const [activeTab, setActiveTab] = useState("image"); // "image" or "text"
  const [textQuery, setTextQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload a valid image file (.jpg, .png, .jpeg, .webp)");
        return;
      }
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setAnalysisResult(null);
    }
  };

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a food image to upload.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await foodService.analyzeImage(formData);
      if (res && res.data) {
        setAnalysisResult(res.data);
        toast.success("✅ Food Image Analysis Completed!");
      }
    } catch (err) {
      toast.error(err.message || "Failed to analyze food image.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (queryToUse) => {
    const query = queryToUse || textQuery;
    if (!query.trim()) {
      toast.error("Please enter a meal or dish description.");
      return;
    }

    setLoading(true);
    try {
      const res = await foodService.analyzeText(query);
      if (res && res.data) {
        setAnalysisResult(res.data);
        toast.success("✅ Meal Nutritional Analysis Completed!");
      }
    } catch (err) {
      toast.error(err.message || "Failed to calculate meal nutrition.");
    } finally {
      setLoading(false);
    }
  };

  const getSuitabilityBadge = (suitability, color) => {
    if (color === "emerald") {
      return (
        <div className="suitability-pill emerald">
          <FaCheckCircle /> 🟢 {suitability} (Low GI)
        </div>
      );
    } else if (color === "amber") {
      return (
        <div className="suitability-pill amber">
          <FaExclamationTriangle /> 🟡 {suitability} (Moderate GI)
        </div>
      );
    }
    return (
      <div className="suitability-pill red">
        <FaExclamationTriangle /> 🔴 {suitability} (High GI / Limit Portion)
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
            <span className="badge-pill"><FaUtensils /> AI Medical Vision Engine</span>
            <h1>Food Image & Nutrition Calorie Analyzer</h1>
            <p>
              Upload any food photo or type your meal to receive instant nutritional facts, Glycemic Index (GI), net carbs, and diabetic plan suitability.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="analyzer-tabs">
            <button
              className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
              onClick={() => setActiveTab("image")}
            >
              <FaCamera /> 📸 AI Food Image Recognition
            </button>
            <button
              className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
              onClick={() => setActiveTab("text")}
            >
              <FaSearch /> 🔍 Calorie & Nutrition Search
            </button>
          </div>

          {/* Mode 1: AI Food Image Upload */}
          {activeTab === "image" && (
            <div className="analyzer-card">
              <h2>📸 Upload Food Photo for AI Vision Scanning</h2>
              <p className="card-subtext">Supported formats: JPG, PNG, WEBP. Maximum file size: 10MB.</p>

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
                        <span className="change-img-text">Click to Change Image</span>
                      </div>
                    ) : (
                      <div className="dropzone-prompt">
                        <FaCloudUploadAlt className="upload-icon" />
                        <h3>Drag & drop food photo here, or browse</h3>
                        <p>AI will detect dishes, calculate calories, net carbs, and glycemic load</p>
                      </div>
                    )}
                  </label>
                </div>

                <button type="submit" className="analyze-btn" disabled={loading || !selectedFile}>
                  {loading ? (
                    <>
                      <FaSpinner className="spin-icon" /> AI Scanning Food Image...
                    </>
                  ) : (
                    <>
                      <FaCamera /> Analyze Food Image with AI Vision
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Mode 2: Meal Text Search */}
          {activeTab === "text" && (
            <div className="analyzer-card">
              <h2>🔍 Enter Meal or Dish Name</h2>
              <p className="card-subtext">Type any Indian or global meal (e.g., "2 Oats Dosa", "Palak Paneer with Roti", "Chicken Biryani").</p>

              <div className="text-search-box">
                <input
                  type="text"
                  placeholder="e.g. 2 Oats Dosa with Mint Chutney"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleTextSubmit()}
                />
                <button className="search-btn" onClick={() => handleTextSubmit()} disabled={loading}>
                  {loading ? <FaSpinner className="spin-icon" /> : <><FaSearch /> Analyze</>}
                </button>
              </div>

              {/* Sample Quick Chips */}
              <div className="sample-chips-bar">
                <span className="chips-title"><FaLightbulb /> Try Quick Examples:</span>
                <div className="chips-wrapper">
                  {QUICK_DISH_SAMPLES.map((dish, idx) => (
                    <button
                      key={idx}
                      className="sample-chip-btn"
                      onClick={() => {
                        setTextQuery(dish);
                        handleTextSubmit(dish);
                      }}
                      disabled={loading}
                    >
                      {dish}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nutritional Analysis Results Panel */}
          {analysisResult && (
            <div className="analysis-results-card">
              <div className="results-header">
                <div>
                  <span className="analysis-pill"><FaChartPie /> AI Nutrition Report</span>
                  <h2>{analysisResult.dish_name}</h2>
                  <p className="portion-subtext">Suggested Portion: <strong>{analysisResult.suggested_portion}</strong></p>
                </div>
                {getSuitabilityBadge(analysisResult.overall_suitability, analysisResult.suitability_color)}
              </div>

              {/* Identified Items Pills */}
              {analysisResult.identified_items && analysisResult.identified_items.length > 0 && (
                <div className="items-pills-bar">
                  <span className="pills-label">Detected Food Components:</span>
                  {analysisResult.identified_items.map((item, i) => (
                    <span key={i} className="item-badge">{item}</span>
                  ))}
                </div>
              )}

              {/* Macro Nutritional Cards Grid */}
              <div className="macros-grid">
                <div className="macro-card red">
                  <div className="macro-icon"><FaFire /></div>
                  <div className="macro-data">
                    <h3>{analysisResult.total_calories_kcal} kcal</h3>
                    <p>Total Calories</p>
                  </div>
                </div>

                <div className="macro-card amber">
                  <div className="macro-icon"><FaBreadSlice /></div>
                  <div className="macro-data">
                    <h3>{analysisResult.total_carbohydrates_g} g</h3>
                    <p>Carbohydrates (Net: {analysisResult.total_net_carbs_g}g)</p>
                  </div>
                </div>

                <div className="macro-card emerald">
                  <div className="macro-icon"><FaDrumstickBite /></div>
                  <div className="macro-data">
                    <h3>{analysisResult.total_protein_g} g</h3>
                    <p>Dietary Protein</p>
                  </div>
                </div>

                <div className="macro-card cyan">
                  <div className="macro-icon"><FaAppleAlt /></div>
                  <div className="macro-data">
                    <h3>{analysisResult.total_fiber_g} g</h3>
                    <p>Soluble Dietary Fiber</p>
                  </div>
                </div>

                <div className="macro-card indigo">
                  <div className="macro-icon"><FaChartPie /></div>
                  <div className="macro-data">
                    <h3>GI: {analysisResult.average_glycemic_index}</h3>
                    <p>Glycemic Index (GI)</p>
                  </div>
                </div>
              </div>

              {/* Clinical Advice Section */}
              <div className="clinical-advice-box">
                <h4>💙 Clinical Diabetes Management Advice</h4>
                <p>{analysisResult.clinical_recommendation}</p>
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
