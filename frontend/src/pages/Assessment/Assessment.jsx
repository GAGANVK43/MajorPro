import "./Assessment.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser, FaStethoscope, FaRunning, FaCheckCircle,
  FaBrain, FaInfoCircle, FaCalculator, FaAppleAlt
} from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { predictionService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";

function Assessment() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    // Step 1 — Personal & Physical
    fullName: "",
    age: "42",
    gender: "Male",
    patientGroup: "Urban",
    height: "170",
    weight: "75",
    bmi: "26.0",
    // Step 2 — Clinical / Lab Values
    fastingGlucose: "",
    hba1c: "",
    bloodPressure: "",
    familyHistory: "0",
    // Step 3 — Lifestyle
    physicalActivityHours: "3",
    dailySugarIntake: "50",
    fastFoodFrequency: "2",
    sleepHours: "7",
    monthlyIncome: "",
  });

  // Auto-calculate BMI from height & weight
  useEffect(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (h > 0 && w > 0) {
      const calcBmi = (w / ((h / 100) ** 2)).toFixed(1);
      setFormData((prev) => ({ ...prev, bmi: calcBmi }));
    }
  }, [formData.height, formData.weight]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.age || parseFloat(formData.age) < 1 || parseFloat(formData.age) > 110) {
        toast.error("Please enter a valid age (1–110).");
        return false;
      }
      if (!formData.height || parseFloat(formData.height) < 100) {
        toast.error("Please enter your height in cm (e.g. 165).");
        return false;
      }
      if (!formData.weight || parseFloat(formData.weight) < 20) {
        toast.error("Please enter your weight in kg.");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      if (step === 3) {
        handleAnalysis();
      } else {
        setStep((prev) => prev + 1);
      }
    }
  };

  const handleAnalysis = async () => {
    setLoading(true);
    toast.info("🧠 Analysing your health information...");

    try {
      // Build payload exactly matching the FastAPI PredictionRequest v2 schema
      const payload = {
        patient_group:           formData.patientGroup || null,
        age:                     parseFloat(formData.age) || null,
        gender:                  formData.gender || null,
        bmi:                     parseFloat(formData.bmi) || null,
        blood_pressure:          formData.bloodPressure ? parseFloat(formData.bloodPressure) : null,
        physical_activity_hours: formData.physicalActivityHours ? parseFloat(formData.physicalActivityHours) : null,
        daily_sugar_intake:      formData.dailySugarIntake ? parseFloat(formData.dailySugarIntake) : null,
        fast_food_frequency:     formData.fastFoodFrequency ? parseFloat(formData.fastFoodFrequency) : null,
        sleep_hours:             formData.sleepHours ? parseFloat(formData.sleepHours) : null,
        hba1c:                   formData.hba1c ? parseFloat(formData.hba1c) : null,
        fasting_glucose:         formData.fastingGlucose ? parseFloat(formData.fastingGlucose) : null,
        family_history:          parseFloat(formData.familyHistory) || 0,
        monthly_income:          formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : null,
        month:                   new Date().getMonth() + 1,  // current month
      };

      const response = await predictionService.createPrediction(payload);
      const resultData = response.data;

      // Store in localStorage for the Result page
      localStorage.setItem("latest_prediction", JSON.stringify(resultData));
      toast.success("✅ Health assessment complete!");
      setTimeout(() => navigate("/result"), 800);
    } catch (err) {
      toast.error(err.message || "Failed to analyse health information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="assessment-page">
        <div className="assessment-container">
          <BackButton />

          {/* Page Header */}
          <div className="assessment-header text-center">
            <span className="badge-pill">🩺 Health Risk Screening</span>
            <h1>{t("assessment.headerTitle") || "Health Risk Screening"}</h1>
            <p className="assessment-disclaimer">
              ⚕️ This is a <strong>health awareness screening</strong> tool — not a medical diagnosis.
              Results are model-estimated risk patterns. Always consult a healthcare professional.
            </p>
          </div>

          {/* Stepper Progress */}
          <div className="stepper-bar">
            {["Personal & Physical", "Clinical Values", "Lifestyle Habits"].map((label, idx) => (
              <div key={idx} className={`step-item ${step > idx + 1 ? "completed" : ""} ${step === idx + 1 ? "active" : ""}`}>
                <div className="step-circle">{step > idx + 1 ? <FaCheckCircle /> : idx + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="assessment-card">

            {/* ── STEP 1: Personal & Physical ── */}
            {step === 1 && (
              <div className="form-step-content">
                <h2><FaUser /> Personal & Physical Information</h2>
                <p className="step-subtitle">Your basic health profile helps calibrate the screening model.</p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" placeholder="e.g. Priya Sharma"
                      value={formData.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>Age (years) *</label>
                    <input type="number" placeholder="e.g. 42" min="1" max="110"
                      value={formData.age}
                      onChange={(e) => handleChange("age", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>Gender</label>
                    <select value={formData.gender} onChange={(e) => handleChange("gender", e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Location Type</label>
                    <select value={formData.patientGroup} onChange={(e) => handleChange("patientGroup", e.target.value)}>
                      <option value="Urban">Urban</option>
                      <option value="Semi-Urban">Semi-Urban</option>
                      <option value="Rural">Rural</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Height (cm) *</label>
                    <input type="number" placeholder="e.g. 165" min="100" max="230"
                      value={formData.height}
                      onChange={(e) => handleChange("height", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>Weight (kg) *</label>
                    <input type="number" placeholder="e.g. 72" min="20" max="250"
                      value={formData.weight}
                      onChange={(e) => handleChange("weight", e.target.value)} />
                  </div>

                  <div className="input-group bmi-auto-group">
                    <label><FaCalculator /> BMI (auto-calculated)</label>
                    <div className="bmi-display">
                      <span>{formData.bmi || "–"}</span> kg/m²
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Clinical / Lab Values ── */}
            {step === 2 && (
              <div className="form-step-content">
                <h2><FaStethoscope /> Clinical & Lab Values</h2>
                <p className="step-subtitle">
                  Enter your blood test results if available. All fields are optional — the model
                  will estimate missing values from population data.
                </p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>
                      Fasting Blood Glucose (mg/dL)
                      <span className="tooltip-badge" title="Normal: < 100 mg/dL | Pre-diabetic: 100-125 | High: ≥ 126">
                        <FaInfoCircle /> 70–125
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 108 (leave blank if unknown)"
                      value={formData.fastingGlucose}
                      onChange={(e) => handleChange("fastingGlucose", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>
                      HbA1c (%)
                      <span className="tooltip-badge" title="Normal: < 5.7% | Pre-diabetic: 5.7-6.4% | High: ≥ 6.5%">
                        <FaInfoCircle /> 4–6.4 normal
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 5.8 (leave blank if unknown)" step="0.1"
                      value={formData.hba1c}
                      onChange={(e) => handleChange("hba1c", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>
                      Blood Pressure (mmHg)
                      <span className="tooltip-badge" title="Systolic blood pressure. Normal: < 120 mmHg">
                        <FaInfoCircle /> systolic
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 125 (leave blank if unknown)"
                      value={formData.bloodPressure}
                      onChange={(e) => handleChange("bloodPressure", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>Family History of Diabetes</label>
                    <select value={formData.familyHistory} onChange={(e) => handleChange("familyHistory", e.target.value)}>
                      <option value="0">No — No family history</option>
                      <option value="1">Yes — Parent/sibling has diabetes</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Monthly Household Income (₹)</label>
                    <input type="number" placeholder="e.g. 35000 (optional)"
                      value={formData.monthlyIncome}
                      onChange={(e) => handleChange("monthlyIncome", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Lifestyle Habits ── */}
            {step === 3 && (
              <div className="form-step-content">
                <h2><FaRunning /> Lifestyle & Daily Habits</h2>
                <p className="step-subtitle">
                  Lifestyle factors are major predictors in this model. Be honest for the most accurate screening.
                </p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>
                      Physical Activity (hours/day)
                      <span className="tooltip-badge" title="WHO recommends ≥ 150 min/week of moderate activity">
                        <FaInfoCircle /> WHO: 2.1+ hrs
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 3.5" step="0.5" min="0" max="20"
                      value={formData.physicalActivityHours}
                      onChange={(e) => handleChange("physicalActivityHours", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>
                      Daily Sugar Intake (grams)
                      <span className="tooltip-badge" title="Includes sugar in tea, soft drinks, sweets, processed foods. WHO recommends < 25-50g/day">
                        <FaInfoCircle /> WHO: &lt;50g
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 55" min="0" max="200"
                      value={formData.dailySugarIntake}
                      onChange={(e) => handleChange("dailySugarIntake", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>
                      <FaAppleAlt /> Fast Food / Junk Food (meals/week)
                      <span className="tooltip-badge" title="Number of fast food or processed food meals per week">
                        <FaInfoCircle /> meals/week
                      </span>
                    </label>
                    <input type="number" placeholder="e.g. 2" min="0" max="21"
                      value={formData.fastFoodFrequency}
                      onChange={(e) => handleChange("fastFoodFrequency", e.target.value)} />
                  </div>

                  <div className="input-group">
                    <label>Sleep (hours/night)</label>
                    <input type="number" placeholder="e.g. 7" step="0.5" min="2" max="14"
                      value={formData.sleepHours}
                      onChange={(e) => handleChange("sleepHours", e.target.value)} />
                  </div>
                </div>

                {/* Summary Preview before submit */}
                <div className="summary-preview">
                  <h4>📋 Your Summary</h4>
                  <div className="summary-chips">
                    <span>Age: {formData.age} yrs</span>
                    <span>BMI: {formData.bmi}</span>
                    <span>Activity: {formData.physicalActivityHours} hrs/day</span>
                    <span>Sugar: {formData.dailySugarIntake}g/day</span>
                    <span>Sleep: {formData.sleepHours} hrs</span>
                    {formData.familyHistory === "1" && <span className="risk-chip">Family History ⚠️</span>}
                    {formData.fastingGlucose && <span>Glucose: {formData.fastingGlucose} mg/dL</span>}
                    {formData.hba1c && <span>HbA1c: {formData.hba1c}%</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="stepper-actions">
              {step > 1 && (
                <button className="btn-step secondary" onClick={() => setStep(step - 1)}>
                  ← Previous
                </button>
              )}
              {step < 3 && (
                <button className="btn-step primary" onClick={handleNextStep}>
                  Next →
                </button>
              )}
              {step === 3 && (
                <button className="btn-step primary predict-btn" onClick={handleNextStep} disabled={loading}>
                  <FaBrain /> {loading ? "Analysing..." : "Run Health Screening →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="ai-loading-overlay">
          <div className="loading-card">
            <FaBrain className="spinner-brain" />
            <h3>Analysing your health profile...</h3>
            <p>Running India Diabetes Risk Model v2</p>
            <small>⚕️ This is a screening tool, not a diagnosis.</small>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default Assessment;