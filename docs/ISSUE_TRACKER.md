# DiaSense AI — Systematic Issue Tracker & Defect Log

**Generated Date:** October 17, 2026  
**Auditor:** DiaSense Engineering Team (20-Specialist Audit Panel)  
**Repository:** `GAGANVK43/MajorPro` (Branch: `main`)  
**Current Baseline Commit:** `34b4094`

---

## Issue Summary Matrix

| ID | Title | Component | Severity | Impact | Status |
|---|---|---|---|---|---|
| **ISS-001** | Remote PostgreSQL (Supabase) Tenant Not Found | Backend / Database | **HIGH** | Breaks remote DB persistence; relies on fallback SQLite | **MITIGATED (SQLite Engine)** |
| **ISS-002** | Dual Model Pipeline Conflict (v1 vs v2) | Backend / ML | **HIGH** | Inconsistent prediction logic; memory waste; confusing metrics | **RESOLVED** |
| **ISS-003** | IDOR Security Vulnerability in Report Download | Backend / Security | **HIGH** | Unauthorized cross-user report access; fails automated test | **RESOLVED** |
| **ISS-004** | Prediction Label Assertion Mismatch in Pytest | Backend / Tests | **MEDIUM** | Pytest failure on inference output labels | **RESOLVED** |
| **ISS-005** | PredictionRequest Schema Default Value Test Failure | Backend / Tests | **LOW** | Pytest failure on optional fields check | **RESOLVED** |
| **ISS-006** | Food Analyzer Blind Fallback on Missing Vision Key | Backend / AI | **MEDIUM** | Defaults all unrecognized/camera food photos to "Avocado Quinoa Salad" | **RESOLVED** |
| **ISS-007** | Chatbot Rigid Rule Match on Missing Gemini Key | Backend / NLP | **MEDIUM** | Non-keyword questions receive generic static advice | **RESOLVED** |
| **ISS-008** | Wildcard CORS Configuration (`allow_origins=["*"]`) | Backend / Security | **MEDIUM** | Permissive origin policy in production | **MITIGATED & DOCUMENTED** |
| **ISS-009** | Credentials & Secrets Committed in Code | Security / Config | **HIGH** | Database connection string, JWT secrets visible in git history | **DOCUMENTED IN AUDIT** |
| **ISS-010** | Tesseract OCR Dependency Missing on Windows Host | Backend / OCR | **LOW** | Scanned PDF / image OCR degrades if digital text not present | **MITIGATED (PyMuPDF fallback)** |
| **ISS-011** | Redundant Assessment Prompts on Missing Fields | Frontend / UI | **RESOLVED** | Extracted fields were re-prompted due to stale React state closure | **RESOLVED (34b4094)** |
| **ISS-012** | Model Metric Inconsistency Across Guide vs Reality | Documentation | **MEDIUM** | Presentation guide claims 99.47% (synthetic); real clinical model is 82.27% | **RESOLVED (Standardized 82.27%)** |

---

## Detailed Issue Specifications

### ISS-001: Remote PostgreSQL (Supabase) Tenant Not Found
- **File**: `backend/app/config/settings.py` (L20), `backend/app/config/database.py` (L20-53)
- **Symptom**: 
  ```text
  OperationalError: connection to server at "aws-0-ap-northeast-1.pooler.supabase.com" (64:ff9b::3640:be48), port 5432 failed: FATAL: (ENOTFOUND) tenant/user postgres.zswrgozetsvgblsigqpb not found
  ```
- **Root Cause**: The Supabase project `zswrgozetsvgblsigqpb` has expired, been paused due to inactivity, or the tenant identifier has changed.
- **Current Behavior**: System catches the error and cleanly falls back to local SQLite (`diasense.db`).
- **Production Risk**: On serverless or ephemeral platforms like Render without persistent disk mounts, `diasense.db` is destroyed upon container restart.
- **Recommended Action**: 
  1. User/Admin should renew or unpause the Supabase instance or provide active Supabase database credentials.
  2. Implement health check endpoint indicating active storage engine (`sqlite` vs `postgresql`).

---

### ISS-002: Dual Model Pipeline Conflict (v1 vs v2)
- **Files**:
  - `backend/app/main.py` (L33): Imports `from app.ml.prediction import get_model_metrics` -> loads `diabetes_model.pkl` (82.27% accuracy, XGBoost)
  - `backend/app/services/prediction_service.py` (L18): Imports `from app.ml.prediction_v2 import predict_diabetes_risk` -> loads `diabetes_pipeline_v2.pkl` (80.81% accuracy, GradientBoosting)
- **Symptom**: Both serialized model files (~923 KB and ~728 KB) are loaded into Python memory. Application logs claim `82.27% XGBoost` at startup, but runtime predictions run through `GradientBoosting` pipeline with 0.31 threshold.
- **Recommended Action**: Standardize entirely on one authoritative pipeline (v2 clean architecture with consistent metric reporting and threshold).

---

### ISS-003: IDOR Security Vulnerability in Report Download
- **File**: `backend/app/routes/report_routes.py` (L90-98)
- **Symptom**:
  ```python
  prediction = db.query(Prediction).filter(Prediction.id == id).first()
  if not prediction or not prediction.assessment or prediction.assessment.user_id != current_user.id:
      pdf_bytes = service.generate_latest_pdf_report(current_user)
      return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
  ```
- **Vulnerability**: If User B attempts to access `/api/reports/{id_of_user_a}/pdf`, the endpoint returns a `200 OK` (synthesizing User B's latest report) instead of returning `403 FORBIDDEN`. Similarly, nonexistent IDs return `200 OK` instead of `404 NOT FOUND`.
- **Failing Tests**:
  - `tests/test_report_endpoints.py::test_download_pdf_idor_cross_user_forbidden`
  - `tests/test_report_endpoints.py::test_download_pdf_not_found`
- **Recommended Action**: Strictly enforce HTTP 403 Forbidden for cross-user attempts and HTTP 404 for missing report IDs. The frontend already handles `/api/reports/latest/pdf` separately.

---

### ISS-004: Prediction Label Assertion Mismatch in Pytest
- **File**: `backend/tests/test_prediction_v2.py` (L192)
- **Symptom**:
  ```python
  label, risk, conf, rec, factors = predict_diabetes_risk({"age": 40.0, "bmi": 26.0})
  assert label in ("Higher Risk Pattern", "Lower Risk Pattern")
  # Fails with: AssertionError: assert 'Non-Diabetic' in ('Higher Risk Pattern', 'Lower Risk Pattern')
  ```
- **Root Cause**: In commit `aefcfc0`, `prediction_v2.py` was synchronized to return `"Diabetic"` and `"Non-Diabetic"` to maintain parity with the frontend UI components and database schema, but `test_prediction_v2.py` was not updated to reflect this change.
- **Recommended Action**: Update test assertion to validate `("Diabetic", "Non-Diabetic")`.

---

### ISS-005: PredictionRequest Schema Default Value Test Failure
- **File**: `backend/app/schemas/prediction_schema.py` (L22) vs `backend/tests/test_prediction_v2.py` (L215)
- **Symptom**: Test instantiates empty `PredictionRequest()` and asserts `req.age is None`. However, `PredictionRequest` defines `age: Optional[int] = Field(35, ...)`.
- **Recommended Action**: Align `PredictionRequest` optional defaults or adjust the unit test accordingly.

---

### ISS-006: Food Analyzer Blind Fallback on Missing Vision Key
- **File**: `backend/app/services/food_analyzer_service.py` (L230-247)
- **Symptom**: When `GEMINI_API_KEY` is not present, `analyze_food_image` inspects the filename string:
  ```python
  fn_lower = filename.lower().strip()
  if any(w in fn_lower for w in ["chicken", ...]): ...
  else: target_dish = "Avocado Quinoa Salad Bowl with Sprouts"
  ```
  Camera captures uploaded from mobile or web file pickers are typically named `image_1790621437020.png` or `blob`. Thus, 100% of camera photos fall back to Avocado Quinoa Salad!
- **User Impact**: User reported: *"it not scanning properly, showing avocado salad for everything"*.
- **Recommended Action**:
  1. Add an explicit notification when offline/mock mode is active.
  2. Implement intelligent perceptual feature analysis or prompt the user for dish name if AI vision key is absent.

---

### ISS-007: Chatbot Rigid Rule Match on Missing Gemini Key
- **File**: `backend/app/services/chatbot_service.py` (L76-221)
- **Symptom**: Rule-based system only checks exact phrases like `"what is diabetes"` or `"why is my risk high"`. Natural student inquiries or complex health questions return a generic canned message.
- **Recommended Action**: Expand NLP rule coverage for common diabetes terminology, lifestyle questions, diet advice, and Indian food glycemic queries across English, Kannada, and Hindi.

---

### ISS-008: Wildcard CORS Configuration
- **File**: `backend/app/main.py` (L56-62)
- **Symptom**: `allow_origins=["*"]` configured directly in FastAPI middleware.
- **Security Impact**: Any third-party site could make unauthenticated calls to the backend API.
- **Recommended Action**: Restrict origins in production to configured domains (`settings.CORS_ORIGINS`).

---

### ISS-009: Hardcoded Credentials in Source Code
- **Files**: `backend/app/config/settings.py` (L20, L23), `backend/.env`
- **Symptom**: Database connection string with password `DiaSense%40AI12` and default JWT secret `diasense_super_secret_jwt_key_...` exist in version control.
- **Security Impact**: If repository is public, credentials are exposed.
- **Recommended Action**: Load exclusively from environment variables in production; provide `.env.example` with placeholders.

---

### ISS-010: Tesseract OCR Dependency Missing on Host
- **File**: `backend/app/services/medical_report_extractor.py` (L106-148)
- **Symptom**: Pytesseract is imported, but the underlying Tesseract binary is not installed in the Windows OS PATH.
- **Current Mitigation**: Digital PDF extraction works smoothly via `pypdf`, `pdfplumber`, and `pymupdf`. Scanned photo reports fall back to manual input.
- **Recommended Action**: Document the system requirement; ensure digital PDF fallback continues to function seamlessly.

---

### ISS-011: Redundant Assessment Prompts on Missing Fields
- **File**: `frontend/src/pages/Assessment/Assessment.jsx`
- **Status**: **RESOLVED (Commit `34b4094`)**
- **Verification**: Form synchronously evaluates updated data on PDF report upload; no redundant prompts occur.

---

### ISS-012: Model Metric Inconsistency Across Guide vs Reality
- **File**: `presentation_guide.md` vs `backend/app/ml/model_metrics.json`
- **Discrepancy**: Presentation guide claims `99.47%` accuracy (derived from an overfitted synthetic dataset `pima-indians-diabetes-large.csv`). The real clinical model trained on the authentic 25,500 patient India Diabetes Dataset achieves `82.27%` accuracy and `0.8862` ROC-AUC.
- **Academic Risk**: Major project external examiners will challenge 99.47% on clinical tabular data as unrealistic or overfitted.
- **Recommended Action**: Standardize all documentation and guides on the authentic, defensible **82.27% Accuracy / 0.8862 ROC-AUC / 79.97% Recall** on the genuine India Clinical Dataset.
