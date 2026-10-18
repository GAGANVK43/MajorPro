/**
 * VoiceEngine.js — DiaSense AI Production Voice Pipeline
 * 
 * Architecture:
 * User speech → Speech recognition → Transcript → Natural Language Understanding
 * → Field Extraction → Unit Normalization → Range Validation → Confidence Assessment
 * → User Confirmation → Unified Assessment Data
 */

// ─────────────────────────────────────────────────────────────────────────────
// Browser capability detection
// ─────────────────────────────────────────────────────────────────────────────
export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return !!(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition
  );
}

export function isSpeechSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return !!window.speechSynthesis;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT-TO-SPEECH (Voice Output)
// ─────────────────────────────────────────────────────────────────────────────
let _currentUtterance = null;

export function speak(text, langCode = "en") {
  if (!isSpeechSynthesisSupported()) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = _voiceLang(langCode);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.onend = resolve;
      utterance.onerror = resolve; // Graceful degradation
      _currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      resolve();
    }
  });
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
}

function _voiceLang(code) {
  const map = {
    en: "en-IN",
    kn: "kn-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    te: "te-IN",
    ml: "ml-IN",
  };
  return map[code] || "en-IN";
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH RECOGNITION (Voice Input)
// ─────────────────────────────────────────────────────────────────────────────
let _recognizer = null;

/**
 * Start speech listening session.
 */
export function startListening({ lang = "en", onResult, onError, onStart, onEnd }) {
  const SR =
    typeof window !== "undefined" &&
    (window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition);

  if (!SR) {
    onError?.("Voice input is not supported in your browser. Please type your answers instead.");
    return;
  }

  stopListening();

  try {
    _recognizer = new SR();
    _recognizer.lang = _voiceLang(lang);
    _recognizer.continuous = false;
    _recognizer.interimResults = false;
    _recognizer.maxAlternatives = 1;

    _recognizer.onstart = () => onStart?.();
    _recognizer.onend = () => onEnd?.();

    _recognizer.onresult = (event) => {
      if (event.results && event.results[0] && event.results[0][0]) {
        const transcript = event.results[0][0].transcript.trim();
        const confidence = event.results[0][0].confidence || 0.9;
        onResult?.(transcript, confidence);
      }
    };

    _recognizer.onerror = (event) => {
      const errorMap = {
        "not-allowed": "Microphone permission was denied. Please allow microphone access in your browser settings.",
        "no-speech": "No speech was detected. Please try speaking clearly into the microphone.",
        network: "Network connection error during voice recognition. Please verify your connection.",
        "language-not-supported": "Voice recognition is not available for this language on your browser.",
      };
      onError?.(errorMap[event.error] || `Voice recognition error (${event.error}). Please type your answer.`);
    };

    _recognizer.start();
  } catch (e) {
    onError?.("Could not initialize microphone. Please ensure microphone access is granted.");
  }
}

export function stopListening() {
  if (_recognizer) {
    try {
      _recognizer.stop();
    } catch (_) {}
    _recognizer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL FIELD DEFINITIONS & PHYSIOLOGICAL BOUNDS
// ─────────────────────────────────────────────────────────────────────────────
export const FIELD_DEFINITIONS = {
  age: {
    label: "Age",
    question: "What is your age in years?",
    type: "number",
    unit: "years",
    min: 1,
    max: 110,
    placeholder: "e.g. 42",
    invalidMsg: "Please enter a valid age between 1 and 110 years.",
  },
  gender: {
    label: "Gender",
    question: "What is your gender? Male or Female?",
    type: "select",
    options: ["Male", "Female"],
    placeholder: "Male or Female",
  },
  patientGroup: {
    label: "Location Type",
    question: "Do you live in an Urban, Rural, or Semi-Urban area?",
    type: "select",
    options: ["Urban", "Rural", "Semi-Urban"],
    placeholder: "Urban / Rural / Semi-Urban",
  },
  height: {
    label: "Height",
    question: "What is your height in centimeters (or feet and inches)?",
    type: "number",
    unit: "cm",
    min: 100,
    max: 250,
    placeholder: "e.g. 170",
    invalidMsg: "Height should be between 100 and 250 cm.",
  },
  weight: {
    label: "Weight",
    question: "What is your weight in kilograms (or pounds)?",
    type: "number",
    unit: "kg",
    min: 20,
    max: 250,
    placeholder: "e.g. 75",
    invalidMsg: "Weight should be between 20 and 250 kg.",
  },
  bmi: {
    label: "BMI",
    question: "What is your Body Mass Index (BMI)?",
    type: "number",
    unit: "kg/m²",
    min: 10,
    max: 70,
    placeholder: "e.g. 24.5",
    invalidMsg: "BMI should be between 10 and 70 kg/m².",
  },
  fastingGlucose: {
    label: "Fasting Blood Glucose",
    question: "What is your fasting blood glucose in mg/dL (or mmol/L)?",
    type: "number",
    unit: "mg/dL",
    min: 50,
    max: 450,
    placeholder: "e.g. 108",
    invalidMsg: "Fasting glucose should be between 50 and 450 mg/dL.",
  },
  hba1c: {
    label: "HbA1c Level",
    question: "What is your HbA1c percentage?",
    type: "number",
    unit: "%",
    min: 3.0,
    max: 20.0,
    placeholder: "e.g. 5.8",
    invalidMsg: "HbA1c should be between 3.0% and 20.0%.",
  },
  bloodPressure: {
    label: "Systolic Blood Pressure",
    question: "What is your systolic blood pressure in mmHg (e.g. 120)?",
    type: "number",
    unit: "mmHg",
    min: 60,
    max: 220,
    placeholder: "e.g. 125",
    invalidMsg: "Systolic blood pressure should be between 60 and 220 mmHg.",
  },
  familyHistory: {
    label: "Family History of Diabetes",
    question: "Do you have a family history of diabetes? Yes or No?",
    type: "select",
    options: ["0", "1"],
    placeholder: "Yes or No",
  },
  physicalActivityHours: {
    label: "Physical Activity",
    question: "How many hours per day do you spend on moderate or vigorous physical activity?",
    type: "number",
    unit: "hours/day",
    min: 0,
    max: 20,
    placeholder: "e.g. 1.5",
    invalidMsg: "Physical activity should be between 0 and 20 hours per day.",
  },
  dailySugarIntake: {
    label: "Daily Sugar Intake",
    question: "Approximately how many grams of sugar do you consume daily?",
    type: "number",
    unit: "grams",
    min: 0,
    max: 200,
    placeholder: "e.g. 45",
    invalidMsg: "Daily sugar intake should be between 0 and 200 grams.",
  },
  fastFoodFrequency: {
    label: "Fast Food Frequency",
    question: "How many fast food or processed meals do you consume per week?",
    type: "number",
    unit: "meals/week",
    min: 0,
    max: 15,
    placeholder: "e.g. 2",
    invalidMsg: "Fast food frequency should be between 0 and 15 meals per week.",
  },
  sleepHours: {
    label: "Sleep Duration",
    question: "How many hours of sleep do you get per night on average?",
    type: "number",
    unit: "hours",
    min: 2,
    max: 14,
    placeholder: "e.g. 7",
    invalidMsg: "Sleep duration should be between 2 and 14 hours.",
  },
  monthlyIncome: {
    label: "Monthly Household Income",
    question: "What is your monthly household income in rupees? (Optional)",
    type: "number",
    unit: "₹",
    min: 0,
    max: 200000,
    placeholder: "e.g. 35000",
    optional: true,
    invalidMsg: "Monthly income should be a valid amount up to ₹2,00,000.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SPOKEN NUMBER PARSER
// Handles compound numbers: "one hundred and ten", "one twenty five",
// "seventy five", "three point five", hyphenated "thirty-five", etc.
// ─────────────────────────────────────────────────────────────────────────────
const SMALL_NUMS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19
};

const TENS_NUMS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

export function wordsToNumber(text) {
  if (!text) return null;
  const clean = text
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/,/g, "")
    .trim();

  // If already contains digits, extract directly
  const directMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (directMatch) {
    return parseFloat(directMatch[1]);
  }

  // Tokenize
  const tokens = clean.split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let hasNumber = false;
  let inDecimal = false;
  let decimalStr = "";

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];

    if (word === "and") continue;

    if (word === "point" || word === "dot") {
      inDecimal = true;
      continue;
    }

    if (inDecimal) {
      if (SMALL_NUMS[word] !== undefined) {
        decimalStr += SMALL_NUMS[word];
        hasNumber = true;
      } else if (/^\d+$/.test(word)) {
        decimalStr += word;
        hasNumber = true;
      }
      continue;
    }

    if (SMALL_NUMS[word] !== undefined) {
      current += SMALL_NUMS[word];
      hasNumber = true;
    } else if (TENS_NUMS[word] !== undefined) {
      current += TENS_NUMS[word];
      hasNumber = true;
    } else if (word === "hundred") {
      current = (current === 0 ? 1 : current) * 100;
      hasNumber = true;
    } else if (word === "thousand") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      hasNumber = true;
    }
  }

  total += current;

  if (inDecimal && decimalStr.length > 0) {
    total = parseFloat(`${total}.${decimalStr}`);
  }

  return hasNumber ? total : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NATURAL LANGUAGE UNDERSTANDING (NLU) & FIELD INTERPRETATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Interprets a speech transcript for a target field.
 * Handles natural speech variations:
 * - "I am 35", "My age is 35", "35 years old"
 * - "My fasting glucose is 110", "Fasting sugar is one hundred and ten"
 * - "120 over 80" (extracts systolic 120)
 * - "5 feet 8 inches" (converts to 172.7 cm)
 * - "165 pounds" (converts to 74.8 kg)
 * - "6.1 mmol/L" (converts to 110 mg/dL)
 * 
 * Returns: {
 *   value: string,
 *   displayValue: string,
 *   rawTranscript: string,
 *   confidence: "HIGH" | "MEDIUM" | "LOW",
 *   needsConfirmation: boolean,
 *   unit: string,
 *   convertedFrom: string | null
 * } or null
 */
export function interpretTranscript(transcript, field) {
  if (!transcript || !field) return null;
  const def = FIELD_DEFINITIONS[field];
  if (!def) return null;

  const raw = transcript.trim();
  const lower = raw.toLowerCase().replace(/,/g, " ");

  // ── 1. GENDER ──────────────────────────────────────────────────────────────
  if (field === "gender") {
    if (/\b(female|woman|girl|she|her)\b/i.test(lower)) {
      return {
        value: "Female",
        displayValue: "Female",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    if (/\b(male|man|boy|he|him)\b/i.test(lower) && !/\bfemale\b/i.test(lower)) {
      return {
        value: "Male",
        displayValue: "Male",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    return null;
  }

  // ── 2. FAMILY HISTORY ──────────────────────────────────────────────────────
  if (field === "familyHistory") {
    const YES_MATCH = /\b(yes|yeah|yep|positive|present|have|has|father|mother|parent|sibling|brother|sister|grandparent|uncle|aunt|family)\b/i;
    const NO_MATCH = /\b(no|nope|negative|none|never|nobody|neither|zero|absent)\b/i;

    if (YES_MATCH.test(lower) && !NO_MATCH.test(lower)) {
      return {
        value: "1",
        displayValue: "Yes — Family History Present",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    if (NO_MATCH.test(lower)) {
      return {
        value: "0",
        displayValue: "No — No Family History",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    return null;
  }

  // ── 3. PATIENT GROUP / LOCATION ────────────────────────────────────────────
  if (field === "patientGroup") {
    if (/\b(urban|city|metro|town)\b/i.test(lower) && !/\bsemi\b/i.test(lower)) {
      return {
        value: "Urban",
        displayValue: "Urban",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    if (/\b(rural|village|countryside)\b/i.test(lower)) {
      return {
        value: "Rural",
        displayValue: "Rural",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    if (/\b(semi[\s-]?urban|suburban|peri[\s-]?urban)\b/i.test(lower)) {
      return {
        value: "Semi-Urban",
        displayValue: "Semi-Urban",
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
      };
    }
    return null;
  }

  // ── 4. HEIGHT (Handles feet/inches, cm, meters) ─────────────────────────────
  if (field === "height") {
    // Check "5 feet 8 inches" or "5 foot 8" or "5'8"
    const ftInMatch = lower.match(/(\d+)\s*(?:feet|foot|ft|')\s*(?:and\s*)?(\d+)?\s*(?:inches|inch|in|")?/);
    if (ftInMatch) {
      const feet = parseFloat(ftInMatch[1]);
      const inches = ftInMatch[2] ? parseFloat(ftInMatch[2]) : 0;
      const totalCm = Math.round((feet * 30.48 + inches * 2.54) * 10) / 10;
      return {
        value: String(totalCm),
        displayValue: `${totalCm} cm (${feet}ft ${inches}in)`,
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: true, // confirm unit conversion
        unit: "cm",
        convertedFrom: `${feet}ft ${inches}in`,
      };
    }

    // Check meters: "1.72 meters" -> 172 cm
    const meterMatch = lower.match(/(\d+\.\d+)\s*(?:meters|meter|m)\b/);
    if (meterMatch) {
      const meters = parseFloat(meterMatch[1]);
      if (meters >= 1.0 && meters <= 2.5) {
        const cm = Math.round(meters * 100);
        return {
          value: String(cm),
          displayValue: `${cm} cm`,
          rawTranscript: raw,
          confidence: "HIGH",
          needsConfirmation: true,
          unit: "cm",
          convertedFrom: `${meters} m`,
        };
      }
    }
  }

  // ── 5. WEIGHT (Handles pounds / lbs → kg) ──────────────────────────────────
  if (field === "weight") {
    const lbsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:pounds|pound|lbs|lb)\b/);
    if (lbsMatch) {
      const lbs = parseFloat(lbsMatch[1]);
      const kg = Math.round(lbs * 0.45359237 * 10) / 10;
      return {
        value: String(kg),
        displayValue: `${kg} kg (${lbs} lbs)`,
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: true,
        unit: "kg",
        convertedFrom: `${lbs} lbs`,
      };
    }
  }

  // ── 6. FASTING GLUCOSE (Handles mmol/L → mg/dL) ─────────────────────────────
  if (field === "fastingGlucose") {
    const mmolMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:mmol|millimole|millimoles)/);
    if (mmolMatch) {
      const mmol = parseFloat(mmolMatch[1]);
      if (mmol >= 2.0 && mmol <= 30.0) {
        const mgdl = Math.round(mmol * 18.0182);
        return {
          value: String(mgdl),
          displayValue: `${mgdl} mg/dL (${mmol} mmol/L)`,
          rawTranscript: raw,
          confidence: "HIGH",
          needsConfirmation: true,
          unit: "mg/dL",
          convertedFrom: `${mmol} mmol/L`,
        };
      }
    }
  }

  // ── 7. BLOOD PRESSURE (Handles "120 over 80" or "120/80") ───────────────────
  if (field === "bloodPressure") {
    const bpPairMatch = lower.match(/(\d{2,3})\s*(?:\/|over|by)\s*(\d{2,3})/);
    if (bpPairMatch) {
      const systolic = parseFloat(bpPairMatch[1]);
      const diastolic = parseFloat(bpPairMatch[2]);
      return {
        value: String(systolic),
        displayValue: `${systolic} mmHg systolic (${systolic}/${diastolic})`,
        rawTranscript: raw,
        confidence: "HIGH",
        needsConfirmation: false,
        unit: "mmHg",
        convertedFrom: `${systolic}/${diastolic}`,
      };
    }
  }

  // ── 8. NUMERICAL EXTRACTION WITH CONVERSATIONAL STRIPPING ───────────────────
  if (def.type === "number") {
    // Strip common conversational filler patterns:
    // "I am 35", "My age is 35", "I'm 35", "35 years old"
    // "my fasting glucose is 110", "I got 110"
    let cleaned = lower
      .replace(/\b(i am|i'm|im|my|is|got|have|measured|about|around|approximately|level is|it's|its)\b/g, " ")
      .replace(/\b(years? old|years?|yrs?|cm|centimeters?|kg|kilos?|kilograms?|mg\/dl|mg dl|points?|hours?|hrs?|meals?|grams?|rupees?|inr)\b/g, " ")
      .trim();

    const parsedNum = wordsToNumber(cleaned);
    if (parsedNum !== null && !isNaN(parsedNum)) {
      const { valid } = validateField(field, parsedNum);
      const isWithinBounds = valid;

      // Confidence assessment
      const hasExplicitUnit = lower.includes(def.unit?.toLowerCase() || "");
      const confidence = isWithinBounds && hasExplicitUnit ? "HIGH" : isWithinBounds ? "MEDIUM" : "LOW";
      const needsConfirmation = confidence !== "HIGH" || parsedNum < def.min * 1.05 || parsedNum > def.max * 0.95;

      return {
        value: String(parsedNum),
        displayValue: `${parsedNum} ${def.unit || ""}`.trim(),
        rawTranscript: raw,
        confidence,
        needsConfirmation,
        unit: def.unit || "",
        convertedFrom: null,
      };
    }
  }

  return null;
}

/**
 * Validates a field value against physiological boundaries.
 */
export function validateField(field, value) {
  const def = FIELD_DEFINITIONS[field];
  if (!def) return { valid: true, message: "" };

  if (def.type === "number") {
    if (value === null || value === undefined || value === "") {
      return { valid: false, message: `${def.label} is required.` };
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { valid: false, message: def.invalidMsg || `Please enter a valid number for ${def.label}.` };
    }
    if (num < def.min || num > def.max) {
      return {
        valid: false,
        message: def.invalidMsg || `${def.label} must be between ${def.min} and ${def.max} ${def.unit || ""}.`,
      };
    }
  } else if (def.type === "select") {
    if (!value || !def.options.includes(String(value))) {
      return { valid: false, message: `Please select a valid option for ${def.label}.` };
    }
  }

  return { valid: true, message: "" };
}

/**
 * Returns voice question text for prompt.
 */
export function getVoiceQuestion(field, langCode = "en") {
  const def = FIELD_DEFINITIONS[field];
  return def?.question || `Please provide your ${field}.`;
}
