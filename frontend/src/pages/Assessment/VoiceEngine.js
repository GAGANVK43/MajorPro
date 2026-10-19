/**
 * VoiceEngine.js — DiaSense AI Production Multilingual Voice Pipeline
 * 
 * Architecture:
 * User speech (Kannada/Hindi/English/etc.) → Speech recognition → Transcript 
 * → Multilingual Natural Language Understanding (Question-Aware & Field-Specific)
 * → Unicode & Indic Digit Normalization → Field Extraction → Unit Normalization 
 * → Range Validation → Confidence Assessment → User Confirmation → Unified Assessment Data
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. BROWSER CAPABILITY DETECTION
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
// 2. TEXT-TO-SPEECH (Voice Output)
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

export function _voiceLang(code) {
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
// 3. SPEECH RECOGNITION (Voice Input)
// ─────────────────────────────────────────────────────────────────────────────
let _recognizer = null;

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
// 4. CANONICAL FIELD DEFINITIONS & PHYSIOLOGICAL BOUNDS
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
// 5. UNICODE INDIC DIGIT & SPOKEN NUMBER NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────
const INDIC_DIGIT_MAP = {
  // Kannada: ೦-೯ (U+0CE6 to U+0CEF)
  "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4",
  "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9",
  // Devanagari (Hindi): ०-९ (U+0966 to U+096F)
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  // Tamil: ௦-௯ (U+0BE6 to U+0BEF)
  "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4",
  "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9",
  // Telugu: ౦-౯ (U+0C66 to U+0C6F)
  "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4",
  "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9",
  // Malayalam: ൦-൯ (U+0D66 to U+0D6F)
  "൦": "0", "൧": "1", "൨": "2", "൩": "3", "൪": "4",
  "൫": "5", "൬": "6", "൭": "7", "൮": "8", "൯": "9",
};

export function normalizeIndicDigits(str) {
  if (!str) return "";
  return str.replace(/[\u0CE6-\u0CEF\u0966-\u096F\u0BE6-\u0BEF\u0C66-\u0C6F\u0D66-\u0D6F]/g, (char) => {
    return INDIC_DIGIT_MAP[char] || char;
  });
}

// Kannada spoken words to numbers
const KANNADA_WORD_NUMS = {
  "ಶೂನ್ಯ": 0, "ಒಂದು": 1, "ಒಂದ": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ನಾಕು": 4,
  "ಐದು": 5, "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
  "ಹನ್ನೊಂದು": 11, "ಹನ್ನೆರಡು": 12, "ಹದಿಮೂರು": 13, "ಹದಿನಾಲ್ಕು": 14, "ಹದಿನೈದು": 15,
  "ಹದಿನಾರು": 16, "ಹದಿನೇಳು": 17, "ಹದಿನೆಂಟು": 18, "ಹತ್ತೊಂಬತ್ತು": 19,
  "ಇಪ್ಪತ್ತು": 20, "ಇಪ್ಪತ್ತೊಂದು": 21, "ಇಪ್ಪತ್ತೆರಡು": 22, "ಇಪ್ಪತ್ತಮೂರು": 23, "ಇಪ್ಪತ್ನಾಲ್ಕು": 24, "ಇಪ್ಪತ್ತೈದು": 25,
  "ಮೂವತ್ತು": 30, "ಮೂವತ್ತೊಂದು": 31, "ಮೂವತ್ತೆರಡು": 32, "ಮೂವತ್ತಮೂರು": 33, "ಮೂವತ್ನಾಲ್ಕು": 34, "ಮೂವತ್ತೈದು": 35,
  "ನಲವತ್ತು": 40, "ನಲವತ್ತೊಂದು": 41, "ನಲವತ್ತೆರಡು": 42, "ನಲವತ್ತಮೂರು": 43, "ನಲವತ್ನಾಲ್ಕು": 44, "ನಲವತ್ತೈದು": 45,
  "ಐವತ್ತು": 50, "ಐವತ್ತೊಂದು": 51, "ಐವತ್ತೆರಡು": 52, "ಐವತ್ತಮೂರು": 53, "ಐವತ್ನಾಲ್ಕು": 54, "ಐವತ್ತೈದು": 55,
  "ಅರವತ್ತು": 60, "ಅರವತ್ತೈದು": 65,
  "ಎಪ್ಪತ್ತು": 70, "ಎಪ್ಪತ್ತೈದು": 75,
  "ಎಂಬತ್ತು": 80, "ಎಂಬತ್ತೈದು": 85,
  "ತೊಂಬತ್ತು": 90, "ತೊಂಬತ್ತೈದು": 95,
  "ನೂರು": 100, "ನೂರ ಇಪ್ಪತ್ತು": 120, "ನೂರ ಮೂವತ್ತು": 130, "ನೂರ ನಲವತ್ತು": 140, "ನೂರ ಐವತ್ತು": 150, "ನೂರ ಅರವತ್ತು": 160, "ನೂರ ಎಪ್ಪತ್ತು": 170, "ನೂರ ಎಂಬತ್ತು": 180,
};

// Hindi spoken words to numbers
const HINDI_WORD_NUMS = {
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
  "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15,
  "सोलह": 16, "सत्रह": 17, "अट्ठारह": 18, "उन्नीस": 19,
  "बीस": 20, "इक्कीस": 21, "बाईस": 22, "तेईस": 23, "चौबीस": 24, "पच्चीस": 25,
  "तीस": 30, "पैंतीस": 35,
  "चालीस": 40, "पैंतालीस": 45,
  "पचास": 50, "पचपन": 55,
  "साठ": 60, "पैंसठ": 65,
  "सत्तर": 70, "पचहत्तर": 75,
  "अस्सी": 80, "पचासी": 85,
  "नब्बे": 90, "पिचानवे": 95,
  "सौ": 100, "एक सौ बीस": 120, "एक सौ तीस": 130, "एक सौ सत्तर": 170, "एक सौ अस्सी": 180,
};

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
  // 1. Normalize Indic script digits to ASCII
  let clean = normalizeIndicDigits(text)
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/,/g, "")
    .trim();

  // 2. Direct digits
  const directMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (directMatch) {
    return parseFloat(directMatch[1]);
  }

  // 3. Check Kannada spoken word numbers
  for (const [kWord, kVal] of Object.entries(KANNADA_WORD_NUMS)) {
    if (clean === kWord || clean.includes(kWord)) {
      return kVal;
    }
  }

  // 4. Check Hindi spoken word numbers
  for (const [hWord, hVal] of Object.entries(HINDI_WORD_NUMS)) {
    if (clean === hWord || clean.includes(hWord)) {
      return hVal;
    }
  }

  // 5. English word tokens
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
// 6. QUESTION-AWARE MULTILINGUAL CATEGORICAL MAPS
// ─────────────────────────────────────────────────────────────────────────────
export const MULTILINGUAL_CATEGORICAL_MAP = {
  gender: {
    Male: [
      // English
      "male", "man", "boy", "he", "him",
      // Kannada
      "ಪುರುಷ", "ಗಂಡು", "ಹುಡುಗ", "ಗಂಡಸು",
      // Hindi
      "पुरुष", "मर्द", "लड़का", "आदमी",
      // Tamil
      "ஆண்",
      // Telugu
      "పురుషుడు", "మగ",
      // Malayalam
      "പുരുഷൻ", "ആൺ",
    ],
    Female: [
      // English
      "female", "woman", "girl", "she", "her",
      // Kannada
      "ಮಹಿಳೆ", "ಹೆಣ್ಣು", "ಹುಡುಗಿ", "ಸ್ತ್ರೀ",
      // Hindi
      "महिला", "स्त्री", "लड़की", "औरत",
      // Tamil
      "பெண்",
      // Telugu
      "స్త్రీ", "మహిళ", "ఆడ",
      // Malayalam
      "സ്ത്രീ", "പെൺ",
    ],
  },
  patientGroup: {
    "Semi-Urban": [
      // Must be evaluated BEFORE Urban to prevent substring collision on "Urban" / "ನಗರ"!
      // English
      "semi-urban", "semi urban", "semiurban", "suburban", "suburb", "peri-urban", "peri urban", "outskirts", "semi",
      // Kannada
      "ಅರೆ-ನಗರ", "ಅರೆ ನಗರ", "ಅರೆನಗರ", "ಉಪನಗರ", "ಅರೆ-ಪಟ್ಟಣ",
      // Hindi
      "अर्ध-शहरी", "अर्ध शहरी", "अर्धशहरी", "कस्बा", "उपनगर",
      // Tamil
      "அரை நகர்ப்புறம்", "அரை-நகர்ப்புறம்",
      // Telugu
      "అర్ధ పట్టణ", "అర్ధ-పట్టణ",
      // Malayalam
      "അർദ്ധ നഗരം", "അർദ്ധ-നഗരം",
    ],
    Urban: [
      // English
      "urban", "city", "metro", "town",
      // Kannada
      "ನಗರ", "ನಗರ ಪ್ರದೇಶ", "ಪಟ್ಟಣ", "ಸಿಟಿ",
      // Hindi
      "शहरी", "शहर", "नगर",
      // Tamil
      "நகர்ப்புறம்", "நகரம்",
      // Telugu
      "పట్టణ", "నగరం",
      // Malayalam
      "നഗരം", "നഗരപ്രദേശം",
    ],
    Rural: [
      // English
      "rural", "village", "countryside",
      // Kannada
      "ಗ್ರಾಮೀಣ", "ಗ್ರಾಮೀಣ ಪ್ರದೇಶ", "ಹಳ್ಳಿ", "ಗ್ರಾಮ",
      // Hindi
      "ग्रामीण", "गांव", "गाँव", "देहात",
      // Tamil
      "கிராமப்புறம்", "கிராமம்",
      // Telugu
      "గ్రామీణ", "గ్రామం",
      // Malayalam
      "ഗ്രാമം", "ഗ്രാമീണ",
    ],
  },
  familyHistory: {
    "1": [
      // English
      "yes", "yeah", "yep", "positive", "present", "have", "has", "father", "mother", "parent", "sibling", "brother", "sister", "grandparent", "family",
      // Kannada
      "ಹೌದು", "ಇದೆ", "ಉಂಟು", "ಖಂಡಿತ", "ತಂದೆ", "ತಾಯಿ", "ಪೋಷಕರು", "ಅಣ್ಣ", "ತಮ್ಮ", "ಅಕ್ಕ", "ತಂಗಿ", "ಕುಟುಂಬ",
      // Hindi
      "हाँ", "हां", "है", "पिताजी", "माताजी", "परिवार", "भाई", "बहन",
      // Tamil
      "ஆம்", "இருக்கிறது",
      // Telugu
      "అవును", "ఉంది",
      // Malayalam
      "ഉണ്ട്", "അതെ",
    ],
    "0": [
      // English
      "no", "nope", "negative", "none", "never", "nobody", "neither", "absent", "zero",
      // Kannada
      "ಇಲ್ಲ", "ಇಲ್ಲವೇ ಇಲ್ಲ", "ಯಾರಿಗೂ ಇಲ್ಲ", "ಇಲ್ಲಾ",
      // Hindi
      "नहीं", "ना", "किसी को नहीं", "नहिं",
      // Tamil
      "இல்லை",
      // Telugu
      "లేదు", "కాదు",
      // Malayalam
      "ഇല്ല",
    ],
  },
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Unicode-aware matching for alias phrases in multi-script text.
 */
function matchAlias(cleanText, tokens, aliasList) {
  for (const alias of aliasList) {
    const normAlias = alias.toLowerCase().trim();
    if (!normAlias) continue;

    // 1. Exact full text match
    if (cleanText === normAlias) return true;

    // 2. Exact token match for single word
    if (!normAlias.includes(" ") && !normAlias.includes("-") && tokens.includes(normAlias)) {
      return true;
    }

    // 3. Multi-word phrase or boundary match with Unicode characters
    const escaped = escapeRegex(normAlias).replace(/\s+/g, "[\\s-]+");
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
    if (pattern.test(cleanText)) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MULTILINGUAL QUESTION-AWARE ANSWER PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core question-aware multilingual parser.
 * Returns structured outcome:
 * {
 *   status: "valid" | "needs_confirmation" | "unrecognized" | "missing",
 *   value: string | null,
 *   displayValue: string | null,
 *   rawTranscript: string,
 *   confidence: "HIGH" | "MEDIUM" | "LOW",
 *   needsConfirmation: boolean,
 *   unit: string,
 *   convertedFrom: string | null,
 *   reason?: string
 * }
 */
export function interpretAnswer({ transcript, field, lang = "en" }) {
  if (!transcript || !String(transcript).trim()) {
    return {
      status: "missing",
      value: null,
      displayValue: null,
      rawTranscript: "",
      confidence: "LOW",
      needsConfirmation: false,
      unit: "",
      convertedFrom: null,
      reason: "No input provided",
    };
  }

  const def = FIELD_DEFINITIONS[field];
  if (!def) {
    return {
      status: "unrecognized",
      value: null,
      displayValue: null,
      rawTranscript: transcript,
      confidence: "LOW",
      needsConfirmation: false,
      unit: "",
      convertedFrom: null,
      reason: `Unknown field '${field}'`,
    };
  }

  const raw = String(transcript).trim();
  const normalized = normalizeIndicDigits(raw).normalize("NFKC");
  const cleanText = normalized
    .toLowerCase()
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip punctuation for tokens
  const tokenClean = cleanText.replace(/[?।!.]/g, " ");
  const tokens = tokenClean.split(/\s+/).filter(Boolean);

  // ── A. Disambiguation & User Uncertainty Filter ───────────────────────────
  const UNCERTAIN_WORDS = [
    "don't know", "dont know", "not sure", "no idea", "i do not know", "skip",
    "ಗೊತ್ತಿಲ್ಲ", "ತಿಳಿದಿಲ್ಲ", "ಖಚಿತವಿಲ್ಲ",
    "पता नहीं", "मालूम नहीं", "याद नहीं",
    "தெரியாது", "తెలియదు", "അറിയില്ല"
  ];
  for (const u of UNCERTAIN_WORDS) {
    if (cleanText.includes(u)) {
      return {
        status: "unrecognized",
        value: null,
        displayValue: null,
        rawTranscript: raw,
        confidence: "LOW",
        needsConfirmation: false,
        unit: "",
        convertedFrom: null,
        reason: "User indicated uncertainty",
      };
    }
  }

  // ── B. Categorical Question Parsing ───────────────────────────────────────
  if (MULTILINGUAL_CATEGORICAL_MAP[field]) {
    const fieldMap = MULTILINGUAL_CATEGORICAL_MAP[field];

    // Evaluate in order of keys
    for (const [canonicalVal, aliasList] of Object.entries(fieldMap)) {
      if (matchAlias(cleanText, tokens, aliasList)) {
        return {
          status: "valid",
          value: canonicalVal,
          displayValue: canonicalVal,
          rawTranscript: raw,
          confidence: "HIGH",
          needsConfirmation: false,
          unit: "",
          convertedFrom: null,
        };
      }
    }

    // Categorical field did not match any allowed category for this field
    return {
      status: "unrecognized",
      value: null,
      displayValue: null,
      rawTranscript: raw,
      confidence: "LOW",
      needsConfirmation: false,
      unit: "",
      convertedFrom: null,
      reason: `Answer '${raw}' is not recognized for ${def.label}.`,
    };
  }

  // ── C. Field-Specific Numeric / Clinical Parsing ──────────────────────────

  // 1. HEIGHT: Handles feet/inches (English, Kannada, Hindi), cm, meters
  if (field === "height") {
    // Spoken feet & inches: "5 feet 8 inches", "5 ft 8", "5'8", "5 ಅಡಿ 8 ಇಂಚು", "5 फीट 8 इंच"
    const ftInMatch = cleanText.match(/(\d+)\s*(?:feet|foot|ft|'|ಅಡಿ|ಫೀಟ್|फीट|फुट)\s*(?:and|ಮತ್ತು|और)?\s*(\d+)?\s*(?:inches|inch|in|"|ಇಂಚು|ಇಂಚ್|इंच)?/iu);
    if (ftInMatch) {
      const feet = parseFloat(ftInMatch[1]);
      const inches = ftInMatch[2] ? parseFloat(ftInMatch[2]) : 0;
      const totalCm = Math.round(feet * 30.48 + inches * 2.54);
      if (totalCm >= def.min && totalCm <= def.max) {
        return {
          status: "valid",
          value: String(totalCm),
          displayValue: `${totalCm} cm (${feet}ft ${inches}in)`,
          rawTranscript: raw,
          confidence: "HIGH",
          needsConfirmation: true,
          unit: "cm",
          convertedFrom: `${feet}ft ${inches}in`,
        };
      }
    }

    // Meters: "1.72 meters", "1.72 ಮೀಟರ್", "1.72 मीटर"
    const meterMatch = cleanText.match(/(\d+\.\d+)\s*(?:meters?|m|ಮೀಟರ್|मीटर)\b/iu);
    if (meterMatch) {
      const meters = parseFloat(meterMatch[1]);
      if (meters >= 1.0 && meters <= 2.5) {
        const cm = Math.round(meters * 100);
        return {
          status: "valid",
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

  // 2. WEIGHT: Handles pounds/lbs to kg: "150 pounds", "150 ಪೌಂಡ್", "150 पाउंड"
  if (field === "weight") {
    const lbsMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|lb|ಪೌಂಡ್|पाउंड)\b/iu);
    if (lbsMatch) {
      const lbs = parseFloat(lbsMatch[1]);
      const kg = Math.round(lbs * 0.45359237 * 10) / 10;
      if (kg >= def.min && kg <= def.max) {
        return {
          status: "valid",
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
  }

  // 3. FASTING GLUCOSE: Handles mmol/L -> mg/dL
  if (field === "fastingGlucose") {
    const mmolMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:mmol|millimole|millimoles)/i);
    if (mmolMatch) {
      const mmol = parseFloat(mmolMatch[1]);
      if (mmol >= 2.0 && mmol <= 30.0) {
        const mgdl = Math.round(mmol * 18.0182);
        return {
          status: "valid",
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

  // 4. BLOOD PRESSURE: Handles systolic/diastolic pairs "120/80", "120 over 80", "120 ಮತ್ತು 80", "120 और 80"
  if (field === "bloodPressure") {
    const bpPairMatch = cleanText.match(/(\d{2,3})\s*(?:\/|over|by|ಮತ್ತು|और)\s*(\d{2,3})/iu);
    if (bpPairMatch) {
      const systolic = parseFloat(bpPairMatch[1]);
      const diastolic = parseFloat(bpPairMatch[2]);
      if (systolic >= def.min && systolic <= def.max) {
        return {
          status: "valid",
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
  }

  // 5. GENERAL NUMERICAL EXTRACTION
  if (def.type === "number") {
    // Strip conversational filler patterns across languages
    let stripped = cleanText
      .replace(/\b(i am|i'm|im|my|is|got|have|measured|about|around|approximately|level is|it's|its)\b/gi, " ")
      .replace(/\b(years? old|years?|yrs?|cm|centimeters?|kg|kilos?|kilograms?|mg\/dl|mg dl|points?|hours?|hrs?|meals?|grams?|rupees?|inr)\b/gi, " ")
      .replace(/(ನನ್ನ|ನನಗೆ|ವಯಸ್ಸು|ತೂಕ|ಎತ್ತರ|ವರ್ಷ|ವರ್ಷಗಳು|ಕೆಜಿ|ಸೆಂಮೀ)/gi, " ")
      .replace(/(मेरा|मेरी|उम्र|साल|किलो|सेंटीमीटर)/gi, " ")
      .trim();

    const parsedNum = wordsToNumber(stripped);
    if (parsedNum !== null && !isNaN(parsedNum)) {
      const { valid } = validateField(field, parsedNum);
      const confidence = valid ? "HIGH" : "LOW";
      const needsConfirmation = !valid || parsedNum < def.min * 1.05 || parsedNum > def.max * 0.95;

      return {
        status: valid ? "valid" : "needs_confirmation",
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

  return {
    status: "unrecognized",
    value: null,
    displayValue: null,
    rawTranscript: raw,
    confidence: "LOW",
    needsConfirmation: false,
    unit: "",
    convertedFrom: null,
    reason: `Could not interpret "${raw}" for field ${field}.`,
  };
}

/**
 * Backward-compatible wrapper for interpretAnswer.
 * Returns the interpreted object if valid/confirmed, or null if unrecognized/missing.
 */
export function interpretTranscript(transcript, field, langCode = "en") {
  const result = interpretAnswer({ transcript, field, lang: langCode });
  if (result.status === "valid" || result.status === "needs_confirmation") {
    return result;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FIELD VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

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
