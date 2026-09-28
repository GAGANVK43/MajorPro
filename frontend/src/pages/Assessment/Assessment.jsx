import "./Assessment.css";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser, FaStethoscope, FaRunning, FaCheckCircle,
  FaBrain, FaInfoCircle, FaCalculator, FaAppleAlt,
  FaMicrophone, FaMicrophoneSlash, FaFileUpload,
  FaFileAlt, FaTimesCircle, FaCheckDouble, FaVolumeUp,
  FaStopCircle, FaEdit, FaExclamationTriangle, FaRobot,
  FaKeyboard, FaCheck, FaTimes, FaShieldAlt
} from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { predictionService, smartAssessmentService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  interpretTranscript,
  validateField,
  getVoiceQuestion,
  FIELD_DEFINITIONS,
} from "./VoiceEngine";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CANONICAL ASSESSMENT SCHEMA (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────
const CANONICAL_ASSESSMENT_SCHEMA = {
  // Priority 1 — Required Model Inputs
  age: {
    key: "age",
    label: "Age",
    priority: 1,
    required: true,
    type: "number",
    min: 1, max: 110,
    unit: "years",
    step: 1,
    question: "What is your age in years?",
    placeholder: "e.g. 42",
  },
  gender: {
    key: "gender",
    label: "Gender",
    priority: 1,
    required: true,
    type: "select",
    options: ["Male", "Female"],
    step: 1,
    question: "What is your gender? Male or Female?",
    placeholder: "Male or Female",
  },
  patientGroup: {
    key: "patientGroup",
    label: "Location Type",
    priority: 1,
    required: true,
    type: "select",
    options: ["Urban", "Rural", "Semi-Urban"],
    step: 1,
    question: "Do you live in an Urban, Rural, or Semi-Urban area?",
    placeholder: "Urban / Rural / Semi-Urban",
  },
  height: {
    key: "height",
    label: "Height",
    priority: 1,
    required: true,
    type: "number",
    min: 100, max: 250,
    unit: "cm",
    step: 1,
    question: "What is your height in centimeters (or feet and inches)?",
    placeholder: "e.g. 170",
  },
  weight: {
    key: "weight",
    label: "Weight",
    priority: 1,
    required: true,
    type: "number",
    min: 20, max: 250,
    unit: "kg",
    step: 1,
    question: "What is your weight in kilograms?",
    placeholder: "e.g. 75",
  },

  // Priority 2 — High-Value Clinical Measurements
  fastingGlucose: {
    key: "fastingGlucose",
    label: "Fasting Blood Glucose",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 50, max: 450,
    unit: "mg/dL",
    step: 2,
    question: "What is your fasting blood glucose level in mg/dL?",
    placeholder: "e.g. 108 (optional)",
  },
  hba1c: {
    key: "hba1c",
    label: "HbA1c Level",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 3.0, max: 20.0,
    unit: "%",
    step: 2,
    question: "What is your HbA1c percentage?",
    placeholder: "e.g. 5.8 (optional)",
  },
  bloodPressure: {
    key: "bloodPressure",
    label: "Systolic Blood Pressure",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 60, max: 220,
    unit: "mmHg",
    step: 2,
    question: "What is your systolic blood pressure in mmHg?",
    placeholder: "e.g. 125 (optional)",
  },
  familyHistory: {
    key: "familyHistory",
    label: "Family History of Diabetes",
    priority: 2,
    required: false,
    clinical: true,
    type: "select",
    options: ["0", "1"],
    step: 2,
    question: "Do you have a family history of diabetes? Yes or No?",
    placeholder: "Yes or No",
  },

  // Priority 3 — Remaining Lifestyle Factors
  physicalActivityHours: {
    key: "physicalActivityHours",
    label: "Physical Activity",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 20,
    unit: "hours/day",
    step: 3,
    question: "How many hours per day do you spend on physical activity?",
    placeholder: "e.g. 3.0",
  },
  dailySugarIntake: {
    key: "dailySugarIntake",
    label: "Daily Sugar Intake",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 200,
    unit: "grams",
    step: 3,
    question: "How many grams of sugar do you consume daily?",
    placeholder: "e.g. 50",
  },
  fastFoodFrequency: {
    key: "fastFoodFrequency",
    label: "Fast Food Frequency",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 15,
    unit: "meals/week",
    step: 3,
    question: "How many fast food meals do you eat per week?",
    placeholder: "e.g. 2",
  },
  sleepHours: {
    key: "sleepHours",
    label: "Sleep Duration",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 2, max: 14,
    unit: "hours",
    step: 3,
    question: "How many hours do you sleep per night on average?",
    placeholder: "e.g. 7",
  },
  monthlyIncome: {
    key: "monthlyIncome",
    label: "Monthly Income",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 200000,
    unit: "₹",
    step: 2,
    question: "What is your monthly household income in rupees? (optional)",
    placeholder: "e.g. 35000",
  },
};

// Backend report extractor keys to form keys
const BACKEND_TO_FORM = {
  age: "age",
  gender: "gender",
  bmi: "bmi",
  height: "height",
  weight: "weight",
  fasting_glucose: "fastingGlucose",
  hba1c: "hba1c",
  blood_pressure: "bloodPressure",
  family_history: "familyHistory",
  physical_activity_hours: "physicalActivityHours",
  daily_sugar_intake: "dailySugarIntake",
  fast_food_frequency: "fastFoodFrequency",
  sleep_hours: "sleepHours",
  monthly_income: "monthlyIncome",
  patient_group: "patientGroup",
};

// Ordered list for sequential voice mode (Priority 1 -> 2 -> 3)
const VOICE_QUESTION_ORDER = [
  "age", "gender", "patientGroup", "height", "weight",
  "fastingGlucose", "hba1c", "bloodPressure", "familyHistory",
  "physicalActivityHours", "dailySugarIntake", "fastFoodFrequency",
  "sleepHours", "monthlyIncome",
];

function Assessment() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  // ── Unified Assessment State ───────────────────────────────────────────────
  const [formData, setFormData] = useState({
    fullName: "",
    age: "42",
    gender: "Male",
    patientGroup: "Urban",
    height: "170",
    weight: "75",
    bmi: "26.0",
    fastingGlucose: "",
    hba1c: "",
    bloodPressure: "",
    familyHistory: "0",
    physicalActivityHours: "3",
    dailySugarIntake: "50",
    fastFoodFrequency: "2",
    sleepHours: "7",
    monthlyIncome: "",
  });

  // Track field metadata: source ('manual' | 'voice' | 'medical_report') and confirmed status
  const [fieldMetadata, setFieldMetadata] = useState({});

  // ── Voice State ──────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceField, setVoiceField] = useState(null);
  const [voiceConfirmation, setVoiceConfirmation] = useState(null);

  // ── Report Upload & OCR State ────────────────────────────────────────────
  const [reportFile, setReportFile] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [editableExtracted, setEditableExtracted] = useState({});
  const [ocrQualityWarning, setOcrQualityWarning] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [resolvingConflict, setResolvingConflict] = useState(null);

  // ── Missing Data Detection State ─────────────────────────────────────────
  const [missingQA, setMissingQA] = useState(null);
  const [missingTextInput, setMissingTextInput] = useState("");
  const [missingListening, setMissingListening] = useState(false);

  // ── Validation Errors (Data Quality Gate) ─────────────────────────────────
  const [validationErrors, setValidationErrors] = useState({});

  const fileInputRef = useRef(null);

  // ── Auto-calculate BMI from height & weight ───────────────────────────────
  useEffect(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (h > 0 && w > 0) {
      const calcBmi = (w / ((h / 100) ** 2)).toFixed(1);
      setFormData((prev) => ({ ...prev, bmi: calcBmi }));
    }
  }, [formData.height, formData.weight]);

  const updateField = (field, value, source = "manual", confirmed = true) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldMetadata((prev) => ({
      ...prev,
      [field]: { source, confirmed, timestamp: Date.now() },
    }));
    // Clear validation error on change
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DATA QUALITY GATE
  // Ensures data is complete, valid, and confirmed before ML prediction
  // ─────────────────────────────────────────────────────────────────────────
  const validateDataQualityGate = () => {
    const errors = {};

    // 1. Check all required Priority 1 fields
    Object.values(CANONICAL_ASSESSMENT_SCHEMA)
      .filter((def) => def.required)
      .forEach((def) => {
        const val = formData[def.key];
        if (!val || String(val).trim() === "") {
          errors[def.key] = `${def.label} is required for screening.`;
        } else {
          const { valid, message } = validateField(def.key, val);
          if (!valid) errors[def.key] = message;
        }
      });

    // 2. Check clinical & lifestyle fields for valid ranges if provided
    Object.values(CANONICAL_ASSESSMENT_SCHEMA)
      .filter((def) => !def.required)
      .forEach((def) => {
        const val = formData[def.key];
        if (val !== "" && val !== null && val !== undefined) {
          const { valid, message } = validateField(def.key, val);
          if (!valid) errors[def.key] = message;
        }
      });

    // 3. Check for unresolved conflicts
    if (conflicts.length > 0) {
      errors["conflicts"] = "Please resolve the conflicting data values before proceeding.";
    }

    setValidationErrors(errors);
    return {
      passed: Object.keys(errors).length === 0,
      errors,
    };
  };

  // Step-level form validation
  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      const p1Errors = {};
      ["age", "gender", "patientGroup", "height", "weight"].forEach((k) => {
        const def = CANONICAL_ASSESSMENT_SCHEMA[k];
        const val = formData[k];
        if (!val || String(val).trim() === "") {
          p1Errors[k] = `${def.label} is required.`;
        } else {
          const { valid, message } = validateField(k, val);
          if (!valid) p1Errors[k] = message;
        }
      });
      if (Object.keys(p1Errors).length > 0) {
        setValidationErrors(p1Errors);
        toast.error(Object.values(p1Errors)[0]);
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
    const qualityGate = validateDataQualityGate();
    if (!qualityGate.passed) {
      const firstError = Object.values(qualityGate.errors)[0];
      toast.error(`⚠️ Data Quality Gate: ${firstError}`);
      return;
    }

    setLoading(true);
    toast.info("🧠 Analysing your health profile with ML model...");

    try {
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
        month:                   new Date().getMonth() + 1,
      };

      const response = await predictionService.createPrediction(payload);
      const resultData = response.data;

      localStorage.setItem("latest_prediction", JSON.stringify(resultData));
      toast.success("✅ Health risk screening complete!");
      setTimeout(() => navigate("/result"), 800);
    } catch (err) {
      toast.error(err.message || "Failed to analyze health information. Please verify your data.");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE 2: VOICE INPUT & OUTPUT (Production-Quality)
  // ─────────────────────────────────────────────────────────────────────────
  const handleMicField = useCallback((field) => {
    if (!isSpeechRecognitionSupported()) {
      toast.warning("Voice recognition is not supported in this browser. Please type your answer.");
      return;
    }

    if (isListening && voiceField === field) {
      stopListening();
      setIsListening(false);
      setVoiceField(null);
      return;
    }

    setVoiceField(field);
    setIsListening(true);
    setVoiceStatus("Listening… speak now");

    startListening({
      lang: language || "en",
      onStart: () => setVoiceStatus("Listening… speak clearly"),
      onResult: (transcript, confidence) => {
        setIsListening(false);
        setVoiceField(null);
        setVoiceStatus("");

        const interpreted = interpretTranscript(transcript, field);
        if (!interpreted) {
          toast.warning(`Could not understand "${transcript}". Please type the value.`);
          return;
        }

        const { valid, message } = validateField(field, interpreted.value);
        if (!valid) {
          toast.error(`${message} (Heard: "${transcript}")`);
          return;
        }

        // Show confirmation if confidence is not HIGH or needs confirmation
        if (interpreted.needsConfirmation || confidence < 0.8) {
          setVoiceConfirmation({
            field,
            heard: transcript,
            interpretedValue: interpreted.value,
            displayValue: interpreted.displayValue,
            unit: interpreted.unit,
            convertedFrom: interpreted.convertedFrom,
          });
        } else {
          updateField(field, interpreted.value, "voice", true);
          toast.success(`✅ ${CANONICAL_ASSESSMENT_SCHEMA[field]?.label}: ${interpreted.displayValue}`);
        }
      },
      onError: (msg) => {
        setIsListening(false);
        setVoiceField(null);
        setVoiceStatus("");
        toast.error(msg);
      },
      onEnd: () => {
        setIsListening(false);
        setVoiceField(null);
        setVoiceStatus("");
      },
    });
  }, [isListening, voiceField, language]);

  const confirmVoiceValue = () => {
    if (!voiceConfirmation) return;
    updateField(voiceConfirmation.field, voiceConfirmation.interpretedValue, "voice", true);
    setVoiceConfirmation(null);
    toast.success(`✅ ${CANONICAL_ASSESSMENT_SCHEMA[voiceConfirmation.field]?.label} confirmed.`);
  };

  const rejectVoiceValue = () => {
    setVoiceConfirmation(null);
    toast.info("Voice value discarded. You can speak again or type manually.");
  };

  // Full sequential voice assessment mode
  const startVoiceAssessment = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) {
      toast.warning("Voice recognition is not supported in your browser. Please type your answers.");
      return;
    }
    setVoiceMode(true);
    await runVoiceQuestion(0);
  }, []);

  const runVoiceQuestion = async (idx) => {
    if (idx >= VOICE_QUESTION_ORDER.length) {
      setVoiceMode(false);
      toast.success("🎉 Voice assessment complete! Please review your answers below.");
      return;
    }

    const field = VOICE_QUESTION_ORDER[idx];
    const def = CANONICAL_ASSESSMENT_SCHEMA[field];
    if (!def) {
      runVoiceQuestion(idx + 1);
      return;
    }

    setVoiceField(field);
    setVoiceStatus(`Asking: ${def.question}`);

    if (isSpeechSynthesisSupported()) {
      await speak(def.question, language || "en");
    }

    setIsListening(true);
    setVoiceStatus("Listening… speak now");

    startListening({
      lang: language || "en",
      onStart: () => setVoiceStatus("Listening… speak clearly"),
      onResult: (transcript) => {
        setIsListening(false);
        setVoiceField(null);

        const interpreted = interpretTranscript(transcript, field);
        if (!interpreted) {
          setVoiceStatus(`Could not understand "${transcript}". Skipping to next question.`);
          setTimeout(() => runVoiceQuestion(idx + 1), 1500);
          return;
        }

        const { valid } = validateField(field, interpreted.value);
        if (valid) {
          updateField(field, interpreted.value, "voice", true);
          setVoiceStatus(`✅ ${def.label}: ${interpreted.displayValue}`);
          setTimeout(() => runVoiceQuestion(idx + 1), 1500);
        } else {
          setVoiceStatus(`Value out of bounds. Moving to next question.`);
          setTimeout(() => runVoiceQuestion(idx + 1), 1500);
        }
      },
      onError: () => {
        setIsListening(false);
        setVoiceField(null);
        setTimeout(() => runVoiceQuestion(idx + 1), 1000);
      },
      onEnd: () => {
        setIsListening(false);
        setVoiceField(null);
      },
    });
  };

  const stopVoiceAssessment = () => {
    stopListening();
    stopSpeaking();
    setVoiceMode(false);
    setIsListening(false);
    setVoiceField(null);
    setVoiceStatus("");
    toast.info("Voice assessment stopped. You can continue typing.");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE 3: MEDICAL REPORT UPLOAD & OCR EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    const allowedExt = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();

    if (!allowed.includes(f.type) && !allowedExt.includes(ext)) {
      toast.error("Please upload a PDF, JPG, or PNG report file.");
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size (10 MB).");
      return;
    }

    setReportFile(f);
    setExtractedFields(null);
    setShowExtracted(false);
    setOcrQualityWarning(null);
    setConflicts([]);
  };

  const handleExtractReport = async () => {
    if (!reportFile) return;
    setReportLoading(true);
    setShowExtracted(false);
    setOcrQualityWarning(null);

    try {
      const fd = new FormData();
      fd.append("file", reportFile);
      const res = await smartAssessmentService.extractReport(fd);
      const data = res?.data || res;

      if (!data?.success || !data?.extracted_fields || Object.keys(data.extracted_fields).length === 0) {
        toast.warning(data?.message || "No medical values could be identified. Please enter values manually.");
        setReportLoading(false);
        return;
      }

      if (data.ocr_quality_warning) {
        setOcrQualityWarning(data.ocr_quality_warning);
      }

      // Map backend fields to canonical schema form keys
      const editable = {};
      Object.entries(data.extracted_fields).forEach(([backendKey, info]) => {
        const formKey = BACKEND_TO_FORM[backendKey];
        if (formKey && CANONICAL_ASSESSMENT_SCHEMA[formKey]) {
          editable[formKey] = {
            value: String(info.value),
            unit: info.unit || CANONICAL_ASSESSMENT_SCHEMA[formKey].unit || "",
            confidence: info.confidence || "MEDIUM",
            raw: info.raw || "",
          };
        }
      });

      setEditableExtracted(editable);
      setShowExtracted(true);
      toast.success(`📋 Extracted ${Object.keys(editable).length} health fields from your report.`);
    } catch (err) {
      toast.error("Failed to process document. Please ensure the file is not corrupted and try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleConfirmExtracted = () => {
    const newConflicts = [];
    const toApply = {};

    Object.entries(editableExtracted).forEach(([field, info]) => {
      const existing = formData[field];
      const isFilledManually = existing && fieldMetadata[field]?.source === "manual" && existing !== "";

      // Check conflict if manually entered value differs from report value
      if (isFilledManually && String(existing).trim() !== String(info.value).trim() && field !== "bmi") {
        newConflicts.push({
          field,
          manualVal: existing,
          reportVal: info.value,
          unit: info.unit,
        });
      } else {
        toApply[field] = info.value;
      }
    });

    // Apply non-conflicting values immediately
    Object.entries(toApply).forEach(([field, value]) => {
      updateField(field, value, "medical_report", true);
    });

    setConflicts(newConflicts);

    if (newConflicts.length > 0) {
      setResolvingConflict(newConflicts[0]);
    } else {
      setShowExtracted(false);
      toast.success("✅ Medical report values applied to your assessment.");
      detectMissingFields();
    }
  };

  const resolveConflict = (useReport, editedVal = null) => {
    if (!resolvingConflict) return;
    const { field, manualVal, reportVal } = resolvingConflict;

    let finalVal = manualVal;
    if (editedVal !== null) {
      finalVal = editedVal;
    } else if (useReport) {
      finalVal = reportVal;
    }

    updateField(field, finalVal, useReport ? "medical_report" : "manual", true);

    const remaining = conflicts.filter((c) => c.field !== field);
    setConflicts(remaining);

    if (remaining.length > 0) {
      setResolvingConflict(remaining[0]);
    } else {
      setResolvingConflict(null);
      setShowExtracted(false);
      toast.success("✅ All conflicts resolved and data saved.");
      detectMissingFields();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE 4: SCHEMA-BASED MISSING DATA DETECTION & SMART Q&A
  // Prioritized: Required model inputs (1) → Clinical values (2) → Lifestyle (3)
  // Never asks for information that is already provided or confirmed
  // ─────────────────────────────────────────────────────────────────────────
  const getMissingFieldsList = useCallback(() => {
    return Object.values(CANONICAL_ASSESSMENT_SCHEMA)
      .sort((a, b) => a.priority - b.priority)
      .filter((def) => {
        if (def.autoCalculated) return false;
        const val = formData[def.key];
        // Missing if null, undefined, or empty string
        return val === null || val === undefined || String(val).trim() === "";
      })
      .map((def) => def.key);
  }, [formData]);

  const detectMissingFields = useCallback(() => {
    const missing = getMissingFieldsList();
    if (missing.length > 0) {
      startMissingQA(missing, 0);
    } else {
      toast.success("✅ All health assessment fields are complete! Ready for screening.");
    }
    return missing;
  }, [getMissingFieldsList]);

  const startMissingQA = (fields, idx) => {
    if (idx >= fields.length) {
      setMissingQA(null);
      toast.success("✅ Missing information gathered. You can now run the health screening.");
      return;
    }

    const fieldKey = fields[idx];
    const def = CANONICAL_ASSESSMENT_SCHEMA[fieldKey];

    // Double-check field isn't already filled
    const currentVal = formData[fieldKey];
    if (currentVal !== "" && currentVal !== null && currentVal !== undefined) {
      startMissingQA(fields, idx + 1);
      return;
    }

    setMissingQA({ fieldKey, def, fields, idx });
    setMissingTextInput("");

    if (isSpeechSynthesisSupported()) {
      speak(`I need some more information. ${def.question}`, language || "en");
    }
  };

  const submitMissingAnswer = (value) => {
    if (!missingQA) return;
    const { fieldKey, def, fields, idx } = missingQA;

    if (!value || String(value).trim() === "") {
      if (!def.required) {
        startMissingQA(fields, idx + 1);
        return;
      }
      toast.warning(`${def.label} is required.`);
      return;
    }

    const { valid, message } = validateField(fieldKey, value);
    if (!valid) {
      toast.error(message);
      return;
    }

    updateField(fieldKey, String(value).trim(), "manual", true);
    toast.success(`✅ ${def.label} recorded.`);
    startMissingQA(fields, idx + 1);
  };

  const skipMissingField = () => {
    if (!missingQA) return;
    if (missingQA.def.required) {
      toast.warning(`${missingQA.def.label} is a required field and cannot be skipped.`);
      return;
    }
    startMissingQA(missingQA.fields, missingQA.idx + 1);
  };

  const handleMissingVoice = () => {
    if (!missingQA || !isSpeechRecognitionSupported()) {
      toast.warning("Voice recognition not available. Please type your answer.");
      return;
    }

    setMissingListening(true);
    startListening({
      lang: language || "en",
      onResult: (transcript) => {
        setMissingListening(false);
        const interpreted = interpretTranscript(transcript, missingQA.fieldKey);
        if (interpreted) {
          setMissingTextInput(interpreted.value);
        } else {
          const numMatch = transcript.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            setMissingTextInput(numMatch[1]);
          } else {
            toast.warning(`Could not understand "${transcript}". Please type the value.`);
          }
        }
      },
      onError: (msg) => {
        setMissingListening(false);
        toast.error(msg);
      },
      onEnd: () => setMissingListening(false),
    });
  };

  // Helper badge to show data source (voice, report, manual)
  const sourceBadge = (field) => {
    const meta = fieldMetadata[field];
    if (!meta) return null;
    const badges = {
      voice: { icon: "🎤", label: "Voice", cls: "src-voice" },
      medical_report: { icon: "📄", label: "Report", cls: "src-report" },
    };
    const b = badges[meta.source];
    if (!b) return null;
    return (
      <span className={`source-badge ${b.cls}`} title={`Sourced from ${b.label}`}>
        {b.icon} {b.label}
      </span>
    );
  };

  // Inline Mic Button Component
  const MicBtn = ({ field }) => (
    <button
      type="button"
      className={`mic-btn-inline ${isListening && voiceField === field ? "listening" : ""}`}
      onClick={() => handleMicField(field)}
      title={isListening && voiceField === field ? "Stop listening" : "Speak to fill this field"}
      aria-label={isListening && voiceField === field ? "Stop voice input" : "Start voice input"}
    >
      {isListening && voiceField === field ? <FaMicrophoneSlash /> : <FaMicrophone />}
    </button>
  );

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
              ⚕️ This is a <strong>health risk awareness screening</strong> tool — not a clinical diagnosis.
              Results are model-estimated statistical patterns. Always consult a healthcare professional.
            </p>
          </div>

          {/* ── SMART TOOLBAR (Features 2 & 3) ── */}
          <div className="smart-toolbar">
            {/* Voice Assessment Card */}
            <div className="smart-card voice-card">
              <div className="smart-card-icon">🎤</div>
              <div className="smart-card-body">
                <h3>Voice Assessment</h3>
                <p>Answer questions aloud using speech recognition</p>
                {voiceMode ? (
                  <div className="voice-active-state">
                    <div className="voice-status-bar">
                      {isListening && <span className="pulse-dot" />}
                      <span>{voiceStatus || "Voice mode active"}</span>
                    </div>
                    <button className="smart-btn stop-btn" onClick={stopVoiceAssessment}>
                      <FaStopCircle /> Stop Voice Mode
                    </button>
                  </div>
                ) : (
                  <button
                    className="smart-btn primary"
                    onClick={startVoiceAssessment}
                    disabled={!isSpeechRecognitionSupported()}
                  >
                    <FaMicrophone />
                    {isSpeechRecognitionSupported() ? "Start Voice Assessment" : "Browser Not Supported"}
                  </button>
                )}
              </div>
            </div>

            {/* Medical Report Upload Card */}
            <div className="smart-card report-card">
              <div className="smart-card-icon">📄</div>
              <div className="smart-card-body">
                <h3>Upload Medical Report</h3>
                <p>PDF, JPG, or PNG — In-memory OCR extracts clinical metrics</p>
                <div className="report-upload-row">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    aria-label="Upload medical report"
                  />
                  <button className="smart-btn secondary" onClick={() => fileInputRef.current?.click()}>
                    <FaFileUpload /> Choose File
                  </button>
                  {reportFile && (
                    <>
                      <span className="file-name-pill">
                        <FaFileAlt /> {reportFile.name.length > 20 ? reportFile.name.slice(0, 20) + "…" : reportFile.name}
                        <button
                          onClick={() => {
                            setReportFile(null);
                            setShowExtracted(false);
                            setOcrQualityWarning(null);
                          }}
                          aria-label="Remove file"
                        >
                          <FaTimesCircle />
                        </button>
                      </span>
                      <button
                        className="smart-btn primary"
                        onClick={handleExtractReport}
                        disabled={reportLoading}
                      >
                        {reportLoading ? "Extracting…" : "Extract Data"}
                      </button>
                    </>
                  )}
                </div>
                {reportLoading && (
                  <div className="extract-progress">
                    <span className="progress-dot" />
                    <span className="progress-dot" style={{ animationDelay: "0.2s" }} />
                    <span className="progress-dot" style={{ animationDelay: "0.4s" }} />
                    <span>Analyzing document & running OCR…</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── EXTRACTED VALUES PANEL ── */}
          {showExtracted && editableExtracted && Object.keys(editableExtracted).length > 0 && (
            <div className="extracted-panel">
              <div className="extracted-header">
                <h3><FaFileAlt /> Extracted Information From Medical Report</h3>
                <p>Review the extracted values. Low-confidence or unconfirmed items can be edited before confirming.</p>
              </div>

              {ocrQualityWarning && (
                <div className="ocr-warning-box">
                  <FaExclamationTriangle />
                  <span>{ocrQualityWarning}</span>
                </div>
              )}

              <div className="extracted-grid">
                {Object.entries(editableExtracted).map(([field, info]) => {
                  const def = CANONICAL_ASSESSMENT_SCHEMA[field];
                  return (
                    <div key={field} className={`extracted-item conf-${(info.confidence || "HIGH").toLowerCase()}`}>
                      <div className="extracted-item-label">
                        <span>{def?.label || field}</span>
                        <span className={`conf-badge conf-${(info.confidence || "HIGH").toLowerCase()}`}>
                          {info.confidence === "HIGH" ? "✓ High Confidence" : "⚠ Please Verify"}
                        </span>
                      </div>
                      <div className="extracted-input-wrapper">
                        <input
                          type="text"
                          value={info.value}
                          onChange={(e) =>
                            setEditableExtracted((prev) => ({
                              ...prev,
                              [field]: { ...prev[field], value: e.target.value },
                            }))
                          }
                          className="extracted-input"
                        />
                        {def?.unit && <span className="extracted-unit">{def.unit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="extracted-actions">
                <button className="smart-btn primary" onClick={handleConfirmExtracted}>
                  <FaCheckDouble /> Confirm & Apply to Assessment
                </button>
                <button className="smart-btn ghost" onClick={() => setShowExtracted(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── CONFLICT RESOLUTION DIALOG ── */}
          {resolvingConflict && (
            <div className="conflict-overlay">
              <div className="conflict-dialog">
                <FaExclamationTriangle className="conflict-icon" />
                <h3>Data Conflict Detected</h3>
                <p>
                  You previously entered a different value for{" "}
                  <strong>{CANONICAL_ASSESSMENT_SCHEMA[resolvingConflict.field]?.label || resolvingConflict.field}</strong>.
                  Which value would you like to use?
                </p>
                <div className="conflict-values">
                  <div className="conflict-val">
                    <span className="cval-label">Your Entered Value</span>
                    <span className="cval-num">
                      {resolvingConflict.manualVal} {resolvingConflict.unit || ""}
                    </span>
                  </div>
                  <div className="conflict-val">
                    <span className="cval-label">Medical Report Value</span>
                    <span className="cval-num">
                      {resolvingConflict.reportVal} {resolvingConflict.unit || ""}
                    </span>
                  </div>
                </div>
                <div className="conflict-actions">
                  <button className="smart-btn secondary" onClick={() => resolveConflict(false)}>
                    Keep My Value ({resolvingConflict.manualVal})
                  </button>
                  <button className="smart-btn primary" onClick={() => resolveConflict(true)}>
                    Use Report Value ({resolvingConflict.reportVal})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── VOICE CONFIRMATION DIALOG ── */}
          {voiceConfirmation && (
            <div className="voice-confirm-overlay">
              <div className="voice-confirm-dialog">
                <FaMicrophone className="vc-icon" />
                <p className="vc-heard">Heard: <em>"{voiceConfirmation.heard}"</em></p>
                <p className="vc-interpreted">
                  {CANONICAL_ASSESSMENT_SCHEMA[voiceConfirmation.field]?.label}:{" "}
                  <strong>{voiceConfirmation.displayValue}</strong>
                </p>
                {voiceConfirmation.convertedFrom && (
                  <p className="vc-converted">
                    Converted from: {voiceConfirmation.convertedFrom}
                  </p>
                )}
                <p className="vc-question">Is this accurate?</p>
                <div className="vc-actions">
                  <button className="smart-btn primary" onClick={confirmVoiceValue}>
                    <FaCheck /> Confirm
                  </button>
                  <button className="smart-btn ghost" onClick={rejectVoiceValue}>
                    <FaTimes /> Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── MISSING DATA Q&A PANEL ── */}
          {missingQA && (
            <div className="missing-data-panel">
              <div className="missing-data-header">
                <FaRobot className="missing-icon" />
                <div>
                  <h3>Missing Information Assistant</h3>
                  <p>
                    {missingQA.def.label} (Priority {missingQA.def.priority}) —{" "}
                    {missingQA.def.required ? "Required for screening" : "Helps calibrate risk model"}
                  </p>
                </div>
              </div>
              <p className="missing-question">{missingQA.def.question}</p>

              <div className="missing-answer-row">
                {isSpeechRecognitionSupported() && (
                  <button
                    className={`smart-btn ${missingListening ? "stop-btn" : "voice-btn"}`}
                    onClick={handleMissingVoice}
                    disabled={missingListening}
                  >
                    {missingListening ? <><FaMicrophoneSlash /> Listening…</> : <><FaMicrophone /> Speak Answer</>}
                  </button>
                )}
                <span className="or-divider">or</span>
                <div className="missing-input-row">
                  {missingQA.def.type === "select" ? (
                    <select
                      value={missingTextInput}
                      onChange={(e) => setMissingTextInput(e.target.value)}
                      className="missing-input"
                    >
                      <option value="">Select option…</option>
                      {missingQA.def.options?.map((o) => (
                        <option key={o} value={o}>
                          {o === "0" ? "No" : o === "1" ? "Yes" : o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      className="missing-input"
                      placeholder={missingQA.def.placeholder}
                      value={missingTextInput}
                      onChange={(e) => setMissingTextInput(e.target.value)}
                      min={missingQA.def.min}
                      max={missingQA.def.max}
                      onKeyDown={(e) => e.key === "Enter" && submitMissingAnswer(missingTextInput)}
                    />
                  )}
                  <button className="smart-btn primary" onClick={() => submitMissingAnswer(missingTextInput)}>
                    Save & Continue →
                  </button>
                  {!missingQA.def.required && (
                    <button className="smart-btn ghost" onClick={skipMissingField}>
                      Skip
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stepper Progress Bar */}
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
                <p className="step-subtitle">Your basic health profile calibrates the screening model.</p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>Full Name {sourceBadge("fullName")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Sharma"
                      value={formData.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>
                      Age (years) * {sourceBadge("age")}
                      {validationErrors.age && <span className="error-text">{validationErrors.age}</span>}
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 42"
                        min="1"
                        max="110"
                        value={formData.age}
                        onChange={(e) => updateField("age", e.target.value)}
                      />
                      <MicBtn field="age" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Gender * {sourceBadge("gender")}</label>
                    <select value={formData.gender} onChange={(e) => updateField("gender", e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Location Type * {sourceBadge("patientGroup")}</label>
                    <select value={formData.patientGroup} onChange={(e) => updateField("patientGroup", e.target.value)}>
                      <option value="Urban">Urban</option>
                      <option value="Semi-Urban">Semi-Urban</option>
                      <option value="Rural">Rural</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>
                      Height (cm) * {sourceBadge("height")}
                      {validationErrors.height && <span className="error-text">{validationErrors.height}</span>}
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 170"
                        min="100"
                        max="250"
                        value={formData.height}
                        onChange={(e) => updateField("height", e.target.value)}
                      />
                      <MicBtn field="height" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      Weight (kg) * {sourceBadge("weight")}
                      {validationErrors.weight && <span className="error-text">{validationErrors.weight}</span>}
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 75"
                        min="20"
                        max="250"
                        value={formData.weight}
                        onChange={(e) => updateField("weight", e.target.value)}
                      />
                      <MicBtn field="weight" />
                    </div>
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
                <h2><FaStethoscope /> Clinical & Laboratory Measurements</h2>
                <p className="step-subtitle">
                  Enter your blood test measurements if available. Sourced automatically from medical reports, voice, or manual entry.
                </p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>
                      Fasting Blood Glucose (mg/dL) {sourceBadge("fastingGlucose")}
                      <span className="tooltip-badge" title="Normal: < 100 mg/dL | Pre-diabetic: 100–125 | Elevated: ≥ 126">
                        <FaInfoCircle /> 70–125 normal
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 108 (optional)"
                        value={formData.fastingGlucose}
                        onChange={(e) => updateField("fastingGlucose", e.target.value)}
                      />
                      <MicBtn field="fastingGlucose" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      HbA1c (%) {sourceBadge("hba1c")}
                      <span className="tooltip-badge" title="Normal: < 5.7% | Pre-diabetic: 5.7–6.4% | Elevated: ≥ 6.5%">
                        <FaInfoCircle /> 4.0–6.4% normal
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 5.8 (optional)"
                        step="0.1"
                        value={formData.hba1c}
                        onChange={(e) => updateField("hba1c", e.target.value)}
                      />
                      <MicBtn field="hba1c" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      Systolic Blood Pressure (mmHg) {sourceBadge("bloodPressure")}
                      <span className="tooltip-badge" title="Systolic pressure. Normal: < 120 mmHg">
                        <FaInfoCircle /> systolic
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 125 (optional)"
                        value={formData.bloodPressure}
                        onChange={(e) => updateField("bloodPressure", e.target.value)}
                      />
                      <MicBtn field="bloodPressure" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Family History of Diabetes {sourceBadge("familyHistory")}</label>
                    <select
                      value={formData.familyHistory}
                      onChange={(e) => updateField("familyHistory", e.target.value)}
                    >
                      <option value="0">No — No immediate family history</option>
                      <option value="1">Yes — Parent or sibling has diabetes</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Monthly Household Income (₹) {sourceBadge("monthlyIncome")}</label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 35000 (optional)"
                        value={formData.monthlyIncome}
                        onChange={(e) => updateField("monthlyIncome", e.target.value)}
                      />
                      <MicBtn field="monthlyIncome" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Lifestyle Habits ── */}
            {step === 3 && (
              <div className="form-step-content">
                <h2><FaRunning /> Lifestyle & Daily Habits</h2>
                <p className="step-subtitle">
                  Lifestyle habits represent significant predictive patterns. Honest answers maximize screening relevance.
                </p>

                <div className="input-grid">
                  <div className="input-group">
                    <label>
                      Physical Activity (hours/day) {sourceBadge("physicalActivityHours")}
                      <span className="tooltip-badge" title="WHO recommends ≥ 150 min/week">
                        <FaInfoCircle /> WHO: 2.1+ hrs
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 3.0"
                        step="0.5"
                        min="0"
                        max="20"
                        value={formData.physicalActivityHours}
                        onChange={(e) => updateField("physicalActivityHours", e.target.value)}
                      />
                      <MicBtn field="physicalActivityHours" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      Daily Sugar Intake (grams) {sourceBadge("dailySugarIntake")}
                      <span className="tooltip-badge" title="Sugar from tea, beverages, sweets, processed foods">
                        <FaInfoCircle /> WHO: &lt;50g
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 50"
                        min="0"
                        max="200"
                        value={formData.dailySugarIntake}
                        onChange={(e) => updateField("dailySugarIntake", e.target.value)}
                      />
                      <MicBtn field="dailySugarIntake" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>
                      <FaAppleAlt /> Fast Food Frequency (meals/week) {sourceBadge("fastFoodFrequency")}
                      <span className="tooltip-badge" title="Fast food or deep-fried meals per week">
                        <FaInfoCircle /> meals/week
                      </span>
                    </label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 2"
                        min="0"
                        max="15"
                        value={formData.fastFoodFrequency}
                        onChange={(e) => updateField("fastFoodFrequency", e.target.value)}
                      />
                      <MicBtn field="fastFoodFrequency" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Sleep Duration (hours/night) {sourceBadge("sleepHours")}</label>
                    <div className="input-mic-row">
                      <input
                        type="number"
                        placeholder="e.g. 7"
                        step="0.5"
                        min="2"
                        max="14"
                        value={formData.sleepHours}
                        onChange={(e) => updateField("sleepHours", e.target.value)}
                      />
                      <MicBtn field="sleepHours" />
                    </div>
                  </div>
                </div>

                {/* AI Missing Data Check Banner */}
                <div className="missing-check-banner">
                  <FaRobot />
                  <div>
                    <strong>AI Schema-Based Completeness Check</strong>
                    <p>Detect any remaining missing fields before running the risk model.</p>
                  </div>
                  <button className="smart-btn secondary small" onClick={detectMissingFields}>
                    Check Missing Information
                  </button>
                </div>

                {/* Summary Preview */}
                <div className="summary-preview">
                  <h4>📋 Assessment Summary</h4>
                  <div className="summary-chips">
                    <span>Age: {formData.age} yrs</span>
                    <span>BMI: {formData.bmi}</span>
                    <span>Activity: {formData.physicalActivityHours} hrs/day</span>
                    <span>Sugar: {formData.dailySugarIntake}g/day</span>
                    <span>Sleep: {formData.sleepHours} hrs</span>
                    {formData.familyHistory === "1" && <span className="risk-chip">Family History Present</span>}
                    {formData.fastingGlucose && <span>Glucose: {formData.fastingGlucose} mg/dL</span>}
                    {formData.hba1c && <span>HbA1c: {formData.hba1c}%</span>}
                    {formData.bloodPressure && <span>BP: {formData.bloodPressure} mmHg</span>}
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
                  <FaBrain /> {loading ? "Evaluating..." : "Run Health Screening →"}
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
            <h3>Evaluating health profile...</h3>
            <p>Running verified DiaSense risk model v2</p>
            <small>⚕️ This is an AI screening model, not a medical diagnosis.</small>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default Assessment;