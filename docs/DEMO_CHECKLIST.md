# DiaSense AI — Live Major Project Demonstration Checklist

**Audience:** Project Examiners, Technical Evaluators, and Demonstration Reviewers  
**Estimated Walkthrough Time:** 8–10 Minutes

---

## Pre-Demo Quick Verification (1 Minute)

- [ ] **Backend Status:** Ensure FastAPI backend is running on `http://127.0.0.1:8000`.
  - Check health: `curl http://127.0.0.1:8000/health` (Returns `{"status": "healthy"}`).
- [ ] **Frontend Status:** Ensure Vite development server is running on `http://localhost:5173`.
- [ ] **Browser:** Open Chrome or Edge at `http://localhost:5173`.

---

## Demonstration Script & Step-by-Step Flow

### Stage 1: Initial Landing & Authentication (1 Minute)
1. Navigate to `http://localhost:5173/`.
2. Point out:
   - Modern medical UI styling with localized language support.
   - Click the language selector in the top navbar and switch between **English**, **Hindi (हिंदी)**, and **Kannada (ಕನ್ನಡ)**.
3. Sign In or Register a new user:
   - Email: `demo_evaluator@diasense.ai`
   - Password: `Password123!`

---

### Stage 2: Dashboard Real Data Integration & Onboarding Empty State (1.5 Minutes)
1. On login with a new user account, observe the **Dashboard**:
   - **No Fabricated Data:** The Health Score shows `--`, Risk shows `Not Screened`, BMI shows `--`.
   - **Onboarding Banner:** A prominent card displays: *"Establish Your Personal Metabolic Baseline — Complete our comprehensive 2-minute screening to calculate your verified clinical health score..."*
   - Highlight to examiners: *"Unlike typical student demos that hardcode '82/100' or '24.5 BMI' for new users, DiaSense AI strictly enforces honest data integrity."*

---

### Stage 3: Clinical Health Assessment (2 Minutes)
1. Click **"Start Health Screening Now"** (or navigate to `/assessment`).
2. Fill in the screening parameters:
   - Age: `45`
   - BMI: `28.2`
   - Fasting Glucose: `142` mg/dL
   - Blood Pressure: `135` mmHg
3. Leave optional lifestyle fields empty (or provide partial values) to demonstrate null handling:
   - Point out to examiners: *"Omitted lifestyle fields are sent as `null`, allowing the backend median imputer to function without injecting biased assumptions (such as the 30g sugar bug we eradicated)."*
4. Click **"Analyze Diabetes Risk"**.

---

### Stage 4: Result Interpretation & Explainability (1.5 Minutes)
1. Observe the **Result Page**:
   - **Clinical Terminology:** Risk gauge displays **"Elevated Risk Pattern"** (honest clinical screening terminology, not definitive medical diagnosis).
   - **Model Accuracy Badge:** Shows verified XGBoost model test metrics.
   - **Feature Importance Explainability:** Review the top contributing biomarkers (e.g., Fasting Glucose, BMI).
   - **Baseline Milestone Card:** Displays *"🎯 Baseline Screening Established — Your first clinical screening sets your metabolic benchmark"* rather than an invented upward risk line.
2. Click **"View Personalized Diet Plan"** to see Indian meal recommendations.

---

### Stage 5: Food AI Analyzer & Nutrition Engine (2 Minutes)
1. Navigate to `/food-analyzer`.
2. **Text Meal Mode:**
   - Type `"Palak Paneer with Roti"` or click a quick chip.
   - Click **Search**.
   - Observe the instant breakdown: Calories, Carbs, Protein, Glycemic Index (GI), Net Carbs, and Diabetic Suitability badge.
3. **Food Vision Mode:**
   - Switch to the **AI Food Image Recognition** tab.
   - Upload any meal image (or sample photo).
   - Point out:
     - **Confidence Match Badge:** Shows match percentage and detection source (`knowledge_base`, `perceptual_visual_analysis`, or `gemini_vision`).
     - **Suggested Alternatives:** Interactive chips allowing one-click re-analysis if the meal has multiple interpretations.
     - **Inline Dish Correction Box:** Demonstrate typing `"Moong Dal Khichdi"` and clicking **Recalculate** directly from the results card.

---

### Stage 6: Real-Time Nearby Care Locator (1.5 Minutes)
1. Navigate to `/find-care`.
2. Click **"Use My Current Location"** (or type a known PIN code like `560001` or `560049`).
3. Point out:
   - **Two Distinct Categories:** Switch between **Nearby Hospitals & Clinics** and **Diabetes Diagnostic Labs**.
   - **Haversine Distance Sorting:** Facilities are strictly ordered from nearest to farthest.
   - **Actionable Directions:** Click **"Get Directions"** to demonstrate immediate Google Maps navigation link generation.
   - **Resilience:** Point out multi-mirror Overpass OSM integration and authentic offline Indian healthcare hubs fallback.

---

### Stage 7: PDF Clinical Report Generation (1 Minute)
1. Navigate to `/reports` (or click **"Clinical Reports"** from Dashboard).
2. Click **"Download Official Clinical Report"**.
3. Open the generated PDF:
   - Formatted clinical layout with patient details, biomarker scores, risk stratification, Indian dietary schedule, and medical disclaimer.
