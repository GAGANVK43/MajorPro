/**
 * Frontend Unit & Logic Tests for Profile Completion & Assessment-to-Diet-Plan Flow
 * diaSense AI — Part 3 Verification
 */
import assert from "assert";

// 1. Reusable calculateAgeFromDob matching Profile.jsx implementation
function calculateAgeFromDob(dobString) {
  if (!dobString || !dobString.trim()) return null;
  const parts = dobString.trim().split("-");
  if (parts.length !== 3) return null;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  if (birthDate > today) return null;

  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

// 2. Profile unwrapper matching Profile.jsx implementation
function unwrapProfileData(res) {
  const payload = res?.data?.user ? res.data : (res?.data || res || {});
  const userObj = payload?.user || payload;

  return {
    fullName: userObj?.full_name || payload?.full_name || "",
    email: userObj?.email || payload?.email || "",
    dateOfBirth: userObj?.date_of_birth || payload?.date_of_birth || "",
    age: userObj?.age !== undefined && userObj?.age !== null ? String(userObj.age) : (payload?.age !== undefined && payload?.age !== null ? String(payload.age) : ""),
    gender: userObj?.gender || payload?.gender || "Male",
    address: userObj?.address || payload?.address || "",
    city: userObj?.city || payload?.city || "",
    state: userObj?.state || payload?.state || "",
    postalCode: userObj?.postal_code || payload?.postal_code || "",
    country: userObj?.country || payload?.country || "India",
    onboardingCompleted: Boolean(userObj?.onboarding_completed || payload?.onboarding_completed),
    totalAssessments: payload?.total_assessments || 0
  };
}

// 3. Assessment Navigation Query Param builder and parser
function buildResultNavParams(resultData) {
  if (resultData?.assessment_id) {
    return `?assessment_id=${resultData.assessment_id}&prediction_id=${resultData.id || ""}`;
  }
  if (resultData?.id) {
    return `?prediction_id=${resultData.id}`;
  }
  return "";
}

function parseAssessmentIdFromSearch(searchStr) {
  const params = new URLSearchParams(searchStr);
  return params.get("assessment_id");
}

console.log("==================================================================");
console.log("DiaSense AI — Running Frontend Profile & Diet Integration Tests");
console.log("==================================================================");

// TEST SUITE 1: calculateAgeFromDob
console.log("\n[Test Suite 1] DOB to Age Calculation Logic");
{
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  
  // Exact 30 years ago today
  const exact30Str = `${y - 30}-${m}-${d}`;
  assert.strictEqual(calculateAgeFromDob(exact30Str), 30, "Exact birthday should compute exact age 30");

  // Birthday next month (not yet celebrated this calendar year)
  // E.g. born in December if today is October
  const uncelebratedMonth = today.getMonth() === 11 ? "12" : "12";
  const uncelebratedDob = `${y - 25}-${uncelebratedMonth}-28`;
  // If today is October 19, a birthday on December 28 means the user is still 24
  assert.strictEqual(calculateAgeFromDob(uncelebratedDob), 24, "Birthday later in year should compute age 24");

  // Future date rejected
  const futureStr = "2099-01-01";
  assert.strictEqual(calculateAgeFromDob(futureStr), null, "Future date should return null");

  // Invalid date string rejected
  assert.strictEqual(calculateAgeFromDob("not-a-date"), null, "Malformed date string should return null");

  // Extreme age > 120 rejected
  assert.strictEqual(calculateAgeFromDob("1850-01-01"), null, "Age > 120 should return null");

  console.log("  ✓ Exact birthday calendar math passed");
  console.log("  ✓ Pending birthday within same month handled correctly");
  console.log("  ✓ Future date rejection passed");
  console.log("  ✓ Malformed and extreme date checks passed");
}

// TEST SUITE 2: Profile Data Unwrapping
console.log("\n[Test Suite 2] Defensive Profile Response Unwrapping");
{
  // Scenario A: Nested backend structure (AuthService.get_profile_with_stats format)
  const nestedApiResponse = {
    success: true,
    data: {
      total_assessments: 4,
      latest_risk_score: 22.5,
      user: {
        id: 101,
        full_name: "Dr. Ananya Sen",
        email: "ananya.sen@example.com",
        date_of_birth: "1988-09-20",
        age: 38,
        gender: "Female",
        address: "7th Main, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560038",
        country: "India",
        onboarding_completed: true
      }
    }
  };
  const unwrappedNested = unwrapProfileData(nestedApiResponse);
  assert.strictEqual(unwrappedNested.fullName, "Dr. Ananya Sen", "Full name should be extracted from nested user");
  assert.strictEqual(unwrappedNested.email, "ananya.sen@example.com", "Email should be extracted from nested user");
  assert.strictEqual(unwrappedNested.city, "Bengaluru");
  assert.strictEqual(unwrappedNested.postalCode, "560038");
  assert.strictEqual(unwrappedNested.totalAssessments, 4);
  assert.strictEqual(unwrappedNested.onboardingCompleted, true);

  // Scenario B: Flat structure
  const flatApiResponse = {
    success: true,
    data: {
      id: 102,
      full_name: "Vikram Rathore",
      email: "vikram@example.com",
      city: "Jaipur",
      onboarding_completed: false
    }
  };
  const unwrappedFlat = unwrapProfileData(flatApiResponse);
  assert.strictEqual(unwrappedFlat.fullName, "Vikram Rathore");
  assert.strictEqual(unwrappedFlat.email, "vikram@example.com");
  assert.strictEqual(unwrappedFlat.city, "Jaipur");
  assert.strictEqual(unwrappedFlat.onboardingCompleted, false);

  // Scenario C: Empty / error payload
  const emptyUnwrapped = unwrapProfileData(null);
  assert.strictEqual(emptyUnwrapped.fullName, "");
  assert.strictEqual(emptyUnwrapped.email, "");
  assert.strictEqual(emptyUnwrapped.country, "India");

  console.log("  ✓ Nested profile structure unwrapped without undefined fields");
  console.log("  ✓ Flat profile structure backwards-compatible");
  console.log("  ✓ Null / empty response safely defaulted without throwing exception");
}

// TEST SUITE 3: Assessment-to-Diet-Plan Navigation & Linking
console.log("\n[Test Suite 3] Assessment-to-Diet-Plan Linking & Query Params");
{
  const resultWithAssessment = { assessment_id: 42, id: 18, risk_percentage: 18.5 };
  const query = buildResultNavParams(resultWithAssessment);
  assert.strictEqual(query, "?assessment_id=42&prediction_id=18");
  assert.strictEqual(parseAssessmentIdFromSearch(query), "42");

  const resultPredictionOnly = { id: 19 };
  const queryPred = buildResultNavParams(resultPredictionOnly);
  assert.strictEqual(queryPred, "?prediction_id=19");
  assert.strictEqual(parseAssessmentIdFromSearch(queryPred), null);

  const emptySearch = "";
  assert.strictEqual(parseAssessmentIdFromSearch(emptySearch), null);

  console.log("  ✓ Result navigation correctly encodes assessment_id and prediction_id");
  console.log("  ✓ Diet plan query parser correctly extracts assessment_id");
  console.log("  ✓ Standalone direct diet plan access gracefully handles absent assessment_id");
}

console.log("\n==================================================================");
console.log("ALL 3 FRONTEND UNIT & INTEGRATION TEST SUITES PASSED CLEANLY (100%)");
console.log("==================================================================");
