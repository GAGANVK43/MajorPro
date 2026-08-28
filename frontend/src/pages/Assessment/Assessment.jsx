import "./Assessment.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaUser, FaStethoscope, FaRunning, FaCheckCircle, FaBrain, FaInfoCircle, FaCalculator } from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { predictionService, assessmentService } from "../../services/api";

function Assessment() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    age: "35",
    gender: "Male",
    height: "170",
    weight: "70",
    glucose: "115",
    bloodPressure: "75",
    insulin: "80",
    bmi: "24.2",
    skinThickness: "20",
    familyHistory: "No",
    exerciseLevel: "Regular",
    smoking: "No",
    alcohol: "No",
    sleepHours: "7",
  });

  // Auto-calculate BMI whenever height or weight updates
  useEffect(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (h > 0 && w > 0) {
      const hMeter = h / 100.0;
      const calcBmi = (w / (hMeter * hMeter)).toFixed(1);
      setFormData((prev) => ({ ...prev, bmi: calcBmi }));
    }
  }, [formData.height, formData.weight]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.age || parseInt(formData.age, 10) <= 0 || parseInt(formData.age, 10) > 120) {
        toast.error("Please enter a valid age (1-120 yrs).");
        return false;
      }
      if (!formData.height || parseFloat(formData.height) <= 0) {
        toast.error("Please enter a valid height in cm.");
        return false;
      }
      if (!formData.weight || parseFloat(formData.weight) <= 0) {
        toast.error("Please enter a valid weight in kg.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.glucose || parseFloat(formData.glucose) <= 0) {
        toast.error("Please enter a valid blood glucose level.");
        return false;
      }
      if (!formData.bloodPressure || parseFloat(formData.bloodPressure) <= 0) {
        toast.error("Please enter a valid diastolic blood pressure.");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      if (step === 3) {
        // Direct prediction execution on Step 3 submit
        handleAnalysis();
      } else {
        setStep((prev) => prev + 1);
      }
    }
  };

  const handleAnalysis = async () => {
    setLoading(true);
    toast.info("🧠 Executing XGBoost ML Inference...");

    try {
      const dpf = formData.familyHistory === "Yes" ? 0.85 : 0.15;

      const payload = {
        pregnancies: formData.gender === "Female" ? 1 : 0,
        glucose: parseFloat(formData.glucose) || 120.0,
        blood_pressure: parseFloat(formData.bloodPressure) || 70.0,
        skin_thickness: parseFloat(formData.skinThickness) || 20.0,
        insulin: parseFloat(formData.insulin) || 80.0,
        bmi: parseFloat(formData.bmi) || 24.5,
        diabetes_pedigree_function: dpf,
        age: parseInt(formData.age, 10) || 30,
      };

      // 1. Submit Assessment & ML Prediction
      const response = await predictionService.createPrediction(payload);
      const resultData = response.data;

      // Store in localStorage for instant rendering
      localStorage.setItem("latest_prediction", JSON.stringify(resultData));

      toast.success("✅ AI Risk Assessment Complete!");
      setTimeout(() => {
        navigate("/result");
      }, 800);
    } catch (err) {
      toast.error(err.message || "Failed to analyze health parameters.");
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
            <span className="badge-pill">AI Health Assessment</span>
            <h1>Comprehensive Diabetes Risk Screening</h1>
            <p>Fill in your clinical markers below for AI XGBoost model risk classification.</p>
          </div>

          {/* Stepper Progress Header */}
          <div className="stepper-bar">
            <div className={`step-item ${step >= 1 ? "completed" : ""} ${step === 1 ? "active" : ""}`}>
              <div className="step-circle">{step > 1 ? <FaCheckCircle /> : "1"}</div>
              <span>Personal Profile</span>
            </div>
            <div className={`step-item ${step >= 2 ? "completed" : ""} ${step === 2 ? "active" : ""}`}>
              <div className="step-circle">{step > 2 ? <FaCheckCircle /> : "2"}</div>
              <span>Medical Vitals</span>
            </div>
            <div className={`step-item ${step >= 3 ? "completed" : ""} ${step === 3 ? "active" : ""}`}>
              <div className="step-circle">{step > 3 ? <FaCheckCircle /> : "3"}</div>
              <span>Lifestyle & Predict</span>
            </div>
          </div>

          {/* Form Card */}
          <div className="assessment-card">
            {step === 1 && (
              <div className="form-step-content">
                <h2><FaUser /> Step 1: Personal Profile</h2>
                <p className="step-subtitle">Demographics and physical metrics for BMI calculation.</p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formData.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Age (years) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 35"
                      value={formData.age}
                      onChange={(e) => handleChange("age", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Gender</label>
                    <select value={formData.gender} onChange={(e) => handleChange("gender", e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Height (cm) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 170"
                      value={formData.height}
                      onChange={(e) => handleChange("height", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Weight (kg) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 70"
                      value={formData.weight}
                      onChange={(e) => handleChange("weight", e.target.value)}
                    />
                  </div>

                  <div className="input-group bmi-auto-group">
                    <label><FaCalculator /> Auto-Calculated BMI</label>
                    <div className="bmi-display">
                      <span>{formData.bmi || "24.2"}</span> kg/m²
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="form-step-content">
                <h2><FaStethoscope /> Step 2: Clinical Vitals & Lab Measurements</h2>
                <p className="step-subtitle">Fasting blood glucose, pressure, and insulin indicators.</p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>
                      Fasting Glucose (mg/dL) *
                      <span className="tooltip-badge" title="Normal fasting level: 70 - 99 mg/dL">
                        <FaInfoCircle /> Normal: 70-99
                      </span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 115"
                      value={formData.glucose}
                      onChange={(e) => handleChange("glucose", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>
                      Diastolic Blood Pressure (mmHg) *
                      <span className="tooltip-badge" title="Normal diastolic: 60 - 80 mmHg">
                        <FaInfoCircle /> Normal: 60-80
                      </span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 75"
                      value={formData.bloodPressure}
                      onChange={(e) => handleChange("bloodPressure", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Insulin Level (μU/mL)</label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={formData.insulin}
                      onChange={(e) => handleChange("insulin", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Skin Fold Thickness (mm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 20"
                      value={formData.skinThickness}
                      onChange={(e) => handleChange("skinThickness", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Family Diabetes History</label>
                    <select value={formData.familyHistory} onChange={(e) => handleChange("familyHistory", e.target.value)}>
                      <option value="No">No Immediate Family History</option>
                      <option value="Yes">Yes (Parent / Sibling with Diabetes)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="form-step-content">
                <h2><FaRunning /> Step 3: Lifestyle & Behavioral Markers</h2>
                <p className="step-subtitle">Daily activity, sleep, and habits affecting metabolic health.</p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>Physical Exercise Level</label>
                    <select value={formData.exerciseLevel} onChange={(e) => handleChange("exerciseLevel", e.target.value)}>
                      <option value="Regular">Regular (3+ times / week)</option>
                      <option value="Moderate">Moderate (1-2 times / week)</option>
                      <option value="Sedentary">Sedentary (Little to no exercise)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Daily Sleep Hours</label>
                    <input
                      type="number"
                      placeholder="e.g. 7"
                      value={formData.sleepHours}
                      onChange={(e) => handleChange("sleepHours", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Tobacco Use</label>
                    <select value={formData.smoking} onChange={(e) => handleChange("smoking", e.target.value)}>
                      <option value="No">No / Non-Smoker</option>
                      <option value="Yes">Yes / Regular Smoker</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Alcohol Consumption</label>
                    <select value={formData.alcohol} onChange={(e) => handleChange("alcohol", e.target.value)}>
                      <option value="No">No / Rare</option>
                      <option value="Yes">Occasional / Moderate</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Footer Buttons */}
            <div className="stepper-actions">
              {step > 1 && (
                <button className="btn-step secondary" onClick={() => setStep(step - 1)}>
                  ← Back
                </button>
              )}
              {step < 3 && (
                <button className="btn-step primary" onClick={handleNextStep}>
                  Continue →
                </button>
              )}
              {step === 3 && (
                <button className="btn-step primary predict-btn" onClick={handleNextStep} disabled={loading}>
                  <FaBrain /> {loading ? "Processing AI Prediction..." : "Generate AI Diabetes Prediction →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Modal Overlay */}
      {loading && (
        <div className="ai-loading-overlay">
          <div className="loading-card">
            <FaBrain className="spinner-brain" />
            <h3>Processing XGBoost Risk Inference</h3>
            <p>Evaluating physiological markers against clinical decision boundaries...</p>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default Assessment;