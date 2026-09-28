import "./Assessment.css";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser, FaStethoscope, FaRunning, FaCheckCircle,
  FaBrain, FaInfoCircle, FaCalculator, FaAppleAlt,
  FaMicrophone, FaMicrophoneSlash, FaFileUpload,
  FaFileAlt, FaTimesCircle, FaCheckDouble, FaVolumeUp,
  FaVolumeMute, FaStopCircle, FaEdit, FaExclamationTriangle,
  FaRobot, FaKeyboard, FaCheck, FaTimes, FaShieldAlt,
  FaArrowRight, FaArrowLeft, FaExchangeAlt, FaRedo, FaUndo
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
export const CANONICAL_ASSESSMENT_SCHEMA = {
  // Priority 1 — Personal & Physical
  age: {
    key: "age",
    label: "Age",
    group: "personal",
    priority: 1,
    required: true,
    type: "number",
    min: 1, max: 110,
    unit: "years",
    step: 1,
    question: "What is your age in years?",
    hint: "Enter your age between 1 and 110 years.",
    placeholder: "e.g. 42",
  },
  gender: {
    key: "gender",
    label: "Gender",
    group: "personal",
    priority: 1,
    required: true,
    type: "select",
    options: ["Male", "Female"],
    step: 1,
    question: "What is your gender? Male or Female?",
    hint: "Choose Male or Female.",
    placeholder: "Male or Female",
  },
  patientGroup: {
    key: "patientGroup",
    label: "Location Type",
    group: "personal",
    priority: 1,
    required: true,
    type: "select",
    options: ["Urban", "Rural", "Semi-Urban"],
    step: 1,
    question: "Do you live in an Urban, Rural, or Semi-Urban area?",
    hint: "Select your primary living environment.",
    placeholder: "Urban / Rural / Semi-Urban",
  },
  height: {
    key: "height",
    label: "Height",
    group: "personal",
    priority: 1,
    required: true,
    type: "number",
    min: 100, max: 250,
    unit: "cm",
    step: 1,
    question: "What is your height in centimeters (or feet and inches)?",
    hint: "Height in centimeters (e.g. 170) or say '5 feet 8 inches'.",
    placeholder: "e.g. 170",
  },
  weight: {
    key: "weight",
    label: "Weight",
    group: "personal",
    priority: 1,
    required: true,
    type: "number",
    min: 20, max: 250,
    unit: "kg",
    step: 1,
    question: "What is your weight in kilograms?",
    hint: "Weight in kilograms (e.g. 70) or say '154 pounds'.",
    placeholder: "e.g. 75",
  },
  bmi: {
    key: "bmi",
    label: "BMI (Body Mass Index)",
    group: "personal",
    priority: 1,
    required: true,
    type: "number",
    min: 10, max: 70,
    unit: "kg/m²",
    autoCalculated: true,
    step: 1,
    question: "What is your Body Mass Index (BMI)?",
    hint: "Automatically calculated from height and weight.",
    placeholder: "Auto-calculated",
  },

  // Priority 2 — Clinical Measurements
  bloodPressure: {
    key: "bloodPressure",
    label: "Systolic Blood Pressure",
    group: "clinical",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 60, max: 220,
    unit: "mmHg",
    step: 2,
    question: "What is your systolic blood pressure in mmHg?",
    hint: "Systolic value (e.g. 120 from 120/80 mmHg).",
    placeholder: "e.g. 120 (optional)",
  },
  hba1c: {
    key: "hba1c",
    label: "HbA1c Level",
    group: "clinical",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 3.0, max: 20.0,
    unit: "%",
    step: 2,
    question: "What is your HbA1c percentage from your lab report?",
    hint: "Glycated hemoglobin (normal: < 5.7%, prediabetes: 5.7–6.4%).",
    placeholder: "e.g. 5.8 (optional)",
  },
  fastingGlucose: {
    key: "fastingGlucose",
    label: "Fasting Blood Glucose",
    group: "clinical",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 50, max: 450,
    unit: "mg/dL",
    step: 2,
    question: "What is your fasting blood glucose level in mg/dL?",
    hint: "Measured after 8+ hours fast (normal: 70–99 mg/dL).",
    placeholder: "e.g. 108 (optional)",
  },
  monthlyIncome: {
    key: "monthlyIncome",
    label: "Monthly Income",
    group: "clinical",
    priority: 2,
    required: false,
    clinical: true,
    type: "number",
    min: 0, max: 200000,
    unit: "₹",
    step: 2,
    question: "What is your monthly household income in rupees?",
    hint: "Demographic risk calibration factor.",
    placeholder: "e.g. 35000 (optional)",
  },

  // Priority 3 — Lifestyle & Habits
  familyHistory: {
    key: "familyHistory",
    label: "Family History of Diabetes",
    group: "lifestyle",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "select",
    options: ["0", "1"],
    step: 3,
    question: "Does anyone in your immediate family have diabetes?",
    hint: "Parent, sibling, or child with diagnosed diabetes.",
    placeholder: "Yes or No",
  },
  physicalActivityHours: {
    key: "physicalActivityHours",
    label: "Physical Activity",
    group: "lifestyle",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 20,
    unit: "hours/day",
    step: 3,
    question: "How many hours per day do you spend on physical activity?",
    hint: "Walking, jogging, sports, or physical work.",
    placeholder: "e.g. 1.5",
  },
  dailySugarIntake: {
    key: "dailySugarIntake",
    label: "Daily Sugar Intake",
    group: "lifestyle",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 200,
    unit: "grams/day",
    step: 3,
    question: "Approximately how many grams of sugar do you consume daily?",
    hint: "Sugar from tea, sweets, soda, snacks (WHO suggests < 50g).",
    placeholder: "e.g. 45",
  },
  fastFoodFrequency: {
    key: "fastFoodFrequency",
    label: "Fast Food Frequency",
    group: "lifestyle",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 0, max: 15,
    unit: "meals/week",
    step: 3,
    question: "How many fast food or processed meals do you eat per week?",
    hint: "Fried foods, restaurant takeout, instant snacks.",
    placeholder: "e.g. 2",
  },
  sleepHours: {
    key: "sleepHours",
    label: "Sleep Duration",
    group: "lifestyle",
    priority: 3,
    required: false,
    lifestyle: true,
    type: "number",
    min: 2, max: 14,
    unit: "hours/night",
    step: 3,
    question: "How many hours do you sleep per night on average?",
    hint: "Typical restorative sleep duration.",
    placeholder: "e.g. 7",
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

// Sequential Question Order for Voice Mode
const VOICE_QUESTION_KEYS = [
  "age", "gender", "patientGroup", "height", "weight",
  "bloodPressure", "hba1c", "fastingGlucose", "monthlyIncome",
  "familyHistory", "physicalActivityHours", "dailySugarIntake", "fastFoodFrequency", "sleepHours"
];

// Sequential Question Order for Manual One-Question-at-a-Time Mode
const MANUAL_QUESTION_KEYS = [
  "age", "gender", "patientGroup", "height", "weight",
  "familyHistory", "physicalActivityHours", "dailySugarIntake", "fastFoodFrequency", "sleepHours",
  "bloodPressure", "hba1c", "fastingGlucose", "monthlyIncome",
];


function Assessment() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  // ── Mode Selection State ──────────────────────────────────────────────────
  // null = Landing (Mode Selection), 'voice' = Voice Mode, 'report' = Report Mode, 'manual' = Manual Mode, 'review' = Final Review
  const [assessmentMode, setAssessmentMode] = useState(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState(null);

  // ── Manual Step State (1: Personal, 2: Clinical, 3: Lifestyle) ────────────
  const [manualStep, setManualStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Unified Assessment State (Canonical Single Source of Truth) ────────────
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "Male",
    patientGroup: "Urban",
    height: "",
    weight: "",
    bmi: "",
    fastingGlucose: "",
    hba1c: "",
    bloodPressure: "",
    familyHistory: "0",
    physicalActivityHours: "",
    dailySugarIntake: "",
    fastFoodFrequency: "",
    sleepHours: "",
    monthlyIncome: "",
  });

  // Track field metadata: source ('manual' | 'voice' | 'report') and confidence ('HIGH' | 'MEDIUM' | 'LOW')
  const [fieldMetadata, setFieldMetadata] = useState({});

  // ── Voice Mode State ──────────────────────────────────────────────────────
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceInterpreted, setVoiceInterpreted] = useState(null);
  const [voiceConfirmation, setVoiceConfirmation] = useState(null);
  // Separate Voice Input (speech recognition) and Voice Output (TTS) toggles
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  // Keep voiceAudioEnabled for backward compat — derived from output
  const voiceAudioEnabled = voiceOutputEnabled;
  const [voiceTextInput, setVoiceTextInput] = useState("");

  // ── Manual One-Question-at-a-Time State ───────────────────────────────────
  const [manualQuestionIndex, setManualQuestionIndex] = useState(0);
  const [manualTextInput, setManualTextInput] = useState("");


  // ── Report Mode State ─────────────────────────────────────────────────────
  const [reportStep, setReportStep] = useState("upload"); // 'upload' | 'review_extracted' | 'missing_qa'
  const [reportFile, setReportFile] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [editableExtracted, setEditableExtracted] = useState({});
  const [ocrQualityWarning, setOcrQualityWarning] = useState(null);
  const [reportError, setReportError] = useState(null);

  // ── Conflicts State ───────────────────────────────────────────────────────
  const [conflicts, setConflicts] = useState([]);
  const [resolvingConflict, setResolvingConflict] = useState(null);

  // ── Missing Data QA State (Shared by Report & Manual) ─────────────────────
  const [missingQueue, setMissingQueue] = useState([]);
  const [missingIndex, setMissingIndex] = useState(0);
  const [missingInput, setMissingInput] = useState("");
  const [missingListening, setMissingListening] = useState(false);

  // ── Validation Errors ─────────────────────────────────────────────────────
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

  // Unified State Updater with Source Tracking
  const updateField = useCallback((field, value, source = "manual", confidence = "HIGH") => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldMetadata((prev) => ({
      ...prev,
      [field]: { source, confidence, timestamp: Date.now() },
    }));
    // Clear validation error on change
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED MISSING-DATA ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  const getMissingFields = useCallback(() => {
    return Object.values(CANONICAL_ASSESSMENT_SCHEMA)
      .sort((a, b) => a.priority - b.priority)
      .filter((def) => {
        if (def.autoCalculated) return false;
        const val = formData[def.key];
        return val === null || val === undefined || String(val).trim() === "";
      })
      .map((def) => def.key);
  }, [formData]);

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED VALIDATION ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  const validateAssessment = useCallback(() => {
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

    // 2. Validate optional clinical & lifestyle fields if provided
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
      errors["conflicts"] = "Please resolve conflicting values before proceeding.";
    }

    setValidationErrors(errors);
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [formData, conflicts]);

  // ─────────────────────────────────────────────────────────────────────────
  // PREDICTION PIPELINE (Single Shared ML Endpoint)
  // ─────────────────────────────────────────────────────────────────────────
  const handleConfirmAndAnalyze = async () => {
    const validation = validateAssessment();
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(`⚠️ Please check: ${firstError}`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        patient_group:           formData.patientGroup || "Urban",
        age:                     formData.age ? parseInt(formData.age, 10) : null,
        gender:                  formData.gender || "Male",
        bmi:                     formData.bmi ? parseFloat(formData.bmi) : null,
        blood_pressure:          formData.bloodPressure ? parseFloat(formData.bloodPressure) : 120.0,
        physical_activity_hours: formData.physicalActivityHours ? parseFloat(formData.physicalActivityHours) : 2.0,
        daily_sugar_intake:      formData.dailySugarIntake ? parseFloat(formData.dailySugarIntake) : 30.0,
        fast_food_frequency:     formData.fastFoodFrequency ? parseFloat(formData.fastFoodFrequency) : 2.0,
        sleep_hours:             formData.sleepHours ? parseFloat(formData.sleepHours) : 7.0,
        hba1c:                   formData.hba1c ? parseFloat(formData.hba1c) : 5.7,
        fasting_glucose:         formData.fastingGlucose ? parseFloat(formData.fastingGlucose) : null,
        family_history:          parseFloat(formData.familyHistory) || 0.0,
        monthly_income:          formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : 35000.0,
        month:                   new Date().getMonth() + 1,
      };

      const response = await predictionService.createPrediction(payload);
      const resultData = response.data;

      localStorage.setItem("latest_prediction", JSON.stringify(resultData));
      toast.success("✅ Health risk screening complete!");
      setTimeout(() => navigate("/result"), 600);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Something went wrong while processing your assessment.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODE SWITCHING / NAVIGATION SAFETY
  // ─────────────────────────────────────────────────────────────────────────
  const requestModeSwitch = (targetMode) => {
    // Check if any non-default data has been entered
    const hasData = Object.keys(formData).some((k) => {
      if (k === "gender" && formData[k] === "Male") return false;
      if (k === "patientGroup" && formData[k] === "Urban") return false;
      if (k === "familyHistory" && formData[k] === "0") return false;
      return formData[k] && String(formData[k]).trim() !== "";
    });

    if (hasData && assessmentMode !== null && assessmentMode !== targetMode) {
      setPendingModeSwitch(targetMode);
      setShowSwitchModal(true);
    } else {
      applyModeSwitch(targetMode, false);
    }
  };

  const applyModeSwitch = (targetMode, keepData = true) => {
    setShowSwitchModal(false);
    setPendingModeSwitch(null);
    stopListening();
    stopSpeaking();
    setIsListening(false);

    if (!keepData) {
      setFormData({
        fullName: "",
        age: "",
        gender: "Male",
        patientGroup: "Urban",
        height: "",
        weight: "",
        bmi: "",
        fastingGlucose: "",
        hba1c: "",
        bloodPressure: "",
        familyHistory: "0",
        physicalActivityHours: "",
        dailySugarIntake: "",
        fastFoodFrequency: "",
        sleepHours: "",
        monthlyIncome: "",
      });
      setFieldMetadata({});
      setConflicts([]);
      setReportFile(null);
      setEditableExtracted({});
    }

    setAssessmentMode(targetMode);

    if (targetMode === "voice") {
      setVoiceIndex(0);
      setVoiceConfirmation(null);
      setVoiceTextInput("");
    } else if (targetMode === "report") {
      setReportStep("upload");
    } else if (targetMode === "manual") {
      setManualStep(1);
      setManualQuestionIndex(0);
      setManualTextInput("");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION 1: VOICE ASSESSMENT WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  const activeVoiceFieldKey = VOICE_QUESTION_KEYS[voiceIndex];
  const activeVoiceDef = CANONICAL_ASSESSMENT_SCHEMA[activeVoiceFieldKey];

  // Speak voice question whenever voiceIndex changes (if enabled)
  useEffect(() => {
    if (assessmentMode === "voice" && activeVoiceDef) {
      setVoiceTextInput(formData[activeVoiceFieldKey] || "");
      setVoiceTranscript("");
      setVoiceInterpreted(null);
      setVoiceConfirmation(null);
      setVoiceStatus("");

      if (voiceAudioEnabled && isSpeechSynthesisSupported()) {
        speak(activeVoiceDef.question, language || "en");
      }
    }
  }, [assessmentMode, voiceIndex, voiceAudioEnabled, activeVoiceFieldKey, language]);

  const handleStartVoiceListening = () => {
    if (!isSpeechRecognitionSupported()) {
      toast.warning("Speech recognition is not available in your browser. Please type your answer.");
      return;
    }

    stopSpeaking();
    setIsListening(true);
    setVoiceStatus("Listening… speak now");

    startListening({
      lang: language || "en",
      onStart: () => setVoiceStatus("Listening… speak clearly"),
      onResult: (transcript, confidence) => {
        setIsListening(false);
        setVoiceStatus("");
        setVoiceTranscript(transcript);

        const interpreted = interpretTranscript(transcript, activeVoiceFieldKey);
        if (!interpreted) {
          toast.warning(`Could not interpret "${transcript}". Please try again or type below.`);
          return;
        }

        const { valid, message } = validateField(activeVoiceFieldKey, interpreted.value);
        if (!valid) {
          toast.error(`${message} (Heard: "${transcript}")`);
          return;
        }

        setVoiceInterpreted(interpreted);

        // Always show clear confirmation for reliability
        setVoiceConfirmation({
          field: activeVoiceFieldKey,
          heard: transcript,
          interpretedValue: interpreted.value,
          displayValue: interpreted.displayValue,
          unit: interpreted.unit,
        });

        if (voiceAudioEnabled && isSpeechSynthesisSupported()) {
          speak(`Got it. Your ${activeVoiceDef.label} is ${interpreted.displayValue}. Is that correct?`, language || "en");
        }
      },
      onError: (err) => {
        setIsListening(false);
        setVoiceStatus("");
        toast.error(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const confirmVoiceAnswer = () => {
    if (!voiceConfirmation) return;
    updateField(voiceConfirmation.field, voiceConfirmation.interpretedValue, "voice", "HIGH");
    toast.success(`✅ ${activeVoiceDef.label} saved.`);
    setVoiceConfirmation(null);
    setVoiceInterpreted(null);
    setVoiceTranscript("");
    advanceVoiceQuestion();
  };

  const rejectVoiceAnswer = () => {
    setVoiceConfirmation(null);
    setVoiceInterpreted(null);
    setVoiceTranscript("");
    setVoiceStatus("");
    toast.info("Value discarded. You can speak again or type manually.");
  };

  const handleManualVoiceSubmit = () => {
    if (!voiceTextInput || String(voiceTextInput).trim() === "") {
      if (activeVoiceDef.required) {
        toast.warning(`${activeVoiceDef.label} is required.`);
        return;
      }
      advanceVoiceQuestion();
      return;
    }

    const { valid, message } = validateField(activeVoiceFieldKey, voiceTextInput);
    if (!valid) {
      toast.error(message);
      return;
    }

    updateField(activeVoiceFieldKey, String(voiceTextInput).trim(), "manual", "HIGH");
    toast.success(`✅ ${activeVoiceDef.label} saved.`);
    advanceVoiceQuestion();
  };

  const advanceVoiceQuestion = () => {
    if (voiceIndex + 1 < VOICE_QUESTION_KEYS.length) {
      setVoiceIndex((prev) => prev + 1);
    } else {
      stopSpeaking();
      stopListening();
      toast.success("🎉 Voice assessment complete! Reviewing your data.");
      setAssessmentMode("review");
    }
  };

  const prevVoiceQuestion = () => {
    if (voiceIndex > 0) {
      setVoiceIndex((prev) => prev - 1);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION 2: MEDICAL REPORT EXTRACTION WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  const handleReportFileSelect = (e) => {
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
    setReportError(null);
    setOcrQualityWarning(null);
  };

  const handleExtractMedicalReport = async () => {
    if (!reportFile) return;
    setReportLoading(true);
    setReportError(null);
    setOcrQualityWarning(null);

    try {
      const fd = new FormData();
      fd.append("file", reportFile);
      const res = await smartAssessmentService.extractReport(fd);
      const data = res?.data?.data || res?.data || res;

      if (!data?.success || !data?.extracted_fields || Object.keys(data.extracted_fields).length === 0) {
        setReportError("Unable to identify clear clinical metrics from this document. Please try a higher quality report or enter your values manually.");
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

      if (Object.keys(editable).length === 0) {
        setReportError("No standard diabetic parameters could be extracted. Please enter manually.");
        setReportLoading(false);
        return;
      }

      setEditableExtracted(editable);
      setReportStep("review_extracted");
      toast.success(`📋 Extracted ${Object.keys(editable).length} health fields from your report.`);
    } catch (err) {
      setReportError("Something went wrong while processing your document. Please verify the file is not corrupted.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleApplyExtractedValues = () => {
    const newConflicts = [];
    const toApply = {};

    Object.entries(editableExtracted).forEach(([field, info]) => {
      const existing = formData[field];
      const hasPriorEntry = existing && existing !== "" && existing !== null;

      // Check conflict if previously entered value differs from report value
      if (hasPriorEntry && String(existing).trim() !== String(info.value).trim() && field !== "bmi") {
        newConflicts.push({
          field,
          manualVal: existing,
          reportVal: info.value,
          unit: info.unit,
        });
      } else {
        toApply[field] = { value: info.value, confidence: info.confidence };
      }
    });

    // Apply non-conflicting values to unified state
    Object.entries(toApply).forEach(([field, data]) => {
      updateField(field, data.value, "report", data.confidence);
    });

    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      setResolvingConflict(newConflicts[0]);
    } else {
      checkReportMissingFields();
    }
  };

  const resolveConflict = (useReport) => {
    if (!resolvingConflict) return;
    const { field, manualVal, reportVal } = resolvingConflict;

    const chosenVal = useReport ? reportVal : manualVal;
    const chosenSrc = useReport ? "report" : "manual";

    updateField(field, chosenVal, chosenSrc, "HIGH");

    const remaining = conflicts.filter((c) => c.field !== field);
    setConflicts(remaining);

    if (remaining.length > 0) {
      setResolvingConflict(remaining[0]);
    } else {
      setResolvingConflict(null);
      toast.success("✅ All conflicts resolved.");
      checkReportMissingFields();
    }
  };

  const checkReportMissingFields = () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      setMissingQueue(missing);
      setMissingIndex(0);
      setMissingInput("");
      setReportStep("missing_qa");
      toast.info(`ℹ️ Please provide ${missing.length} additional detail${missing.length > 1 ? "s" : ""} to complete your assessment.`);
    } else {
      toast.success("✅ All information is complete!");
      setAssessmentMode("review");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUIDED MISSING DATA COMPLETION (Report & Manual)
  // ─────────────────────────────────────────────────────────────────────────
  const activeMissingKey = missingQueue[missingIndex];
  const activeMissingDef = CANONICAL_ASSESSMENT_SCHEMA[activeMissingKey];

  const handleMissingVoiceInput = () => {
    if (!isSpeechRecognitionSupported()) {
      toast.warning("Voice recognition is not available in your browser.");
      return;
    }

    setMissingListening(true);
    startListening({
      lang: language || "en",
      onResult: (transcript) => {
        setMissingListening(false);
        const interpreted = interpretTranscript(transcript, activeMissingKey);
        if (interpreted) {
          setMissingInput(interpreted.value);
        } else {
          const numMatch = transcript.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            setMissingInput(numMatch[1]);
          } else {
            toast.warning(`Could not interpret "${transcript}". Please type your answer.`);
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

  const handleSaveMissingAnswer = (source = "manual") => {
    if (!activeMissingDef) return;

    if (!missingInput || String(missingInput).trim() === "") {
      if (activeMissingDef.required) {
        toast.warning(`${activeMissingDef.label} is required.`);
        return;
      }
      advanceMissingQueue();
      return;
    }

    const { valid, message } = validateField(activeMissingKey, missingInput);
    if (!valid) {
      toast.error(message);
      return;
    }

    updateField(activeMissingKey, String(missingInput).trim(), source, "HIGH");
    toast.success(`✅ ${activeMissingDef.label} recorded.`);
    advanceMissingQueue();
  };

  const advanceMissingQueue = () => {
    if (missingIndex + 1 < missingQueue.length) {
      setMissingIndex((prev) => prev + 1);
      setMissingInput("");
    } else {
      toast.success("✅ All required health information gathered!");
      setAssessmentMode("review");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION 3: MANUAL ASSESSMENT STEPPING & VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  const validateManualStep = (stepNumber) => {
    const errors = {};
    if (stepNumber === 1) {
      ["age", "gender", "patientGroup", "height", "weight"].forEach((k) => {
        const val = formData[k];
        if (!val || String(val).trim() === "") {
          errors[k] = `${CANONICAL_ASSESSMENT_SCHEMA[k].label} is required.`;
        } else {
          const { valid, message } = validateField(k, val);
          if (!valid) errors[k] = message;
        }
      });
    } else if (stepNumber === 2) {
      // Validate optional clinical entries if filled
      ["bloodPressure", "hba1c", "fastingGlucose", "monthlyIncome"].forEach((k) => {
        const val = formData[k];
        if (val !== "" && val !== null && val !== undefined) {
          const { valid, message } = validateField(k, val);
          if (!valid) errors[k] = message;
        }
      });
    } else if (stepNumber === 3) {
      ["physicalActivityHours", "dailySugarIntake", "fastFoodFrequency", "sleepHours"].forEach((k) => {
        const val = formData[k];
        if (val !== "" && val !== null && val !== undefined) {
          const { valid, message } = validateField(k, val);
          if (!valid) errors[k] = message;
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error(Object.values(errors)[0]);
      return false;
    }
    return true;
  };

  const handleManualNext = () => {
    if (validateManualStep(manualStep)) {
      if (manualStep === 3) {
        setAssessmentMode("review");
      } else {
        setManualStep((prev) => prev + 1);
      }
    }
  };

  // Inline Mic Button for manual fields
  const handleInlineMic = (field) => {
    if (!isSpeechRecognitionSupported()) {
      toast.warning("Voice recognition is not supported in this browser. Please type your answer.");
      return;
    }

    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    toast.info(`🎙️ Listening for ${CANONICAL_ASSESSMENT_SCHEMA[field]?.label}…`);

    startListening({
      lang: language || "en",
      onResult: (transcript) => {
        setIsListening(false);
        const interpreted = interpretTranscript(transcript, field);
        if (interpreted) {
          const { valid, message } = validateField(field, interpreted.value);
          if (valid) {
            updateField(field, interpreted.value, "voice", "HIGH");
            toast.success(`✅ ${CANONICAL_ASSESSMENT_SCHEMA[field]?.label}: ${interpreted.displayValue}`);
          } else {
            toast.error(message);
          }
        } else {
          toast.warning(`Could not understand "${transcript}". Please type the value.`);
        }
      },
      onError: (msg) => {
        setIsListening(false);
        toast.error(msg);
      },
      onEnd: () => setIsListening(false),
    });
  };

  const MicBtn = ({ field }) => (
    <button
      type="button"
      className="mic-btn-inline"
      onClick={() => handleInlineMic(field)}
      title="Speak to fill this field"
      aria-label="Start voice input"
    >
      <FaMicrophone />
    </button>
  );

  // Helper badge to show data source (voice, report, manual)
  const sourceBadge = (field) => {
    const meta = fieldMetadata[field];
    if (!meta || !meta.source) return null;
    const badges = {
      voice: { icon: "🎙️", label: "Voice", cls: "src-voice" },
      report: { icon: "📄", label: "Report", cls: "src-report" },
      manual: { icon: "✍️", label: "Manual", cls: "src-manual" },
    };
    const b = badges[meta.source] || badges.manual;
    return (
      <span className={`source-badge ${b.cls}`} title={`Sourced from ${b.label}`}>
        {b.icon} {b.label}
      </span>
    );
  };

  // Data sources breakdown counts for review screen
  const sourceStats = useMemo(() => {
    let reportCount = 0;
    let voiceCount = 0;
    let manualCount = 0;

    Object.keys(CANONICAL_ASSESSMENT_SCHEMA).forEach((key) => {
      const val = formData[key];
      if (val !== "" && val !== null && val !== undefined) {
        const src = fieldMetadata[key]?.source || "manual";
        if (src === "report") reportCount++;
        else if (src === "voice") voiceCount++;
        else manualCount++;
      }
    });

    return { reportCount, voiceCount, manualCount };
  }, [formData, fieldMetadata]);

  return (
    <>
      <Navbar />
      <div className="assessment-page">
        <div className="assessment-container">
          <BackButton />

          {/* Page Top Header */}
          <div className="assessment-header text-center">
            <span className="badge-pill">🩺 AI Diabetes Health Screening</span>
            <h1>{t("assessment.headerTitle") || "Health Risk Screening"}</h1>
            <p className="assessment-disclaimer">
              ⚕️ This is an <strong>AI-assisted health risk screening</strong> tool — not a clinical diagnosis.
              Results are statistical risk patterns based on medical datasets. Always consult a licensed healthcare professional.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              MODE SELECTION LANDING SCREEN (Step 0)
              ══════════════════════════════════════════════════════════════════ */}
          {assessmentMode === null && (
            <div className="mode-selection-landing">
              <div className="landing-banner">
                <h2>Choose how you want to complete your assessment</h2>
                <p>
                  Select one of the three options below. You can provide your health details naturally
                  by voice, upload your existing medical report, or enter your information step by step.
                </p>
              </div>

              <div className="mode-cards-grid">
                {/* 1. Voice Assessment Card */}
                <div className="mode-card voice-card">
                  <div className="mode-card-icon-wrapper">
                    <span className="mode-card-icon">🎙️</span>
                  </div>
                  <h3>Voice Assessment</h3>
                  <p className="mode-card-desc">
                    Speak your answers naturally and let DiaSense AI guide you through the assessment question by question.
                  </p>
                  <ul className="mode-features-list">
                    <li>✓ Interactive spoken guidance</li>
                    <li>✓ Speech recognition with confirmation</li>
                    <li>✓ Automatic unit conversion & text fallback</li>
                  </ul>
                  <button
                    className="mode-card-btn primary"
                    onClick={() => applyModeSwitch("voice", true)}
                  >
                    Start Voice Assessment →
                  </button>
                  <span className="mode-card-meta">Recommended for quick spoken screening</span>
                </div>

                {/* 2. Medical Report Extraction Card */}
                <div className="mode-card report-card">
                  <div className="mode-card-icon-wrapper">
                    <span className="mode-card-icon">📄</span>
                  </div>
                  <h3>Medical Report Extraction</h3>
                  <p className="mode-card-desc">
                    Upload a lab report or health checkup PDF/image. DiaSense AI automatically extracts available clinical values.
                  </p>
                  <ul className="mode-features-list">
                    <li>✓ PDF, JPG, and PNG document support</li>
                    <li>✓ Editable extracted clinical markers</li>
                    <li>✓ Interactive missing data completion</li>
                  </ul>
                  <button
                    className="mode-card-btn secondary"
                    onClick={() => applyModeSwitch("report", true)}
                  >
                    Upload Medical Report →
                  </button>
                  <span className="mode-card-meta">Best if you have a recent blood test or lab report</span>
                </div>

                {/* 3. Manual Assessment Card */}
                <div className="mode-card manual-card">
                  <div className="mode-card-icon-wrapper">
                    <span className="mode-card-icon">✍️</span>
                  </div>
                  <h3>Manual Assessment</h3>
                  <p className="mode-card-desc">
                    Enter your health details yourself step by step across personal, clinical, and lifestyle factors.
                  </p>
                  <ul className="mode-features-list">
                    <li>✓ 3-step structured form</li>
                    <li>✓ Automatic BMI calculation</li>
                    <li>✓ Inline microphone assist on all fields</li>
                  </ul>
                  <button
                    className="mode-card-btn tertiary"
                    onClick={() => applyModeSwitch("manual", true)}
                  >
                    Start Manual Assessment →
                  </button>
                  <span className="mode-card-meta">Standard step-by-step entry</span>
                </div>
              </div>

              {/* Data Safety Strip */}
              <div className="privacy-strip">
                <FaShieldAlt />
                <span>
                  <strong>Private & Secure:</strong> All reports and voice data are processed securely in memory
                  and are never shared with unauthorized third parties.
                </span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              OPTION 1: DEDICATED VOICE ASSESSMENT WORKFLOW
              ══════════════════════════════════════════════════════════════════ */}
          {assessmentMode === "voice" && (
            <div className="workflow-container voice-workflow">
              {/* Voice Progress Header */}
              <div className="workflow-top-bar">
                <div className="workflow-title-wrap">
                  <span className="workflow-badge">🎙️ Voice Mode</span>
                  <h2>Question {voiceIndex + 1} of {VOICE_QUESTION_KEYS.length}</h2>
                </div>
                <button
                  className="switch-mode-btn"
                  onClick={() => requestModeSwitch(null)}
                  title="Switch to another assessment method"
                >
                  <FaExchangeAlt /> Change Method
                </button>
              </div>

              {/* Voice Progress Bar */}
              <div className="voice-progress-track">
                <div
                  className="voice-progress-fill"
                  style={{ width: `${((voiceIndex + 1) / VOICE_QUESTION_KEYS.length) * 100}%` }}
                />
              </div>

              {/* Active Voice Question Card */}
              <div className="voice-hero-card">
                <div className="voice-card-category">
                  {activeVoiceDef?.group === "personal" && "Personal & Physical Profile"}
                  {activeVoiceDef?.group === "clinical" && "Clinical & Laboratory Values"}
                  {activeVoiceDef?.group === "lifestyle" && "Lifestyle & Daily Habits"}
                </div>

                <h3 className="voice-question-text">{activeVoiceDef?.question}</h3>
                <p className="voice-question-hint">{activeVoiceDef?.hint}</p>

                {/* Voice Action Controls */}
                <div className="voice-actions-toolbar">
                  {/* Speech Recognition Toggle */}
                  <button
                    type="button"
                    className={`voice-action-btn listen-toggle ${isListening ? "active-listening" : ""}`}
                    onClick={isListening ? () => { stopListening(); setIsListening(false); } : handleStartVoiceListening}
                    disabled={!voiceInputEnabled}
                    title={voiceInputEnabled ? "Start / Stop voice listening" : "Voice input is disabled"}
                  >
                    {isListening ? (
                      <>
                        <span className="pulse-indicator" />
                        <FaStopCircle /> Stop Listening
                      </>
                    ) : (
                      <>
                        <FaMicrophone /> Speak Answer
                      </>
                    )}
                  </button>

                  {/* Text-To-Speech Repeat */}
                  <button
                    type="button"
                    className="voice-action-btn repeat-btn"
                    onClick={() => voiceOutputEnabled && speak(activeVoiceDef?.question, language || "en")}
                    disabled={!voiceOutputEnabled}
                    title={voiceOutputEnabled ? "Repeat question aloud" : "Voice output is disabled"}
                  >
                    <FaVolumeUp /> Repeat
                  </button>

                  {/* Voice INPUT Toggle (Speech Recognition) */}
                  <button
                    type="button"
                    className={`voice-action-btn ${voiceInputEnabled ? "active-toggle" : "mute-btn"}`}
                    onClick={() => {
                      if (voiceInputEnabled && isListening) { stopListening(); setIsListening(false); }
                      setVoiceInputEnabled(!voiceInputEnabled);
                    }}
                    title={voiceInputEnabled ? "Disable voice input (microphone)" : "Enable voice input (microphone)"}
                  >
                    {voiceInputEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
                    {voiceInputEnabled ? "Mic ON" : "Mic OFF"}
                  </button>

                  {/* Voice OUTPUT Toggle (Text-To-Speech) */}
                  <button
                    type="button"
                    className={`voice-action-btn ${voiceOutputEnabled ? "active-toggle" : "mute-btn"}`}
                    onClick={() => {
                      if (!voiceOutputEnabled) { /* turning on — do nothing special */ }
                      else stopSpeaking();
                      setVoiceOutputEnabled(!voiceOutputEnabled);
                    }}
                    title={voiceOutputEnabled ? "Disable audio guidance (TTS)" : "Enable audio guidance (TTS)"}
                  >
                    {voiceOutputEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
                    {voiceOutputEnabled ? "Speaker ON" : "Speaker OFF"}
                  </button>
                </div>


                {/* Live Listening Status */}
                {voiceStatus && (
                  <div className="voice-live-status">
                    <span className="pulse-dot" />
                    <span>{voiceStatus}</span>
                  </div>
                )}

                {/* Voice Confirmation Card */}
                {voiceConfirmation && (
                  <div className="voice-inline-confirmation">
                    <div className="vc-heard-row">
                      <span>Heard:</span> <em>"{voiceConfirmation.heard}"</em>
                    </div>
                    <div className="vc-interpreted-row">
                      <span>Interpreted:</span>
                      <strong>
                        {activeVoiceDef.label}: {voiceConfirmation.displayValue}
                      </strong>
                    </div>
                    <p className="vc-prompt">Is this correct?</p>
                    <div className="vc-buttons">
                      <button className="smart-btn primary" onClick={confirmVoiceAnswer}>
                        <FaCheck /> Yes, That's Correct
                      </button>
                      <button className="smart-btn ghost" onClick={rejectVoiceAnswer}>
                        <FaTimes /> Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* Text Fallback Box */}
                <div className="voice-fallback-box">
                  <div className="fallback-divider">
                    <span>or type your answer</span>
                  </div>

                  <div className="fallback-input-row">
                    {activeVoiceDef?.type === "select" ? (
                      <select
                        value={voiceTextInput}
                        onChange={(e) => setVoiceTextInput(e.target.value)}
                        className="fallback-select"
                      >
                        <option value="">Select an option…</option>
                        {activeVoiceDef.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === "0" ? "No" : opt === "1" ? "Yes" : opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={activeVoiceDef?.type || "text"}
                        className="fallback-input"
                        placeholder={activeVoiceDef?.placeholder || "Type value…"}
                        value={voiceTextInput}
                        onChange={(e) => setVoiceTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleManualVoiceSubmit()}
                      />
                    )}

                    <button
                      type="button"
                      className="smart-btn secondary"
                      onClick={handleManualVoiceSubmit}
                    >
                      Save & Next →
                    </button>
                  </div>
                </div>

                {/* Question Navigation Controls */}
                <div className="voice-nav-row">
                  <button
                    className="smart-btn ghost"
                    onClick={prevVoiceQuestion}
                    disabled={voiceIndex === 0}
                  >
                    <FaArrowLeft /> Previous Question
                  </button>

                  {!activeVoiceDef?.required && (
                    <button
                      className="smart-btn ghost"
                      onClick={advanceVoiceQuestion}
                    >
                      Skip Question
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              OPTION 2: DEDICATED MEDICAL REPORT WORKFLOW
              ══════════════════════════════════════════════════════════════════ */}
          {assessmentMode === "report" && (
            <div className="workflow-container report-workflow">
              {/* Report Header */}
              <div className="workflow-top-bar">
                <div className="workflow-title-wrap">
                  <span className="workflow-badge">📄 Medical Report Extraction</span>
                  <h2>
                    {reportStep === "upload" && "Upload Your Medical Report"}
                    {reportStep === "review_extracted" && "Review Extracted Health Data"}
                    {reportStep === "missing_qa" && "Complete Remaining Information"}
                  </h2>
                </div>
                <button
                  className="switch-mode-btn"
                  onClick={() => requestModeSwitch(null)}
                  title="Switch to another assessment method"
                >
                  <FaExchangeAlt /> Change Method
                </button>
              </div>

              {/* Sub-step 1: Upload */}
              {reportStep === "upload" && (
                <div className="report-upload-screen">
                  <div
                    className="report-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={handleReportFileSelect}
                      style={{ display: "none" }}
                    />
                    <div className="dropzone-icon">📁</div>
                    <h3>Drag & Drop or Click to Upload Medical Report</h3>
                    <p>Supported Formats: PDF, JPG, JPEG, PNG (Max: 10 MB)</p>
                    <button type="button" className="smart-btn secondary">
                      <FaFileUpload /> Choose File
                    </button>
                  </div>

                  {reportFile && (
                    <div className="report-file-selected">
                      <div className="file-info">
                        <FaFileAlt className="file-icon" />
                        <div>
                          <strong>{reportFile.name}</strong>
                          <small>{(reportFile.size / 1024 / 1024).toFixed(2)} MB</small>
                        </div>
                      </div>
                      <button
                        className="file-remove-btn"
                        onClick={() => setReportFile(null)}
                        title="Remove file"
                      >
                        <FaTimesCircle />
                      </button>
                    </div>
                  )}

                  {reportError && (
                    <div className="report-error-card">
                      <FaExclamationTriangle />
                      <div className="error-body">
                        <strong>Extraction Notice</strong>
                        <p>{reportError}</p>
                        <div className="error-actions">
                          <button
                            className="smart-btn ghost"
                            onClick={() => { setReportFile(null); setReportError(null); }}
                          >
                            Try Another File
                          </button>
                          <button
                            className="smart-btn primary"
                            onClick={() => applyModeSwitch("manual", true)}
                          >
                            Enter Manually
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {reportLoading && (
                    <div className="report-loading-state">
                      <FaBrain className="spinner-brain" />
                      <h4>Analyzing Medical Document…</h4>
                      <p>DiaSense AI is identifying laboratory parameters and clinical biomarkers.</p>
                      <div className="progress-dots-row">
                        <span className="progress-dot" />
                        <span className="progress-dot" style={{ animationDelay: "0.2s" }} />
                        <span className="progress-dot" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  )}

                  <div className="report-upload-actions">
                    <button
                      className="smart-btn primary large-btn"
                      onClick={handleExtractMedicalReport}
                      disabled={!reportFile || reportLoading}
                    >
                      <FaFileAlt /> {reportLoading ? "Processing Document…" : "Extract Medical Data →"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 2: Review Extracted Data */}
              {reportStep === "review_extracted" && (
                <div className="report-extracted-screen">
                  <div className="extracted-intro">
                    <h3>✅ Medical Information Identified</h3>
                    <p>
                      Review the values extracted from your report. Every field below is editable so you can
                      correct any OCR or document misinterpretation.
                    </p>
                  </div>

                  {ocrQualityWarning && (
                    <div className="ocr-warning-box">
                      <FaExclamationTriangle />
                      <span>{ocrQualityWarning}</span>
                    </div>
                  )}

                  {/* Extracted Fields Grid */}
                  <div className="extracted-fields-grid">
                    {Object.entries(editableExtracted).map(([field, info]) => {
                      const def = CANONICAL_ASSESSMENT_SCHEMA[field];
                      return (
                        <div key={field} className="extracted-card">
                          <div className="extracted-card-header">
                            <span className="extracted-label">{def?.label || field}</span>
                            <span className={`conf-badge conf-${(info.confidence || "HIGH").toLowerCase()}`}>
                              {info.confidence === "HIGH" ? "✓ High Confidence" : "⚠ Please Verify"}
                            </span>
                          </div>

                          <div className="extracted-input-box">
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
                            {def?.unit && <span className="extracted-unit-tag">{def.unit}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Information Still Needed Box */}
                  <div className="information-needed-box">
                    <h4>⚠ Information Still Needed</h4>
                    <p>The following fields were not detected in your report and will be gathered next:</p>
                    <div className="missing-chips">
                      {Object.keys(CANONICAL_ASSESSMENT_SCHEMA)
                        .filter((k) => !editableExtracted[k] && !CANONICAL_ASSESSMENT_SCHEMA[k].autoCalculated)
                        .map((k) => (
                          <span key={k} className="needed-chip">
                            {CANONICAL_ASSESSMENT_SCHEMA[k]?.label}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Extracted Confirmation Actions */}
                  <div className="extracted-footer-actions">
                    <button
                      className="smart-btn primary large-btn"
                      onClick={handleApplyExtractedValues}
                    >
                      <FaCheckDouble /> Confirm & Complete Missing Data →
                    </button>
                    <button
                      className="smart-btn ghost"
                      onClick={() => setReportStep("upload")}
                    >
                      Upload Different Report
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 3: Interactive Missing Data Completion */}
              {reportStep === "missing_qa" && activeMissingDef && (
                <div className="report-missing-screen">
                  <div className="missing-progress-header">
                    <span>
                      Missing Field {missingIndex + 1} of {missingQueue.length}
                    </span>
                    <h4>{activeMissingDef.label}</h4>
                  </div>

                  <div className="missing-question-card">
                    <h3>{activeMissingDef.question}</h3>
                    <p>{activeMissingDef.hint}</p>

                    <div className="missing-dual-input-row">
                      {activeMissingDef.type === "select" ? (
                        <select
                          value={missingInput}
                          onChange={(e) => setMissingInput(e.target.value)}
                          className="missing-select"
                        >
                          <option value="">Select option…</option>
                          {activeMissingDef.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt === "0" ? "No" : opt === "1" ? "Yes" : opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={activeMissingDef.type || "text"}
                          className="missing-input-field"
                          placeholder={activeMissingDef.placeholder}
                          value={missingInput}
                          onChange={(e) => setMissingInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveMissingAnswer("manual")}
                        />
                      )}

                      {/* Voice Answer Button */}
                      {isSpeechRecognitionSupported() && (
                        <button
                          type="button"
                          className={`smart-btn voice-btn ${missingListening ? "stop-btn" : ""}`}
                          onClick={handleMissingVoiceInput}
                          disabled={missingListening}
                          title="Speak your answer"
                        >
                          {missingListening ? (
                            <>
                              <FaStopCircle /> Listening…
                            </>
                          ) : (
                            <>
                              <FaMicrophone /> Speak
                            </>
                          )}
                        </button>
                      )}

                      <button
                        className="smart-btn primary"
                        onClick={() => handleSaveMissingAnswer("manual")}
                      >
                        Save & Next →
                      </button>
                    </div>

                    {!activeMissingDef.required && (
                      <div className="missing-skip-row">
                        <button className="smart-btn ghost" onClick={advanceMissingQueue}>
                          Skip this question
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              OPTION 3: DEDICATED MANUAL ASSESSMENT WORKFLOW — ONE QUESTION AT A TIME
              ══════════════════════════════════════════════════════════════════ */}
          {assessmentMode === "manual" && (() => {
            const manualKey = MANUAL_QUESTION_KEYS[manualQuestionIndex];
            const manualDef = CANONICAL_ASSESSMENT_SCHEMA[manualKey];

            const handleManualSave = () => {
              if (!manualTextInput || String(manualTextInput).trim() === "") {
                if (manualDef?.required) {
                  toast.warning(`${manualDef.label} is required.`);
                  return;
                }
                // Skip: advance without saving
                if (manualQuestionIndex + 1 < MANUAL_QUESTION_KEYS.length) {
                  setManualQuestionIndex((prev) => prev + 1);
                  setManualTextInput("");
                } else {
                  toast.success("✅ Manual assessment complete! Reviewing your data.");
                  setAssessmentMode("review");
                }
                return;
              }

              const { valid, message } = validateField(manualKey, manualTextInput);
              if (!valid) { toast.error(message); return; }

              updateField(manualKey, String(manualTextInput).trim(), "manual", "HIGH");

              if (manualQuestionIndex + 1 < MANUAL_QUESTION_KEYS.length) {
                setManualQuestionIndex((prev) => prev + 1);
                setManualTextInput(formData[MANUAL_QUESTION_KEYS[manualQuestionIndex + 1]] || "");
              } else {
                toast.success("🎉 Manual assessment complete! Reviewing your data.");
                setAssessmentMode("review");
              }
            };

            const handleManualBack = () => {
              if (manualQuestionIndex > 0) {
                const prevKey = MANUAL_QUESTION_KEYS[manualQuestionIndex - 1];
                setManualQuestionIndex((prev) => prev - 1);
                setManualTextInput(formData[prevKey] || "");
              }
            };

            const handleManualMic = () => {
              if (!isSpeechRecognitionSupported()) {
                toast.warning("Voice recognition is not supported in this browser. Please type your answer.");
                return;
              }
              if (isListening) { stopListening(); setIsListening(false); return; }
              setIsListening(true);
              toast.info(`🎙️ Listening for ${manualDef?.label}…`);
              startListening({
                lang: language || "en",
                onResult: (transcript) => {
                  setIsListening(false);
                  const interpreted = interpretTranscript(transcript, manualKey);
                  if (interpreted) {
                    setManualTextInput(String(interpreted.value));
                    toast.success(`✅ Heard: ${interpreted.displayValue}`);
                  } else {
                    const numMatch = transcript.match(/(\d+(?:\.\d+)?)/);
                    if (numMatch) setManualTextInput(numMatch[1]);
                    else toast.warning(`Could not understand "${transcript}". Please type your answer.`);
                  }
                },
                onError: (msg) => { setIsListening(false); toast.error(msg); },
                onEnd: () => setIsListening(false),
              });
            };

            if (!manualDef) return null;
            const progressPct = ((manualQuestionIndex + 1) / MANUAL_QUESTION_KEYS.length) * 100;

            return (
              <div className="workflow-container manual-workflow">
                {/* Header */}
                <div className="workflow-top-bar">
                  <div className="workflow-title-wrap">
                    <span className="workflow-badge">✍️ Manual Mode</span>
                    <h2>Question {manualQuestionIndex + 1} of {MANUAL_QUESTION_KEYS.length}</h2>
                  </div>
                  <button
                    className="switch-mode-btn"
                    onClick={() => requestModeSwitch(null)}
                    title="Switch to another assessment method"
                  >
                    <FaExchangeAlt /> Change Method
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="voice-progress-track">
                  <div className="voice-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>

                {/* Question Card */}
                <div className="voice-hero-card">
                  <div className="voice-card-category">
                    {manualDef.group === "personal" && "Personal & Physical Profile"}
                    {manualDef.group === "clinical" && "Clinical & Laboratory Values"}
                    {manualDef.group === "lifestyle" && "Lifestyle & Daily Habits"}
                    {manualDef.required && <span className="required-chip">Required</span>}
                    {!manualDef.required && <span className="optional-chip">Optional</span>}
                  </div>

                  <h3 className="voice-question-text">{manualDef.question}</h3>
                  <p className="voice-question-hint">{manualDef.hint}</p>

                  {/* Input Area */}
                  <div className="manual-qa-input-area">
                    {manualDef.type === "select" ? (
                      <div className="manual-select-choices">
                        {manualDef.options?.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`choice-btn ${manualTextInput === opt ? "selected" : ""}`}
                            onClick={() => setManualTextInput(opt)}
                          >
                            {opt === "0" ? "No" : opt === "1" ? "Yes" : opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="manual-text-input-row">
                        <div className="manual-input-wrapper">
                          <input
                            type={manualDef.type === "number" ? "number" : "text"}
                            className="manual-qa-input"
                            placeholder={manualDef.placeholder}
                            value={manualTextInput}
                            min={manualDef.min}
                            max={manualDef.max}
                            step={manualDef.type === "number" ? "any" : undefined}
                            onChange={(e) => setManualTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
                            autoFocus
                          />
                          {manualDef.unit && (
                            <span className="manual-qa-unit">{manualDef.unit}</span>
                          )}
                        </div>
                        {/* Inline Mic */}
                        <button
                          type="button"
                          className={`voice-action-btn ${isListening ? "active-listening" : ""}`}
                          onClick={handleManualMic}
                          title="Speak your answer"
                        >
                          {isListening ? <FaStopCircle /> : <FaMicrophone />}
                          {isListening ? "Stop" : "Speak"}
                        </button>
                      </div>
                    )}

                    {/* BMI Auto-preview */}
                    {manualKey === "weight" && formData.height && manualTextInput && (
                      <div className="bmi-preview-inline">
                        📊 BMI preview: {(parseFloat(manualTextInput) / ((parseFloat(formData.height) / 100) ** 2)).toFixed(1)} kg/m²
                      </div>
                    )}

                    {/* Current value reminder if already set */}
                    {formData[manualKey] && String(formData[manualKey]).trim() !== "" && manualTextInput === "" && (
                      <div className="current-value-hint">
                        Current: <strong>{formData[manualKey]}</strong> {manualDef.unit || ""}
                        <button
                          className="use-current-btn"
                          onClick={() => setManualTextInput(String(formData[manualKey]))}
                        >Keep this value</button>
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="voice-nav-row">
                    <button
                      className="smart-btn ghost"
                      onClick={handleManualBack}
                      disabled={manualQuestionIndex === 0}
                    >
                      <FaArrowLeft /> Previous
                    </button>

                    {!manualDef.required && (
                      <button
                        className="smart-btn ghost"
                        onClick={() => {
                          if (manualQuestionIndex + 1 < MANUAL_QUESTION_KEYS.length) {
                            setManualQuestionIndex((prev) => prev + 1);
                            setManualTextInput(formData[MANUAL_QUESTION_KEYS[manualQuestionIndex + 1]] || "");
                          } else {
                            setAssessmentMode("review");
                          }
                        }}
                      >
                        Skip →
                      </button>
                    )}

                    <button
                      className="smart-btn primary"
                      onClick={handleManualSave}
                    >
                      {manualQuestionIndex + 1 < MANUAL_QUESTION_KEYS.length
                        ? <><FaArrowRight /> Continue</>
                        : <><FaCheckCircle /> Finish & Review</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════
              UNIFIED PRE-PREDICTION FINAL REVIEW SCREEN
              ══════════════════════════════════════════════════════════════════ */}
          {assessmentMode === "review" && (
            <div className="review-workflow-container">
              <div className="review-header-card">
                <span className="badge-pill">📋 Assessment Review</span>
                <h2>Verify Your Information Before AI Analysis</h2>
                <p>
                  Please review all personal, clinical, and lifestyle metrics below.
                  All fields have been validated against medical boundaries.
                </p>

                {/* Data Sources Breakdown Stats */}
                <div className="source-stats-banner">
                  <span className="stat-item report-stat">
                    📄 Report: {sourceStats.reportCount} field{sourceStats.reportCount !== 1 ? "s" : ""}
                  </span>
                  <span className="stat-item voice-stat">
                    🎙️ Voice: {sourceStats.voiceCount} field{sourceStats.voiceCount !== 1 ? "s" : ""}
                  </span>
                  <span className="stat-item manual-stat">
                    ✍️ Manual: {sourceStats.manualCount} field{sourceStats.manualCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Review Sections */}
              <div className="review-sections-grid">
                {/* 1. Personal Information */}
                <div className="review-group-card">
                  <h3><FaUser /> Personal Information</h3>
                  <div className="review-rows">
                    <div className="review-row">
                      <span className="row-label">Age</span>
                      <span className="row-value">{formData.age || "–"} yrs</span>
                      {sourceBadge("age")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Gender</span>
                      <span className="row-value">{formData.gender}</span>
                      {sourceBadge("gender")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Location Type</span>
                      <span className="row-value">{formData.patientGroup}</span>
                      {sourceBadge("patientGroup")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Height</span>
                      <span className="row-value">{formData.height || "–"} cm</span>
                      {sourceBadge("height")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Weight</span>
                      <span className="row-value">{formData.weight || "–"} kg</span>
                      {sourceBadge("weight")}
                    </div>
                    <div className="review-row highlight-row">
                      <span className="row-label">BMI</span>
                      <span className="row-value">{formData.bmi || "–"} kg/m²</span>
                      <span className="source-badge src-manual">Auto</span>
                    </div>
                  </div>
                </div>

                {/* 2. Clinical Measurements */}
                <div className="review-group-card">
                  <h3><FaStethoscope /> Clinical Measurements</h3>
                  <div className="review-rows">
                    <div className="review-row">
                      <span className="row-label">Blood Pressure</span>
                      <span className="row-value">
                        {formData.bloodPressure ? `${formData.bloodPressure} mmHg` : "Not provided (standard 120 used)"}
                      </span>
                      {sourceBadge("bloodPressure")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">HbA1c</span>
                      <span className="row-value">
                        {formData.hba1c ? `${formData.hba1c} %` : "Not provided"}
                      </span>
                      {sourceBadge("hba1c")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Fasting Glucose</span>
                      <span className="row-value">
                        {formData.fastingGlucose ? `${formData.fastingGlucose} mg/dL` : "Not provided"}
                      </span>
                      {sourceBadge("fastingGlucose")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Monthly Income</span>
                      <span className="row-value">
                        {formData.monthlyIncome ? `₹${formData.monthlyIncome}` : "Demographic default"}
                      </span>
                      {sourceBadge("monthlyIncome")}
                    </div>
                  </div>
                </div>

                {/* 3. Lifestyle & Habits */}
                <div className="review-group-card">
                  <h3><FaRunning /> Lifestyle Habits</h3>
                  <div className="review-rows">
                    <div className="review-row">
                      <span className="row-label">Family History</span>
                      <span className="row-value">
                        {formData.familyHistory === "1" ? "Yes — Family History Present" : "No Family History"}
                      </span>
                      {sourceBadge("familyHistory")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Physical Activity</span>
                      <span className="row-value">
                        {formData.physicalActivityHours ? `${formData.physicalActivityHours} hrs/day` : "0 hrs/day"}
                      </span>
                      {sourceBadge("physicalActivityHours")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Daily Sugar Intake</span>
                      <span className="row-value">
                        {formData.dailySugarIntake ? `${formData.dailySugarIntake} g/day` : "Standard baseline"}
                      </span>
                      {sourceBadge("dailySugarIntake")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Fast Food Frequency</span>
                      <span className="row-value">
                        {formData.fastFoodFrequency ? `${formData.fastFoodFrequency} meals/week` : "1 meal/week"}
                      </span>
                      {sourceBadge("fastFoodFrequency")}
                    </div>
                    <div className="review-row">
                      <span className="row-label">Sleep Duration</span>
                      <span className="row-value">
                        {formData.sleepHours ? `${formData.sleepHours} hrs/night` : "7 hrs/night"}
                      </span>
                      {sourceBadge("sleepHours")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="review-final-actions">
                <button
                  type="button"
                  className="smart-btn ghost"
                  onClick={() => applyModeSwitch("manual", true)}
                >
                  <FaEdit /> Edit Information Manually
                </button>

                <button
                  type="button"
                  className="smart-btn ghost"
                  onClick={() => requestModeSwitch(null)}
                >
                  <FaExchangeAlt /> Change Assessment Method
                </button>

                <button
                  type="button"
                  className="smart-btn primary analyze-action-btn"
                  onClick={handleConfirmAndAnalyze}
                  disabled={loading}
                >
                  <FaBrain /> {loading ? "Evaluating with ML Model…" : "Confirm & Analyze"}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              CONFLICT RESOLUTION MODAL
              ══════════════════════════════════════════════════════════════════ */}
          {resolvingConflict && (
            <div className="conflict-overlay">
              <div className="conflict-dialog">
                <FaExclamationTriangle className="conflict-icon" />
                <h3>Different Values Detected</h3>
                <p>
                  A conflicting value was found for{" "}
                  <strong>
                    {CANONICAL_ASSESSMENT_SCHEMA[resolvingConflict.field]?.label || resolvingConflict.field}
                  </strong>
                  . Which value would you like to use for your screening?
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
                  <button
                    className="smart-btn secondary"
                    onClick={() => resolveConflict(false)}
                  >
                    Use My Value ({resolvingConflict.manualVal})
                  </button>
                  <button
                    className="smart-btn primary"
                    onClick={() => resolveConflict(true)}
                  >
                    Use Report Value ({resolvingConflict.reportVal})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SWITCH MODE CONFIRMATION MODAL
              ══════════════════════════════════════════════════════════════════ */}
          {showSwitchModal && (
            <div className="conflict-overlay">
              <div className="conflict-dialog">
                <FaExchangeAlt className="conflict-icon" />
                <h3>Change Assessment Method</h3>
                <p>
                  You have already entered some health information in this session.
                  Would you like to keep your entered data or start fresh?
                </p>

                <div className="conflict-actions">
                  <button
                    className="smart-btn primary"
                    onClick={() => applyModeSwitch(pendingModeSwitch, true)}
                  >
                    Keep Information & Switch
                  </button>
                  <button
                    className="smart-btn secondary"
                    onClick={() => applyModeSwitch(pendingModeSwitch, false)}
                  >
                    Start Fresh
                  </button>
                  <button
                    className="smart-btn ghost"
                    onClick={() => setShowSwitchModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="ai-loading-overlay">
          <div className="loading-card">
            <FaBrain className="spinner-brain" />
            <h3>Evaluating health profile…</h3>
            <p>Running verified DiaSense risk screening model</p>
            <small>⚕️ This is an AI screening model, not a medical diagnosis.</small>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default Assessment;