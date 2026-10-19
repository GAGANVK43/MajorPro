import assert from "node:assert/strict";
import {
  interpretAnswer,
  interpretTranscript,
  normalizeIndicDigits,
  wordsToNumber,
} from "../src/pages/Assessment/VoiceEngine.js";

console.log("==================================================");
console.log("   DIASENSE AI — VOICE ENGINE MULTILINGUAL TESTS  ");
console.log("==================================================");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// 1. Indic Digit Normalization
runTest("Normalizes Kannada digits ೦-೯ to ASCII 0-9", () => {
  assert.equal(normalizeIndicDigits("೪೫"), "45");
  assert.equal(normalizeIndicDigits("೧೭೦"), "170");
  assert.equal(normalizeIndicDigits("೬೫.೫"), "65.5");
});

runTest("Normalizes Devanagari digits ०-९ to ASCII 0-9", () => {
  assert.equal(normalizeIndicDigits("४५"), "45");
  assert.equal(normalizeIndicDigits("१७०"), "170");
});

// 2. Word numbers
runTest("Interprets Kannada spoken number words", () => {
  assert.equal(wordsToNumber("ನಲವತ್ತೈದು"), 45);
  assert.equal(wordsToNumber("ನಲವತ್ತು"), 40);
  assert.equal(wordsToNumber("ಇಪ್ಪತ್ತೈದು"), 25);
});

// 3. Kannada Categorical Answers (Bug 1 Root Cause Verification)
runTest("Interprets Kannada 'ನಗರ' as Urban for patientGroup", () => {
  const res = interpretAnswer({ transcript: "ನಗರ", field: "patientGroup", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "Urban");
});

runTest("Interprets Kannada 'ಗ್ರಾಮೀಣ' as Rural for patientGroup", () => {
  const res = interpretAnswer({ transcript: "ಗ್ರಾಮೀಣ", field: "patientGroup", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "Rural");
});

runTest("Interprets Kannada 'ಅರೆ-ನಗರ' as Semi-Urban (avoids substring collision with ನಗರ)", () => {
  const res = interpretAnswer({ transcript: "ಅರೆ-ನಗರ", field: "patientGroup", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "Semi-Urban");
});

runTest("Interprets Kannada 'ಪುರುಷ' as Male for gender", () => {
  const res = interpretAnswer({ transcript: "ಪುರುಷ", field: "gender", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "Male");
});

runTest("Interprets Kannada 'ಮಹಿಳೆ' as Female for gender", () => {
  const res = interpretAnswer({ transcript: "ಮಹಿಳೆ", field: "gender", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "Female");
});

runTest("Interprets Kannada 'ಹೌದು' as 1 for familyHistory", () => {
  const res = interpretAnswer({ transcript: "ಹೌದು", field: "familyHistory", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "1");
});

runTest("Interprets Kannada 'ಇಲ್ಲ' as 0 for familyHistory", () => {
  const res = interpretAnswer({ transcript: "ಇಲ್ಲ", field: "familyHistory", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "0");
});

// 4. Cross-Field Rejection Tests (No False Positives)
runTest("Rejects 'ನಗರ' when field is gender", () => {
  const res = interpretAnswer({ transcript: "ನಗರ", field: "gender", lang: "kn" });
  assert.notEqual(res.status, "valid");
  assert.equal(res.value, null);
});

runTest("Rejects 'ಪುರುಷ' when field is patientGroup", () => {
  const res = interpretAnswer({ transcript: "ಪುರುಷ", field: "patientGroup", lang: "kn" });
  assert.notEqual(res.status, "valid");
  assert.equal(res.value, null);
});

// 5. Spoken Kannada Numeric Measurements
runTest("Interprets Kannada digits '೪೫' as age 45", () => {
  const res = interpretAnswer({ transcript: "೪೫", field: "age", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "45");
});

runTest("Interprets conversational Kannada 'ನನ್ನ ವಯಸ್ಸು ೪೫' as age 45", () => {
  const res = interpretAnswer({ transcript: "ನನ್ನ ವಯಸ್ಸು ೪೫", field: "age", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "45");
});

runTest("Interprets Kannada digits '೧೬೮' as height 168 cm", () => {
  const res = interpretAnswer({ transcript: "೧೬೮ ಸೆಂ.ಮೀ", field: "height", lang: "kn" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "168");
});

// 6. Conversational stripping and units
runTest("Converts imperial height '5 feet 7 inches' to cm", () => {
  const res = interpretAnswer({ transcript: "5 feet 7 inches", field: "height", lang: "en" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "170");
});

runTest("Converts weight '150 pounds' to kg", () => {
  const res = interpretAnswer({ transcript: "150 pounds", field: "weight", lang: "en" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "68");
});

runTest("Interprets BP ratio '120/80'", () => {
  const res = interpretAnswer({ transcript: "120/80", field: "bloodPressure", lang: "en" });
  assert.equal(res.status, "valid");
  assert.equal(res.value, "120");
});

// 7. Backward-compatible wrapper interpretTranscript
runTest("Wrapper interpretTranscript works with legacy callers", () => {
  const res = interpretTranscript("ನಗರ", "patientGroup", "kn");
  assert.ok(res);
  assert.equal(res.value, "Urban");

  const invalidRes = interpretTranscript("xyz_invalid", "patientGroup", "kn");
  assert.equal(invalidRes, null);
});

console.log("==================================================");
console.log(`RESULTS: ${passed}/${total} tests passed.`);
console.log("==================================================");

if (passed !== total) {
  process.exit(1);
}
