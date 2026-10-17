# DiaSense AI — Core Feature Reliability, Accuracy & UX Audit

**Audit Date:** October 17, 2026  
**Auditor:** 20-Specialist Elite Engineering Panel  
**Repository:** `GAGANVK43/MajorPro`  
**Working Directory:** `DiaSenseAI/project_src`  
**Execution Environment:** Windows Server / Local Python 3.14 / Node v18+  

---

## 1. Scope & Objective

This audit investigates the end-to-end functionality, data integrity, machine learning fidelity, and user experience of DiaSense AI across four primary feature domains:
1. **Assessment & Risk Prediction Workflow:** User input through to ML inference, threshold calibration, and result delivery.
2. **Food Recognition & Nutrition Analysis:** Vision multimodal pipeline, fallback heuristics, and nutritional accuracy.
3. **Find Care (Location-Based Healthcare Discovery):** Geocoding, Overpass API, Nominatim fallback, and distance calculations.
4. **Dashboard Data Architecture:** Authentication isolation, real record binding, and elimination of hardcoded metric cards.

---

## 2. Priority 1: Assessment & Risk Prediction Audit

### 2.1 Complete Architectural Data Flow
```
[User Interface]
  ├── Manual Form Entry (Multi-step wizard)
  ├── Voice Input (SpeechRecognition + regex parser)
  └── Medical Lab Report (PDF/Image OCR extraction)
         │
         ▼
[Frontend Validation & Normalization] (Assessment.jsx)
  ├── Canonical Schema validation (min/max boundaries)
  └── Payload formatting (snake_case conversion)
         │
         ▼
[REST API] POST /api/prediction (or /api/assessment)
         │
         ▼
[Backend Pydantic Schema] (PredictionRequest / AssessmentCreate)
         │
         ▼
[ML Inference Engine] (app/ml/prediction_v2.py)
  ├── _build_input_dataframe()
  ├── add_engineered_features() (zero-leakage parity with training)
  ├── Pipeline Execution: Imputer (median/mode) -> Scaler -> OneHot -> GradientBoosting
  └── Decision Threshold Evaluation (0.31)
         │
         ▼
[Database Persistence] (SQLite / PostgreSQL)
  ├── models.Assessment record
  └── models.Prediction record (linked by foreign key)
         │
         ▼
[Result Delivery] (/result & /dashboard)
```

### 2.2 Critical Findings in Assessment Workflow
1. **Frontend Fabricating Default Health Parameters:**
   - **Location:** `frontend/src/pages/Assessment/Assessment.jsx` lines 474–486.
   - **Defect:** If a user omits optional lifestyle or physical metrics, the submit handler injects arbitrary values:
     `blood_pressure: 120.0`, `physical_activity_hours: 2.0`, `daily_sugar_intake: 30.0`, `fast_food_frequency: 2.0`, `sleep_hours: 7.0`.
   - **Impact:** `Daily_Sugar_Intake` accounts for **27.09%** of feature importance in the model. Arbitrarily assigning 30g per day fundamentally distorts the risk prediction.
   - **Root Cause:** Incomplete handling of optional fields; frontend developer assumed default values were necessary to satisfy backend schema.
   - **Remediation:** Pass `None`/`null` for omitted fields. Allow the scikit-learn training-calibrated median imputer in `diabetes_pipeline_v2.pkl` to handle missing values or prompt the user transparently.

2. **Categorical Labeling & Medical Screening Boundaries:**
   - **Location:** `backend/app/ml/prediction_v2.py` (L327).
   - **Defect:** Output label was set to `"Diabetic"` vs `"Non-Diabetic"`.
   - **Impact:** Calling an individual "Diabetic" implies definitive diagnosis, violating clinical screening guidelines.
   - **Remediation:** Standardize presentation labels to `"Elevated Risk Pattern"` and `"Lower Risk Pattern"`, accompanied by clear screening disclaimers.

3. **Fabricated Trend Chart on Result Page:**
   - **Location:** `frontend/src/pages/Result/Result.jsx` lines 27–32.
   - **Defect:** A static, hardcoded array `trendData = [{ month: "Assess 1", risk: 45 }, { month: "Assess 2", risk: 52 }, { month: "Assess 3", risk: 65 }, { month: "Current", risk: 78 }]` was displayed as a real patient risk trajectory.
   - **Impact:** Misleads users into believing their risk is actively escalating.
   - **Remediation:** Connect the Recharts component directly to `predictionService.getHistory()`. If only one assessment exists, display a clear single-point baseline badge rather than an imaginary rising curve.

---

## 3. Priority 2: Food Analysis Reliability Audit

### 3.1 Complete Pipeline Trace
```
Image File / Typed Text
         │
         ▼
[Frontend Upload] (FoodAnalyzer.jsx)
  └── FormData.append("file", selectedFile) -> POST /api/food/analyze-image
         │
         ▼
[Backend Route] (food_routes.py)
         │
         ▼
[Service Logic] (food_analyzer_service.py)
  ├── Check self.api_key (GEMINI_API_KEY)
  │     ├── IF Present: Call Generative Vision API
  │     └── IF Absent / Fails: Fallback Heuristic
  │           └── Inspect filename string:
  │                 ├── "chicken" in fn -> "Roasted Chicken"
  │                 ├── "dosa" in fn -> "Oats Dosa"
  │                 └── ELSE -> "Moong Dal Khichdi"
```

### 3.2 Critical Findings in Food Analyzer
1. **Filename-Dependent Blind Fallback:**
   - **Location:** `backend/app/services/food_analyzer_service.py` lines 231–251.
   - **Root Cause:** When `GEMINI_API_KEY` is not present in `.env` (which is the default local setup), `analyze_food_image` inspects `filename.lower()`. Mobile camera snapshots and web file drops produce names like `image_1790621437020.png`, `camera.jpg`, or `blob`.
   - **Evidence:** None of these filenames match keywords like "chicken" or "dosa". Consequently, **100% of photographic uploads evaluate to "Moong Dal Khichdi" (or previously "Avocado Quinoa Salad")**, regardless of whether the picture shows a pizza, apple, or samosa.
   - **Remediation:**
     - Check image properties and reject unidentifiable/corrupt images.
     - Implement perceptual color and texture feature extraction (hue, saturation, brightness, entropy) to detect basic food color clusters (e.g. green leafy vs yellow lentils vs red curry).
     - Provide an honest "Vision Model Offline / Low Confidence" state that displays the detected color profile and prompts the user to select or confirm the dish name.
     - Allow the user to edit or re-type the meal name with instant re-calculation against the 50+ item clinical nutrition knowledge base.

2. **Frontend State Overwrites & Missing Error States:**
   - **Location:** `frontend/src/pages/FoodAnalyzer/FoodAnalyzer.jsx`.
   - **Defect:** No visual differentiation between an uncalibrated low-confidence guess and a high-confidence match. Switching between image and text modes retains stale results from the other mode.
   - **Remediation:** Add confidence indicators, clear previous results on new submission, and provide an interactive meal name correction input.

---

## 4. Priority 3: Find Care (Healthcare Facilities) Audit

### 4.1 Pipeline Trace
```
User Location Request (GPS Browser API or Manual City/PIN Input)
         │
         ▼
[Geocoding Engine] (nearby_care_service.py::geocode_location)
  ├── Tier 1: Known Indian PIN Clusters (560049, 560001, 110001, etc.) -> Instant
  ├── Tier 2: Nominatim OpenStreetMap Geocoder (Structured query)
  └── Tier 3: Nominatim Free-text search
         │
         ▼
[Overpass POI Search]
  ├── Query: node/way/relation [amenity=hospital|clinic|doctors] around radius
  └── Endpoints: 5 distributed Overpass mirrors
         │
         ▼
[Fallback POI Engine] (If Overpass times out / 429 / 504)
  └── Nominatim Bounded Bounding-Box POI search
         │
         ▼
[Distance Calculation & Sorting]
  ├── Geodesic Haversine formula (km)
  ├── Deduplication by OSM ID / Coordinates
  └── Sort ascending by distance
```

### 4.2 Findings in Find Care
1. **Strengths:** Haversine distance calculation is mathematically sound. PIN code geocoding for major Indian hubs works instantly without external API latency.
2. **Gaps:**
   - When external OpenStreetMap mirrors experience rate limits (common during automated testing), the fallback must guarantee relevant facilities rather than returning a blank screen.
   - Categories should explicitly cover:
     - Hospitals
     - Medical Clinics
     - Diagnostic & Pathology Laboratories
     - Pharmacies
   - Map View currently shows a static illustration rather than interactive coordinates.

---

## 5. Priority 4: Dashboard Data Architecture Audit

### 5.1 Pipeline Trace
```
Authenticated User Navigates to /dashboard
         │
         ▼
GET /api/dashboard & GET /api/prediction/history
         │
         ▼
[Dashboard Service] (dashboard_service.py)
  ├── Latest Prediction from prediction_repo
  ├── Latest Assessment from assessment_repo
  └── Active Diet Plan from diet_repo
```

### 5.2 Critical Findings in Dashboard
1. **Fabricated Metrics on Missing Records:**
   - **Location:** `backend/app/services/dashboard_service.py` lines 31–33 & `frontend/src/pages/Dashboard/Dashboard.jsx` lines 17–23.
   - **Defect:** If a newly registered user with zero assessments views the dashboard, the backend defaults to `health_score = 90` and `risk_level = "Normal"`. Furthermore, the frontend `useState` defaulted to `healthScore: 82`, `riskLevel: "Low Risk"`, `bmi: "24.5"`, and `lastAssessment: "Today"`.
   - **Impact:** A brand-new patient with no recorded clinical data sees a fabricated medical profile claiming optimal health and 24.5 BMI.
   - **Remediation:**
     - Return `null` for `latest_prediction`, `latest_bmi`, and `health_score` when no assessments exist.
     - Frontend must render an Onboarding Empty State ("Welcome to DiaSense AI — Complete your first screening to generate your personalized health dashboard").

---

## 6. Audit Conclusion & Phase Transition

The audit reveals that while the machine learning model itself is genuine and well-calibrated (82.27% accuracy on 25,500 Indian patients), several frontend-to-backend integration seams were relying on hardcoded defaults and fallback shortcuts. 

Phase 1 issues have been cataloged in `docs/CORE_FEATURE_ISSUES.md`. The remediation will proceed systematically through Phases 2 to 6.
