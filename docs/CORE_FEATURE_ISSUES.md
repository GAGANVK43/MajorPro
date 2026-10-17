# DiaSense AI — Core Feature Issue Log & Root Cause Analysis

**Log Date:** October 17, 2026  
**Auditor:** 20-Specialist Elite Engineering Panel  
**Document Purpose:** Detailed defect specifications, reproduction steps, root cause traces, and remediation designs for Core Priorities 1–4.  

---

## Issue Summary Matrix

| Issue ID | Priority Domain | Title | Severity | Status |
|---|---|---|---|---|
| **CFI-001** | Priority 1: Assessment | Frontend Injecting Default Health Values on Optional Fields | **CRITICAL** | OPEN |
| **CFI-002** | Priority 1: Assessment | Fabricated Risk Trajectory Curve on Result Page | **HIGH** | OPEN |
| **CFI-003** | Priority 1: Assessment | Uncalibrated Diagnostic Classification Terminology | **HIGH** | OPEN |
| **CFI-004** | Priority 2: Food Analysis | Filename-Based Blind Fallback for Image Analysis | **CRITICAL** | OPEN |
| **CFI-005** | Priority 2: Food Analysis | Missing Dish Correction & Ambiguity Feedback in Food UI | **MEDIUM** | OPEN |
| **CFI-006** | Priority 3: Find Care | Resilient Facility Caching & Category Granularity | **MEDIUM** | OPEN |
| **CFI-007** | Priority 4: Dashboard | Fabricated Default Health Scores for First-Time Users | **HIGH** | OPEN |

---

## Detailed Defect Specifications

### CFI-001: Frontend Injecting Default Health Values on Optional Fields

#### 1. Severity: CRITICAL
- **Component:** Assessment Frontend & Machine Learning Pipeline
- **Affected Files:**
  - `frontend/src/pages/Assessment/Assessment.jsx` (L474–486)
  - `backend/app/schemas/prediction_schema.py`

#### 2. Reproduction Steps
1. Navigate to `/assessment`.
2. Choose "Enter Details Manually" and fill required Step 1 fields (Age: 45, Gender: Male, Height: 172 cm, Weight: 74 kg).
3. On Step 2 and Step 3, leave optional fields blank (e.g., skip Blood Pressure and Daily Sugar Intake).
4. Inspect the outgoing network payload for `POST /api/prediction`.

#### 3. Evidence
Outgoing JSON in browser Network DevTools:
```json
{
  "age": 45,
  "gender": "Male",
  "bmi": 25.0,
  "blood_pressure": 120.0,
  "physical_activity_hours": 2.0,
  "daily_sugar_intake": 30.0,
  "fast_food_frequency": 2.0,
  "sleep_hours": 7.0
}
```

#### 4. Root Cause
In `Assessment.jsx`:
```javascript
const payload = {
  patient_group: formData.patientGroup || "Urban",
  age: formData.age ? parseInt(formData.age, 10) : null,
  gender: formData.gender || "Male",
  bmi: formData.bmi ? parseFloat(formData.bmi) : null,
  blood_pressure: formData.bloodPressure ? parseFloat(formData.bloodPressure) : 120.0,
  physical_activity_hours: formData.physicalActivityHours ? parseFloat(formData.physicalActivityHours) : 2.0,
  daily_sugar_intake: formData.dailySugarIntake ? parseFloat(formData.dailySugarIntake) : 30.0,
  fast_food_frequency: formData.fastFoodFrequency ? parseFloat(formData.fastFoodFrequency) : 2.0,
  sleep_hours: formData.sleepHours ? parseFloat(formData.sleepHours) : 7.0,
};
```
The ternary operators fall back to arbitrary constants (`30.0`, `2.0`, `120.0`) instead of sending `null`. Because `Daily_Sugar_Intake` represents 27.09% of model feature importance, this fabricated 30g value skews the risk score.

#### 5. Proposed Fix
- Change all optional fallbacks to `null`.
- In `backend/app/ml/prediction_v2.py`, ensure missing fields are imputed strictly through the training-calibrated median imputer inside the serialized scikit-learn pipeline.

#### 6. Regression Test
- `tests/test_prediction_v2.py::test_prediction_with_null_optionals` verifying that omitted fields produce consistent inference using median imputations.

---

### CFI-002: Fabricated Risk Trajectory Curve on Result Page

#### 1. Severity: HIGH
- **Component:** Result Page UI & History Binding
- **Affected Files:**
  - `frontend/src/pages/Result/Result.jsx` (L27–32)

#### 2. Reproduction Steps
1. Complete a single health assessment.
2. View the Result Page.
3. Observe the "Historical Risk Trend" chart.

#### 3. Evidence
In `Result.jsx`:
```javascript
const trendData = [
  { month: t("result.assess1"), risk: 45 },
  { month: t("result.assess2"), risk: 52 },
  { month: t("result.assess3"), risk: 65 },
  { month: t("result.currentAssess"), risk: 78 },
];
```

#### 4. Root Cause
The component hardcoded four data points (45%, 52%, 65%, 78%) giving the false impression that the patient's diabetes risk is steadily escalating across past assessments.

#### 5. Proposed Fix
- Fetch actual historical assessments from `predictionService.getHistory()`.
- If only one assessment exists, display a clear single-point baseline badge rather than an imaginary rising curve.
- If multiple records exist, plot the genuine historical risk percentages against real assessment dates.

#### 6. Regression Test
- Unit test in frontend and API test ensuring historical chart renders genuine timestamps and probabilities.

---

### CFI-003: Uncalibrated Diagnostic Classification Terminology

#### 1. Severity: HIGH
- **Component:** Machine Learning Output & Clinical Guidance
- **Affected Files:**
  - `backend/app/ml/prediction_v2.py` (L327)
  - `frontend/src/pages/Result/Result.jsx`

#### 2. Reproduction Steps
1. Execute `POST /api/prediction` with elevated parameters.
2. Observe `prediction_label` in response.

#### 3. Evidence
Response returns `"prediction_label": "Diabetic"`.

#### 4. Root Cause
The legacy system equated exceeding the screening threshold (0.31) with a medical diagnosis of "Diabetic". Under WHO/ADA clinical standards, tabular risk screening models can only identify an **"Elevated Risk Pattern"** warranting lab confirmation.

#### 5. Proposed Fix
- Standardize labels to `"Elevated Risk Pattern"` (or `"High Risk Pattern"`) and `"Lower Risk Pattern"`.
- Provide schema-compatible aliasing so existing database records and legacy frontend components remain backwards-compatible.
- Display a prominent medical disclaimer stating that this output is not a clinical diagnosis.

---

### CFI-004: Filename-Based Blind Fallback for Image Analysis

#### 1. Severity: CRITICAL
- **Component:** Food Nutrition Vision Service
- **Affected Files:**
  - `backend/app/services/food_analyzer_service.py` (L231–251)

#### 2. Reproduction Steps
1. Take a photo of an apple or a pizza using a smartphone or web camera.
2. Upload the photo to `/api/food/analyze-image`.
3. Observe the returned dish name.

#### 3. Evidence
Because the photo filename is `image_1790621437020.png` or `blob`, and `GEMINI_API_KEY` is not present locally, the code executes:
```python
fn_lower = filename.lower().strip()
if any(w in fn_lower for w in ["chicken"]): target_dish = "Roasted Chicken"
...
else: target_dish = "Moong Dal Khichdi"
```
The result is always "Moong Dal Khichdi", regardless of what food was photographed.

#### 4. Root Cause
The service lacked local image processing or perceptual heuristics when the cloud vision API key was absent, falling back solely to keyword matching on the filename.

#### 5. Proposed Fix
1. Validate image decodability, resolution, and dimensions via PIL.
2. Extract dominant color clusters and image entropy to detect coarse visual categories (e.g., green vegetables vs. yellow lentils vs. red curries vs. baked flatbreads).
3. If vision API is absent, return a transparent "Offline / Low Confidence" status, indicate the detected color profile, and present a selectable list of Indian food staples for the user to confirm.
4. Allow the user to edit or re-type the meal name with instant recalculation against the 50+ item clinical nutrition knowledge base.

#### 6. Regression Test
- `tests/test_food_analysis.py` covering diverse image uploads, ensuring different image contents are inspected and processed.

---

### CFI-005: Missing Dish Correction & Ambiguity Feedback in Food UI

#### 1. Severity: MEDIUM
- **Component:** Food Analyzer Frontend
- **Affected Files:**
  - `frontend/src/pages/FoodAnalyzer/FoodAnalyzer.jsx`

#### 2. Reproduction Steps
1. Upload an ambiguous food photo.
2. If the AI detects "Palak Paneer" when the user actually photographed "Sarson Ka Saag", the user has no way to correct it without starting over in the text tab.

#### 3. Root Cause
The UI lacked an inline "Edit Dish Name" or "Not what you're eating?" correction affordance.

#### 4. Proposed Fix
- Add an editable dish name field with a "Recalculate Nutrition" action.
- Add clear state indicators for Loading, Success, Low-Confidence, and Error.
- Scope results to avoid stale cross-tab state.

---

### CFI-006: Resilient Facility Caching & Category Granularity

#### 1. Severity: MEDIUM
- **Component:** Nearby Care & Geocoding Service
- **Affected Files:**
  - `backend/app/services/nearby_care_service.py`
  - `frontend/src/pages/FindCare/FindCare.jsx`

#### 2. Root Cause
When public OpenStreetMap Overpass mirrors throttle automated queries (HTTP 429), the secondary Nominatim fallback queried only general keywords. If both external APIs failed, the user received an empty error screen.

#### 3. Proposed Fix
- Provide pre-cached verified regional facility clusters for major urban districts.
- Support 4 clear facility tabs: Hospitals, Clinics, Diagnostic Labs, and Pharmacies.
- Ensure Haversine distance calculations are displayed with exact distance units.

---

### CFI-007: Fabricated Default Health Scores for First-Time Users

#### 1. Severity: HIGH
- **Component:** Dashboard Service & UI
- **Affected Files:**
  - `backend/app/services/dashboard_service.py` (L31–33)
  - `frontend/src/pages/Dashboard/Dashboard.jsx` (L17–23)

#### 2. Reproduction Steps
1. Register a new user account.
2. Navigate directly to `/dashboard` before completing any assessment.
3. Observe the displayed Health Score and Risk Level.

#### 3. Evidence
Dashboard displays:
- Health Score: 82 / 100
- Diabetes Risk: Low Risk (24.5%)
- BMI Score: 24.5 kg/m²
- Last Screening: "Today"

#### 4. Root Cause
Initial state and backend service defaulted to placeholder values when no records existed in the database.

#### 5. Proposed Fix
- Backend returns `None` for health summary fields when assessments are empty.
- Frontend renders an Onboarding Empty State banner: "Welcome to DiaSense AI — Complete your first screening to see your health score and risk analysis."

#### 6. Regression Test
- `tests/test_dashboard.py` verifying that new users with 0 assessments receive `null` metrics and no fabricated values.
