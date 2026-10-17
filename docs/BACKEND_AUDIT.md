# DiaSense AI Backend — Comprehensive Code & Architecture Audit Report

**Date:** October 17, 2026  
**Auditor:** Senior Software Engineer & ML Systems Specialist  
**Target Repository:** `DiaSenseAI/project_src/backend`  
**FastAPI Version:** `0.141.1` | **Python Target:** `3.14 / 3.12` | **Architecture:** Modular Clean Architecture (Routes, Services, Repositories, Models, ML Pipelines)

---

## Executive Summary

A complete, exhaustive file-by-file code audit of all 63 backend source files, configuration files, ML artifacts, schemas, repositories, utilities, and test suites was conducted. 

DiaSense AI is a diabetes risk screening and lifestyle intervention platform designed for the Indian demographic. It has recently transitioned from the legacy Pima Indians Diabetes dataset (8 clinical features) to the **India Diabetes Patient Dataset** (25,500 records, 14 clinical and lifestyle features). 

While the backend exhibits clean architectural separation (FastAPI routers -> Service layer -> Repository layer -> SQLAlchemy ORM), the audit identified several **critical operational vulnerabilities**, **severe credential leaks in source control**, **dual competing ML model pipelines**, **IDOR access flaws**, and **broken external AI integrations (Gemini API 404s)**.

---

## Part 1: File-by-File Audit (Files 1 – 63)

---

### 1. `backend/app/main.py`
- **Purpose:** FastAPI application entry point, lifecycle context (`lifespan`), CORS middleware registration, global exception handlers, and inclusion of all 12 feature routers.
- **Key Issues:**
  - **Dual Pipeline Desynchronization:** During startup lifespan (lines 33–40), `main.py` imports `get_model_metrics()` from `app.ml.prediction`, which loads the legacy/v1 XGBoost model (`diabetes_model.pkl`, 82.27% accuracy). However, the actual prediction service (`prediction_service.py`) executes `app.ml.prediction_v2` (`diabetes_pipeline_v2.pkl`, GradientBoosting, 80.81% accuracy, threshold 0.31). Startup logs misrepresent the active inference model.
  - **CORS Bypass:** Line 58 explicitly sets `allow_origins=["*"]` with `allow_credentials=False`. This completely bypasses and ignores `settings.CORS_ORIGINS` defined in `settings.py` / `.env`. In production, wildcard origin with `allow_credentials=False` breaks authenticated credential workflows if credentials are requested.
  - **Header Stripping in HTTP Exceptions:** Global handler `http_exception_handler` wraps exceptions via `error_response(...)`, but does not forward custom headers such as `WWW-Authenticate: Bearer` required by RFC 6750 on HTTP 401.
- **Missing Error Handling:**
  - In `lifespan()`, no `try...except` wraps `init_db()` or model metrics loading. Any unhandled DB connection failure or missing pickle file will crash application startup.
- **Hardcoded Values:**
  - Version `"1.0.0"`, OpenAPI docs paths `"/docs"`, `"/redoc"`, CORS wildcard `["*"]`.

---

### 2. `backend/app/config/settings.py`
- **Purpose:** Centralized configuration management using Pydantic `BaseSettings` (`pydantic-settings`).
- **Key Issues:**
  - **CRITICAL CREDENTIAL LEAK:** Line 20 contains a live Supabase production PostgreSQL connection string with password: `postgresql://postgres.zswrgozetsvgblsigqpb:DiaSense%40AI12@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`.
  - **Hardcoded Secret Key:** Default `SECRET_KEY = "diasense_super_secret_jwt_key_change_in_production_2026_x99!"` is committed to git.
  - **Session Duration Inconsistency:** Line 27 sets `ACCESS_TOKEN_EXPIRE_MINUTES = 1440` (24 hours) with a comment citing a mobile logout fix. However, `.env` defines `ACCESS_TOKEN_EXPIRE_MINUTES = 60`, which overrides this setting back to 1 hour upon loading.
  - **Hardcoded Target Email:** Default `ADMIN_EMAIL = "gagankamati643@gmail.com"`.
  - **Empty Integrations:** `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`, and SMTP credentials default to empty strings.
- **Missing Error Handling:**
  - `parse_cors_origins` field validator catches generic `Exception` and falls back to comma-splitting, but does not validate origin URI syntax.
- **Hardcoded Values:**
  - Default database connection URL, JWT secret key, admin email, CORS localhost ports (5173, 5174, 5175, 3000).

---

### 3. `backend/app/config/database.py`
- **Purpose:** Database engine initialization with automatic SQLite fallback, SQLAlchemy `SessionLocal`, `Base`, `get_db` session dependency, and `init_db()` table creation.
- **Key Issues:**
  - **30-Second Startup Blocking:** The configured Supabase database returns `tenant/user postgres.zswrgozetsvgblsigqpb not found` (project was paused, deleted, or tenant ID is invalid). Because `_create_engine_with_fallback()` tests connectivity synchronously with a 30-second timeout (`pool_timeout=30`), every startup and every independent test execution blocks for 30 seconds before falling back to SQLite `diasense.db`.
  - **No Migration Engine:** The project relies exclusively on `Base.metadata.create_all(bind=engine)`. SQLAlchemy's `create_all` does NOT alter or add columns to existing tables. Schema updates on existing databases fail silently without Alembic migrations.
  - **Relative SQLite Path:** `"sqlite:///./diasense.db"` creates the SQLite file relative to current process working directory. Launching from different directories creates fragmented, disjoint databases.
  - **Global Engine Reassignment Flaw:** In `init_db()`, if the initial remote connection failed, lines 84–85 reassign `engine` and reconfigure `SessionLocal`. However, modules importing `engine` directly before `init_db()` retain the broken PostgreSQL engine reference.
- **Missing Error Handling:**
  - In `get_db()`, there is no `db.rollback()` in the `finally` block before `db.close()`, leaving aborted transactions hanging in the connection pool.
- **Hardcoded Values:**
  - `"sqlite:///./diasense.db"`, `pool_size=5`, `max_overflow=10`, `pool_timeout=30`.

---

### 4. `backend/app/config/security.py`
- **Purpose:** Password hashing using bcrypt, JWT token signing/verification, and FastAPI authentication dependencies (`get_current_user`, `get_optional_current_user`, `get_current_user_with_query_token`).
- **Key Issues:**
  - **Byte Truncation Character Slice Bug:** Lines 21 & 31 truncate passwords to 72 bytes via `password.encode("utf-8")[:72]`. While bcrypt limits inputs to 72 bytes, slicing UTF-8 encoded bytes directly can split a 2-, 3-, or 4-byte UTF-8 character in half, creating malformed byte sequences.
  - **Token Exposure via URL Query Parameter:** `get_current_user_with_query_token` supports `?token=` parameter for PDF report downloads. Query parameter tokens are logged in plaintext in server logs, browser history, reverse proxy access logs, and HTTP Referer headers.
  - **Overly Broad Exception Swallowing:** In `get_optional_current_user` (lines 123–124), `except Exception: return None` catches database connection failures, repository runtime errors, and malformed queries, silently treating operational errors as "guest users".
  - **Deprecated Datetime Methods:** Uses `datetime.utcnow()` throughout (deprecated in Python 3.12+; should use `datetime.now(timezone.utc)`).
- **Missing Error Handling:**
  - `decode_token` only catches `jose.JWTError`. Malformed headers or tokens throwing unexpected exceptions will trigger an unhandled 500 error instead of a 401.
- **Hardcoded Values:**
  - OAuth2 token URL `tokenUrl="/api/auth/login"`.

---

### 5. `backend/app/models/user.py`
- **Purpose:** SQLAlchemy ORM model for `users` table storing account identity, hashed password, demographic profile, and relationship to assessments.
- **Key Issues:**
  - **Missing Authorization & Lifecycle Attributes:** Lacks `is_active`, `is_verified`, `role` (user/admin), and `last_login_at` fields. All users have equal privilege, and inactive accounts cannot be disabled.
  - **No Case-Insensitive Unique Constraint:** Database unique constraint on `email` is case-sensitive on standard PostgreSQL. Case collisions can occur if raw SQL or un-normalized inserts occur.
- **Missing Error Handling:** N/A (Declarative Model).
- **Hardcoded Values:**
  - String column lengths `String(255)`, `String(50)`.

---

### 6. `backend/app/models/assessment.py`
- **Purpose:** SQLAlchemy ORM model for `assessments` table storing demographic, lifestyle, metabolic, and clinical parameters.
- **Key Issues:**
  - **Dual Schema Duplication:** Contains both Indian Diabetes Dataset fields (`fasting_glucose`, `monthly_income`, `physical_activity_hours`, etc.) and legacy Pima fields (`glucose`, `pregnancies`, `skin_thickness`, `insulin`, `diabetes_pedigree_function`). `fasting_glucose` and `glucose` store redundant information.
  - **Improper Data Types:** `month` is stored as `Float` instead of `Integer` (e.g. 6.0). `family_history` is stored as `Float` (0.0 / 1.0) instead of `Boolean` or `SmallInteger`.
  - **SQLite Foreign Key Cascade Inefficacy:** Defines `ondelete="CASCADE"`, but SQLite does not enforce foreign keys unless `PRAGMA foreign_keys = ON;` is executed on connection.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:**
  - Model defaults (`patient_group="Urban"`, `gender="Male"`, `age=35`, `bmi=24.5`, `blood_pressure=120.0`).

---

### 7. `backend/app/models/prediction.py`
- **Purpose:** SQLAlchemy ORM model for `predictions` table storing prediction label, risk percentage, and confidence score.
- **Key Issues:**
  - **No Persisted Explainability / Factors:** `contributing_factors`, model version, and clinical recommendations are NOT stored in the database. When retrieving past predictions, factors are recomputed dynamically. If clinical thresholds or model weights change, historical reports will show mutated risk explanations.
  - **Indirect User Linkage:** Lacks direct `user_id` foreign key; queries require an explicit join through `Assessment`.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:**
  - `String(50)` for prediction label.

---

### 8. `backend/app/models/diet_plan.py`
- **Purpose:** SQLAlchemy ORM model for `diet_plans` table storing meal segments (breakfast, lunch, dinner, snacks, exercise, tips).
- **Key Issues:**
  - **Dead Storage for Localized Plans:** When the user requests a diet plan in any language (via `diet_service.py`), the service ignores the database text and generates localized strings from `i18n.py`. The text saved in `diet_plans` is never served if localized.
  - **Missing Timestamps:** Lacks `created_at` and `updated_at`.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Column types are unbounded `Text`.

---

### 9. `backend/app/models/contact.py`
- **Purpose:** SQLAlchemy ORM model for `contact_messages` table storing customer support submissions.
- **Key Issues:**
  - **No Status Tracking:** No `status` (`pending`, `replied`, `closed`), `admin_notes`, or `user_id` reference.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** `String(255)`.

---

### 10. `backend/app/routes/auth_routes.py`
- **Purpose:** API endpoints for registration, authentication, and profile retrieval (`/api/auth/register`, `/api/auth/login`, `/api/auth/profile`).
- **Key Issues:**
  - **Dead Refresh Token:** `/login` and `/register` issue a `refresh_token`, but the backend provides **NO** `/refresh` endpoint. The refresh token cannot be used to renew sessions.
  - **Redundant Routes:** `/api/auth/profile` duplicates `/api/user/profile` in `user_routes.py`.
  - **No Rate Limiting:** `/login` and `/register` lack rate-limiting, exposing the auth service to credential stuffing and registration spam.
- **Missing Error Handling:**
  - No account lockout after repeated failed login attempts.
- **Hardcoded Values:**
  - Route prefix `"/api/auth"`.

---

### 11. `backend/app/routes/assessment_routes.py`
- **Purpose:** CRUD endpoints for user assessments (`POST /api/assessment`, `GET /api/assessment/history`, `GET /api/assessment/{id}`, `DELETE /api/assessment/{id}`).
- **Key Issues:**
  - **Disconnected Workflow:** `POST /api/assessment` stores raw assessment data but does NOT trigger ML risk prediction or diet plan generation. The user must make a separate call to `POST /api/prediction`.
- **Missing Error Handling:**
  - Path parameter `id` has no range validation (e.g. `gt=0`).
- **Hardcoded Values:** Prefix `"/api/assessment"`.

---

### 12. `backend/app/routes/prediction_routes.py`
- **Purpose:** Endpoints for diabetes risk prediction (`POST /api/prediction`, `GET /api/prediction/latest`, `GET /api/prediction/accuracy`, `GET /api/prediction/history`).
- **Key Issues:**
  - **Active Pipeline vs Metrics Route Mismatch:** Endpoint `GET /api/prediction/accuracy` (line 56) imports `get_model_metrics()` from `app.ml.prediction` (reporting 82.27% accuracy from `diabetes_model.pkl`), whereas `POST /api/prediction` delegates to `PredictionService`, which executes `app.ml.prediction_v2` (GradientBoosting, 80.81% accuracy from `diabetes_pipeline_v2.pkl`).
  - **Degraded History Recommendations:** In `get_prediction_history`, every historical prediction is assigned static generic text: `"Follow medical lifestyle recommendations provided."`.
- **Missing Error Handling:**
  - Missing handling for unexpected NaN / infinite floats during inference preprocessing.
- **Hardcoded Values:** Default header `Accept-Language: en`.

---

### 13. `backend/app/routes/dashboard_routes.py`
- **Purpose:** Aggregation endpoint `GET /api/dashboard` providing profile, latest prediction, assessment history, health summary, and diet plan in a single request.
- **Key Issues:**
  - **Lack of Multilingual Support:** Does not consume or pass `Accept-Language` header to underlying diet or prediction services, returning English-only dashboard content even if client requested another language.
- **Missing Error Handling:**
  - If a user has an assessment with corrupted or missing numeric fields, `health_summary` computation does not use robust defensive type casting.
- **Hardcoded Values:** Prefix `"/api/dashboard"`.

---

### 14. `backend/app/routes/diet_routes.py`
- **Purpose:** Diet and exercise recommendations retrieval (`GET /api/diet/latest`, `GET /api/diet/{prediction_id}`).
- **Key Issues:**
  - **CRITICAL IDOR VULNERABILITY:** In `GET /api/diet/{prediction_id}`, the endpoint verifies that the requester is an authenticated user via `get_current_user`. However, `service.get_diet_plan_by_prediction_id()` fetches the prediction by ID **without checking if the prediction belongs to the authenticated user**. Any logged-in user can access any other user's diet plan and risk score.
- **Missing Error Handling:**
  - Path parameter `prediction_id` lacks positive integer validation.
- **Hardcoded Values:** Default language `"en"`.

---

### 15. `backend/app/routes/report_routes.py`
- **Purpose:** Health report endpoints (`GET /api/reports/{id}`, `GET /api/reports/latest/pdf`, `GET /api/reports/{id}/pdf`).
- **Key Issues:**
  - **Pytest Failure / Broken Status Codes on IDOR and 404:** In `download_pdf_report(id)` (lines 91–98), when a prediction ID does not exist OR does not belong to the requesting user, instead of returning HTTP 404 or HTTP 403, the route falls back to `service.generate_latest_pdf_report(current_user)` and returns HTTP 200 with the latest report. This breaks automated tests (`test_download_pdf_idor_cross_user_forbidden` and `test_download_pdf_not_found`).
  - **Inconsistent Error Response Structure:** In `get_report_by_id` (lines 27–31), when a report is not found, it returns a plain text `Response(content=b"Report not found.", status_code=404, media_type="text/plain")` instead of the project's standard JSON `error_response(...)`.
- **Missing Error Handling:**
  - Does not catch ReportLab generation exceptions cleanly.
- **Hardcoded Values:** Attachment filenames `DiaSense_Health_Report_latest.pdf`.

---

### 16. `backend/app/routes/food_routes.py`
- **Purpose:** Meal nutrition analysis via text description (`POST /api/food/analyze-text`) and food image recognition (`POST /api/food/analyze-image`).
- **Key Issues:**
  - **Memory Exhaustion DoS Risk:** In `analyze_food_image` (line 39), `contents = await file.read()` reads the entire uploaded file into memory without checking `Content-Length`. A multi-gigabyte upload will trigger out-of-memory crashes.
  - **Weak Image Type Validation:** `file.content_type.startswith("image/")` only validates the client-supplied header, which can be trivially forged.
  - **Event Loop Blocking:** The async route calls synchronous network I/O in `FoodAnalyzerService`, blocking the asyncio event loop.
- **Missing Error Handling:**
  - No file size threshold validation (e.g. 10MB limit).
- **Hardcoded Values:** Default language `"en"`.

---

### 17. `backend/app/routes/chatbot_routes.py`
- **Purpose:** Assistant query endpoint (`POST /api/chatbot/query`).
- **Key Issues:**
  - **Per-Request Service Instantiation:** Line 24 instantiates `service = ChatbotService()` on every single request, reloading environment variables and model candidate lists.
  - **Unauthenticated & Unthrottled:** The endpoint is completely open to unauthenticated users with zero rate-limiting, allowing malicious actors to exhaust third-party API quotas or launch DoS attacks.
  - **Untyped Context Parameter:** `context: Optional[Dict[str, Any]]` accepts unvalidated arbitrary dictionaries.
- **Missing Error Handling:**
  - No timeout handling at router layer if downstream API hangs.
- **Hardcoded Values:** Message max length 1000 characters.

---

### 18. `backend/app/routes/nearby_care_routes.py`
- **Purpose:** Discovery of nearby hospitals, clinics, and diagnostic labs (`GET /api/nearby-care`, `GET /api/nearby-care/geocode`).
- **Key Issues:**
  - **Global Service Singleton:** Line 12 instantiates `care_service = NearbyCareService()` at module import.
  - **Anti-pattern Direct Error Response:** Uses `return error_response(...)` instead of `raise HTTPException(...)`, which bypasses FastAPI exception middleware and OpenAPI error schemas.
  - **Null Island Coordinates:** Validates `-90 <= lat <= 90`, but does not reject `(0.0, 0.0)`.
- **Missing Error Handling:**
  - If all Overpass mirrors fail and Nominatim yields no results, returns 200 with empty list rather than notifying client of service degradation.
- **Hardcoded Values:** Radius min 500m, max 50000m, default 5000m.

---

### 19. `backend/app/routes/smart_assessment_routes.py`
- **Purpose:** Upload medical laboratory reports (PDF, JPG, PNG) and extract diabetes biomarkers (`POST /api/smart-assessment/extract-report`).
- **Key Issues:**
  - **Unauthenticated Heavy Compute Endpoint:** Does not require authentication. Anyone can upload 10MB PDFs and trigger intensive OCR and PDF parsing, consuming excessive server CPU.
  - **Missing Core Dependency:** Requires `pytesseract`, which is absent from `requirements.txt`.
- **Missing Error Handling:**
  - Returns HTTP 200 with `"success": False` inside response data when document cannot be processed, rather than returning HTTP 422 or 400.
- **Hardcoded Values:** `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB).

---

### 20. `backend/app/routes/user_routes.py`
- **Purpose:** User profile management (`GET /api/user/me`, `GET /api/user/profile`, `PUT /api/user/profile`, `PUT /api/user/change-password`).
- **Key Issues:**
  - **No Session Invalidation on Password Change:** In `change_user_password`, changing the account password does not revoke previously issued JWT access or refresh tokens. An attacker with a compromised token remains authenticated for up to 24 hours.
  - **Route Redundancy:** Duplicates endpoints from `auth_routes.py`.
- **Missing Error Handling:**
  - Does not verify if new password is identical to the current password.
- **Hardcoded Values:** Prefix `"/api/user"`.

---

### 21. `backend/app/routes/contact_routes.py`
- **Purpose:** Contact form submission (`POST /api/contact`).
- **Key Issues:**
  - **Spam Vulnerability:** Completely unauthenticated with no CAPTCHA or rate-limiting. Spammers can flood the database and trigger outbound email notifications.
  - **Information Disclosure:** Response message exposes private admin email address: `"Thank you for your message. Your inquiry has been sent to gagankamati643@gmail.com and recorded!"`.
- **Missing Error Handling:**
  - If database save succeeds but email fails, the API reports success without logging an alert for unnotified messages.
- **Hardcoded Values:** Target email `gagankamati643@gmail.com`.

---

### 22. `backend/app/services/prediction_service.py`
- **Purpose:** Core prediction business logic: mapping assessment inputs, calling ML inference, persisting Prediction entity, and generating diet plans.
- **Key Issues:**
  - **Dead Code:** Functions `_build_assessment_data()` (lines 22–39) and `_assessment_obj_to_data()` (lines 42–59) are defined but never called anywhere in the codebase.
  - **Silent Failure on Diet Plan Generation:** Lines 200–201 wrap diet plan generation in a blank `except Exception: pass`, silently swallowing database or formatting errors.
  - **Hardcoded Clinical Thresholds:** Diet plan classification logic hardcodes `risk_pct >= 45.0 or glucose >= 126.0 or hba1c >= 6.5` directly inside Python code instead of using configuration.
- **Missing Error Handling:**
  - No database rollback on failed transaction steps.
- **Hardcoded Values:** Default income 35000.0, month 6.0, fasting glucose 100.0, age 35.

---

### 23. `backend/app/services/assessment_service.py`
- **Purpose:** Business logic for creating, fetching, and deleting assessment records.
- **Key Issues:**
  - **Destructive User Profile Side Effect:** Lines 49–58 automatically overwrite the logged-in user's profile (`user.age = request.age`, `user.gender = request.gender`) upon every assessment submission. If an authenticated user enters screening parameters for a family member, child, or parent, the user's personal account profile is permanently corrupted.
  - **Silent Exception Swallowing:** Line 57 catches user profile update errors with `except Exception: pass`.
- **Missing Error Handling:**
  - No rollback if user update fails.
- **Hardcoded Values:** Default fasting glucose 100.0, default BMI 24.5.

---

### 24. `backend/app/services/auth_service.py`
- **Purpose:** Business logic for user registration, authentication, profile with statistics, and password change.
- **Key Issues:**
  - **N+1 Query Pattern:** In `get_profile_with_stats()` (lines 83–108), queries all assessments and then performs a separate query for prediction records instead of an optimized single JOIN.
  - **Weak Password Length:** Enforces minimum 6 characters (line 137).
- **Missing Error Handling:**
  - Does not reject setting new password identical to current password.
- **Hardcoded Values:** Minimum password length 6.

---

### 25. `backend/app/services/dashboard_service.py`
- **Purpose:** Aggregation service for user dashboard metrics, health summary, and active diet plan.
- **Key Issues:**
  - **Unvalidated Clinical Health Score Formula:** Lines 41–44 calculate arbitrary health scores:
    - Diabetic: `max(20, int(100 - latest_pred.risk_percentage))`
    - Non-Diabetic: `min(98, int(100 - (latest_pred.risk_percentage * 0.5)))`
    These mathematical heuristics have no formal clinical validation.
- **Missing Error Handling:**
  - Lacks handling for missing/null assessment vitals.
- **Hardcoded Values:** Base health scores 90, 20, 98.

---

### 26. `backend/app/services/diet_service.py`
- **Purpose:** Business logic for retrieving personalized diet and exercise plans with multilingual localization.
- **Key Issues:**
  - **CRITICAL IDOR VULNERABILITY:** In `get_diet_plan_by_prediction_id` (lines 50–65), accepts `(user: User, prediction_id: int)` but queries `Prediction` and `DietPlan` without verifying `prediction.assessment.user_id == user.id`. Any authenticated user can read other users' health meal plans.
  - **Database Diet Plan Text Ignored:** The text stored in `DietPlan` table is completely bypassed; the method returns static dictionary translations from `i18n.py`.
- **Missing Error Handling:**
  - Missing ownership verification check.
- **Hardcoded Values:** Hardcoded plan categories `"HighRisk"`, `"LowRisk"`.

---

### 27. `backend/app/services/report_service.py`
- **Purpose:** PDF report generation using ReportLab.
- **Key Issues:**
  - **Cross-Pipeline Contamination:** Imports factor analysis from `app.ml.prediction` (v1) at line 8, while importing risk inference from `app.ml.prediction_v2` (v2) at lines 347 and 384.
  - **Fabrication of Fake Patient Records:** In `generate_latest_pdf_report` (lines 364–398), if a user has no assessment history, the service silently fabricates a synthetic assessment and prediction in the database (`patient_group="Urban"`, `age=35`, `bmi=24.5`, `glucose=100.0`, etc.) and returns a PDF based on fake data. This violates medical software integrity standards.
- **Missing Error Handling:**
  - Missing cleanup if PDF stream generation encounters an error.
- **Hardcoded Values:** Hex color palette, disclaimer text.

---

### 28. `backend/app/services/food_analyzer_service.py`
- **Purpose:** Nutrition analysis using Gemini Generative AI and authentic Indian food knowledge base.
- **Key Issues:**
  - **CRITICAL / BROKEN INTEGRATION: Non-Existent Gemini Model:** Lines 225 & 250 call `"models/gemini-3.5-flash"`. Google Generative AI API has no model with this name! All calls to Google Gemini fail with 404 Model Not Found.
  - **Unconfigured API Key:** `GEMINI_API_KEY` is empty in `.env`.
  - **Mock Data Fallback:** Because the Gemini API calls fail, the service always falls back to keyword matching on the filename or the hardcoded 13-item knowledge base.
  - **Synchronous Event Loop Blocking:** Uses synchronous `httpx.post(..., timeout=30.0)` inside an async route.
- **Missing Error Handling:**
  - Broad exception catching masks HTTP errors.
- **Hardcoded Values:** 13 dishes in `FOOD_KNOWLEDGE_BASE`.

---

### 29. `backend/app/services/chatbot_service.py`
- **Purpose:** Multilingual healthcare chatbot with rule-based NLP and Gemini generative AI fallback.
- **Key Issues:**
  - **CRITICAL / BROKEN INTEGRATION: Invalid Gemini Model Names:** Lines 18–23 list `["gemini-3.5-flash", "gemma-4-26b-a4b-it", "gemini-flash-latest", "gemini-3.1-flash-lite"]`. None of these correspond to standard Google Gemini API models.
  - **Outdated / Fabricated Accuracy Claims:** Lines 150 & 186 state: *"our 96.8% accurate XGBoost model"*, referring to the deprecated Pima model rather than the actual 80.8% / 82.3% Indian models.
  - **Synchronous Blocking:** Makes synchronous `httpx.post(...)` calls with a 12s timeout per model.
  - **Extremely Narrow NLP Scope:** The rule-based engine only handles 2 questions ("what is diabetes" and "why is my risk high"). All other queries receive a generic canned message.
- **Missing Error Handling:**
  - Loops over invalid models sequentially, causing severe latency (up to 48 seconds) when an API key is present.
- **Hardcoded Values:** Static multi-language medical strings.

---

### 30. `backend/app/services/medical_report_extractor.py`
- **Purpose:** Medical lab report parser extracting 13 clinical biomarkers from digital PDFs, scanned PDFs, and images.
- **Key Issues:**
  - **Missing Dependency:** Imports `pytesseract` (lines 109, 132), which is not listed in `requirements.txt`. Scanned PDF and image OCR will fail on standard deployments.
  - **No Tesseract Binary Check:** Does not check whether the Tesseract OCR engine binary is installed on the host operating system.
- **Missing Error Handling:**
  - Well structured error handling; assesses OCR text quality and returns actionable warnings.
- **Hardcoded Values:** `FIELD_RANGES`, physiological thresholds.

---

### 31. `backend/app/services/nearby_care_service.py`
- **Purpose:** Finding healthcare facilities via OpenStreetMap Overpass API, Nominatim, and Google Places.
- **Key Issues:**
  - **High Latency & Fragility:** Queries 5 public Overpass mirrors sequentially with 6s timeouts each. If public servers are busy, the endpoint blocks for up to 30 seconds.
  - **Empty Google Places Key:** `GOOGLE_PLACES_API_KEY` is unconfigured.
  - **Limited PIN Clusters:** Only 15 PIN codes are hardcoded in `KNOWN_INDIAN_PIN_CLUSTERS`.
- **Missing Error Handling:**
  - Lacks caching layer (Redis / SQLite) for geographic queries, causing redundant repeated queries to public OpenStreetMap servers.
- **Hardcoded Values:** Overpass mirror URLs, PIN clusters.

---

### 32. `backend/app/services/email_service.py`
- **Purpose:** SMTP notification dispatch for contact submissions to `gagankamati643@gmail.com`.
- **Key Issues:**
  - **Unconfigured SMTP Credentials:** `SMTP_USER` and `SMTP_PASSWORD` are empty. Live email delivery is inactive; all messages are only printed to console logs.
  - **Misleading Return Status:** Line 85 returns `True` even when live SMTP fails, giving callers the false impression that email was delivered.
- **Missing Error Handling:**
  - Swallows SMTP connection and authentication errors.
- **Hardcoded Values:** Target admin email, Gmail SMTP server.

---

### 33. `backend/app/ml/prediction.py`
- **Purpose:** ML prediction module v1 for XGBoost pipeline (`diabetes_model.pkl`).
- **Key Issues:**
  - **Competing Model Pipeline:** Loads `diabetes_model.pkl` (82.27% accuracy, threshold 0.45), while `prediction_service.py` uses `prediction_v2.py` (`diabetes_pipeline_v2.pkl`, 80.81% accuracy, threshold 0.31).
  - **On-the-Fly Synchronous Training:** If `diabetes_model.pkl` is missing, line 24 imports `train_model` and trains the model synchronously during backend startup.
  - **Security Risk:** Uses standard `pickle.load()` on model files.
- **Missing Error Handling:**
  - No fallback if pickle file is corrupt.
- **Hardcoded Values:** Threshold 0.45.

---

### 34. `backend/app/ml/prediction_v2.py`
- **Purpose:** Production inference module for `diabetes_pipeline_v2.pkl` (GradientBoostingClassifier).
- **Key Issues:**
  - **Pytest Failure / Prediction Label Inconsistency:** Line 327 returns `prediction_label = "Diabetic"` or `"Non-Diabetic"`. However, docstrings and schemas specify `"Higher Risk Pattern"` / `"Lower Risk Pattern"`. This causes `test_prediction_v2.py::test_prediction_label_valid_values` to fail.
  - **Low Decision Threshold (0.31):** Uses threshold 0.31 to maximize recall (79.97%), which results in a high false-positive rate (precision 65.63%).
- **Missing Error Handling:**
  - If engineered features encounter missing values not handled by mode/median, pandas operations could fail.
- **Hardcoded Values:** Default threshold 0.5.

---

### 35. `backend/app/ml/preprocessing.py`
- **Purpose:** Data transformation and feature engineering pipeline for `prediction.py` (v1).
- **Key Issues:**
  - **Dual Preprocessing Maintenance Overhead:** Only used by v1 `prediction.py`. v2 `prediction_v2.py` maintains separate feature engineering in `train_model_v2.py`.
- **Missing Error Handling:**
  - Safe conversion helpers prevent crashes on nulls.
- **Hardcoded Values:** Default clinical values (Age 35, BMI 24.5, BP 120, HbA1c 5.7).

---

### 36. `backend/app/ml/features.py`
- **Purpose:** Feature definitions, categories, and defaults for DiaSense AI v2.
- **Key Issues:**
  - **Dead Code:** `LEGACY_PIMA_FEATURES` and `FEATURE_NAMES_V2` are not directly consumed by the active inference pipeline; they serve solely as documentation.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** `DEFAULT_FEATURE_VALUES_V2`.

---

### 37. `backend/app/ml/model_metrics.json`
- **Purpose:** Evaluation metrics file for XGBoost model (`diabetes_model.pkl`).
- **Key Issues:**
  - **Metrics Discrepancy:** Reports XGBoost metrics (Accuracy 82.27%, ROC-AUC 0.8862, Threshold 0.45). Conficts with the active v2 GradientBoosting model (Accuracy 80.81%, ROC-AUC 0.8852, Threshold 0.31).
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Static evaluation numbers.

---

### 38. `backend/app/ml/model_metadata_v2.json`
- **Purpose:** Metadata and evaluation metrics for `diabetes_pipeline_v2.pkl`.
- **Key Issues:**
  - Demonstrates that the true active model is `GradientBoostingClassifier` with threshold 0.31, not XGBoost.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Static parameters.

---

### 39. `backend/app/ml/feature_importance_v2.json`
- **Purpose:** Feature importance weights for v2 model features.
- **Key Issues:**
  - Identifies `Daily_Sugar_Intake` (0.27091) and `Sugar_x_Activity` (0.14724) as dominant predictors.
  - Confirms `Gender` has negligible importance (0.00064).
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Static weights.

---

### 40. `backend/app/schemas/assessment_schema.py`
- **Purpose:** Pydantic validation schemas for assessment creation and responses.
- **Key Issues:**
  - **Overly Permissive Defaults:** In `AssessmentCreateRequest`, almost all fields have defaults (`patient_group="Urban"`, `gender="Male"`, `hba1c=5.7`, `blood_pressure=120.0`), allowing empty or near-empty payloads to pass validation.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Schema defaults.

---

### 41. `backend/app/schemas/prediction_schema.py`
- **Purpose:** Pydantic validation schemas for prediction requests and responses.
- **Key Issues:**
  - **Pytest Failure / Schema Default on Optional Field:** In `PredictionRequest`, line 22 defines `age: Optional[int] = Field(35, ge=1, le=120)`. Because it defaults to 35, when `test_all_optional_fields_none` submits an empty dictionary expecting all optional fields to be `None`, `age` evaluates to 35, failing the test.
  - **Label Inconsistency:** Response schema comment specifies `"Higher Risk Pattern"` / `"Lower Risk Pattern"`, but model returns `"Diabetic"` / `"Non-Diabetic"`.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Defaults.

---

### 42. `backend/app/schemas/auth_schema.py`
- **Purpose:** Pydantic schemas for registration, login, and token responses.
- **Key Issues:**
  - Minimum password length is only 6 characters. No character complexity constraints.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Field constraints.

---

### 43. `backend/app/schemas/food_schema.py`
- **Purpose:** Pydantic schemas for food nutrition requests and responses.
- **Key Issues:**
  - `glycemic_index` is strictly typed as `int`, which can fail validation if an external API returns float.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Suitability category strings.

---

### 44. `backend/app/schemas/nearby_care_schema.py`
- **Purpose:** Pydantic schemas for healthcare facilities and geocode results.
- **Key Issues:**
  - Well-defined structure; no critical issues found.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Default unit `"km"`.

---

### 45. `backend/app/schemas/user_schema.py`
- **Purpose:** Pydantic schemas for profile responses, profile updates, and stats.
- **Key Issues:**
  - Password change request enforces min length 6.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Validation boundaries.

---

### 46. `backend/app/schemas/contact_schema.py`
- **Purpose:** Pydantic schemas for contact form inquiries.
- **Key Issues:**
  - Properly uses `@model_validator(mode="after")` to normalize `name` vs `full_name`.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Character length bounds.

---

### 47. `backend/app/repositories/assessment_repository.py`
- **Purpose:** Data access layer for Assessment ORM entity.
- **Key Issues:**
  - **No Pagination:** `get_by_user_id` loads all user assessments into memory via `.all()`. Large assessment histories will cause memory spikes.
  - **No Transaction Rollback:** `create` and `delete` do not wrap commits in try/except with rollback.
- **Missing Error Handling:**
  - DB exceptions bubble unhandled to service layer.
- **Hardcoded Values:** N/A.

---

### 48. `backend/app/repositories/prediction_repository.py`
- **Purpose:** Data access layer for Prediction ORM entity.
- **Key Issues:**
  - **N+1 Query Risk:** Queries join `Assessment` without eager loading (`joinedload`).
  - **No Pagination:** `get_history_by_user_id` fetches all predictions at once.
- **Missing Error Handling:**
  - No rollback on commit failure.
- **Hardcoded Values:** N/A.

---

### 49. `backend/app/repositories/user_repository.py`
- **Purpose:** Data access layer for User ORM entity.
- **Key Issues:**
  - In `update()`, calls `db.commit()` without checking session attachment status.
- **Missing Error Handling:**
  - No rollback on error.
- **Hardcoded Values:** N/A.

---

### 50. `backend/app/repositories/diet_repository.py`
- **Purpose:** Data access layer for DietPlan ORM entity.
- **Key Issues:**
  - **Incomplete Repository Interface:** Lacks `get_by_id`, `delete`, and `update` methods.
- **Missing Error Handling:**
  - No rollback on error.
- **Hardcoded Values:** N/A.

---

### 51. `backend/app/utils/helper.py`
- **Purpose:** General helper utilities for timestamp formatting and string trimming.
- **Key Issues:**
  - **Dead Code:** `get_current_utc_timestamp()` and `sanitize_string()` are defined but virtually unused across the codebase.
  - Uses deprecated `datetime.utcnow()`.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** N/A.

---

### 52. `backend/app/utils/i18n.py`
- **Purpose:** Multilingual localization engine supporting 6 Indian languages (en, kn, hi, ta, te, ml).
- **Key Issues:**
  - **Pima vs India Dataset Feature Desynchronization:** `FACTOR_NAMES` and `FACTOR_DESCRIPTIONS` contain translations for legacy Pima features (`Diabetes Pedigree Score`, `Diastolic Blood Pressure`, `Blood Glucose`). The new India dataset features (`Daily Sugar Intake`, `Physical Activity Hours`, `Fast Food Frequency`, `Sleep Hours`, `HbA1c`) are NOT in `FACTOR_NAMES`! Consequently, when translating v2 factors, factor titles and descriptions remain in English.
- **Missing Error Handling:**
  - Gracefully falls back to English for unknown language codes.
- **Hardcoded Values:** 380+ lines of hardcoded translation dictionaries.

---

### 53. `backend/app/utils/logger.py`
- **Purpose:** Centralized logger configuration.
- **Key Issues:**
  - Logs exclusively to `sys.stdout`. No file logging, log rotation, or structured JSON logging for observability.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Date format `"%Y-%m-%d %H:%M:%S"`.

---

### 54. `backend/app/utils/response.py`
- **Purpose:** Standardized JSON response formatting (`success_response` and `error_response`).
- **Key Issues:**
  - Well structured and consistent across endpoints.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Default message strings.

---

### 55. `backend/app/utils/validators.py`
- **Purpose:** Validation helper functions for emails and passwords.
- **Key Issues:**
  - **Dead Code:** Both `is_valid_email()` and `is_strong_password()` are completely unused in the codebase (Pydantic `EmailStr` and inline length checks are used instead).
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Minimum password length 6.

---

### 56. `backend/requirements.txt`
- **Purpose:** Python third-party dependency manifest.
- **Key Issues:**
  - **CRITICAL MISSING DEPENDENCY:** `pytesseract` is imported in `medical_report_extractor.py` but is NOT in `requirements.txt`.
  - **Dead / Unused Dependencies:** `passlib==1.7.4` is installed but unused (bcrypt is called directly due to passlib compatibility issues with bcrypt >= 4). `alembic==1.19.1` is installed but no Alembic configuration exists.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Strict version pins.

---

### 57. `backend/.env`
- **Purpose:** Local environment configuration file.
- **Key Issues:**
  - **CRITICAL CREDENTIAL LEAK:** Contains live Supabase PostgreSQL connection string with password: `postgresql://postgres.zswrgozetsvgblsigqpb:DiaSense%40AI12@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`.
  - **Static JWT Secret:** `SECRET_KEY=diasense_super_secret_jwt_key_change_in_production_2026_x99!`.
  - **Token Expiry Bug:** `ACCESS_TOKEN_EXPIRE_MINUTES=60` overrides `settings.py`'s 1440-minute duration.
  - **Missing Variables:** `GEMINI_API_KEY` and `GOOGLE_PLACES_API_KEY` are omitted.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Plaintext secrets.

---

### 58. `backend/render.yaml`
- **Purpose:** Infrastructure as Code deployment specification for Render.com.
- **Key Issues:**
  - **CRITICAL CREDENTIAL LEAK:** Line 11 hardcodes the plaintext Supabase database password in source control.
  - `SECRET_KEY` and `GEMINI_API_KEY` are set to `sync: false`, requiring manual entry in the Render dashboard.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Production database URL.

---

### 59. `backend/run.py`
- **Purpose:** Development server launch entry point.
- **Key Issues:**
  - Correctly adjusts `sys.path` and launches Uvicorn. No issues found.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** N/A.

---

### 60. `backend/tests/conftest.py`
- **Purpose:** Pytest configuration, in-memory SQLite fixtures (`sqlite:///:memory:`), and test client setup.
- **Key Issues:**
  - **Startup Latency in Tests:** Imports `from app.main import app`, which triggers module-level database initialization in `database.py`. The test suite waits 30 seconds for the dead Supabase connection to time out before executing test cases.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** In-memory SQLite URL.

---

### 61. `backend/tests/test_auth.py`
- **Purpose:** Test suite for registration, login, and profile retrieval.
- **Key Issues:**
  - Passes successfully (1 test). Does not test edge cases (duplicate email, weak password, invalid credentials).
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Test credentials.

---

### 62. `backend/tests/test_prediction.py`
- **Purpose:** Integration test for prediction submission, retrieval, and accuracy.
- **Key Issues:**
  - **Legacy Schema in Tests:** Submits legacy Pima payload (`pregnancies`, `glucose`, `skin_thickness`, `insulin`, `diabetes_pedigree_function`). It only passes because `PredictionRequest` makes new Indian dataset fields optional with default values.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Hardcoded test payload.

---

### 63. `backend/tests/test_ml_pipeline.py`
- **Purpose:** Unit tests for model metrics and risk inference functions.
- **Key Issues:**
  - **Tests the Wrong Pipeline:** Imports `from app.ml.prediction import predict_diabetes_risk` (v1 XGBoost pipeline), NOT `app.ml.prediction_v2` (v2 GradientBoosting pipeline used in production).
  - Asserts accuracy > 0.60, passing against the old model.
- **Missing Error Handling:** N/A.
- **Hardcoded Values:** Threshold 0.60.

---

## Part 2: Comprehensive Technical Summaries

---

### 1. CRITICAL ISSUES (Things That Break the App)
1. **Broken Gemini AI Integration (404 Not Found):** `FoodAnalyzerService` and `ChatbotService` call non-existent model `"models/gemini-3.5-flash"` and invalid variants. Any call with an API key fails immediately with HTTP 404 from Google API.
2. **Missing `pytesseract` in `requirements.txt`:** Uploading an image or scanned medical report for extraction fails with `ModuleNotFoundError: No module named 'pytesseract'` in standard environments.
3. **Dead Supabase Connection Causing 30-Second Startup Delays:** `aws-0-ap-northeast-1.pooler.supabase.com:5432` fails with `tenant/user not found`. Every cold start or test run freezes for 30 seconds before falling back to local SQLite.
4. **Pytest Suite Failures (4 Failures):**
   - `test_prediction_label_valid_values`: Assertion fails because `prediction_v2` outputs `'Diabetic'` / `'Non-Diabetic'` while the test asserts `'Higher Risk Pattern'` / `'Lower Risk Pattern'`.
   - `test_all_optional_fields_none`: `PredictionRequest.age` defaults to 35 instead of `None`.
   - `test_download_pdf_idor_cross_user_forbidden` & `test_download_pdf_not_found`: `download_pdf_report` returns HTTP 200 with the latest report instead of HTTP 403 or 404.

---

### 2. SECURITY ISSUES
1. **Database Password Leaked in 3 Locations:** Plaintext password `DiaSense%40AI12` committed in `backend/app/config/settings.py` (line 20), `backend/.env` (line 8), and `backend/render.yaml` (line 11).
2. **Static JWT Secret Key Committed in Source:** `diasense_super_secret_jwt_key_change_in_production_2026_x99!` hardcoded in `.env`, `settings.py`, and `render.yaml`.
3. **IDOR in Diet Plan Retrieval:** `GET /api/diet/{prediction_id}` does not verify user ownership of the requested prediction, exposing health records across accounts.
4. **JWT Exposed in URL Query Parameters:** `GET /api/reports/{id}/pdf?token=...` allows tokens in query parameters, leaking them into access logs and browser history.
5. **No Token Revocation on Password Change:** Changing account password does not revoke existing JWTs.
6. **No Rate Limiting:** Auth endpoints (`/login`, `/register`), chatbot, and medical report upload have no rate limiting or CAPTCHA.

---

### 3. ML MODEL STATUS
- **Active Model for User Predictions:** `GradientBoostingClassifier` loaded from `backend/app/ml/diabetes_pipeline_v2.pkl` (trained on 25,010 clean records from `india_diabetes_patient_dataset.csv`).
  - **Decision Threshold:** 0.31 (optimized for maximum recall: 79.97%).
  - **Actual Performance:** Test Accuracy: **80.81%**, Recall: **79.97%**, Precision: **65.63%**, ROC-AUC: **0.8852**, F1: **0.7209**.
- **Reported Model in `/accuracy` & Startup:** `XGBoost` loaded from `backend/app/ml/diabetes_model.pkl`.
  - **Reported Performance:** Accuracy: **82.27%**, ROC-AUC: **0.8862**, Threshold: **0.45**.
- **Chatbot Knowledge Base Claim:** Claims **96.8% accuracy** (outdated legacy Pima claim).
- **Status:** **Dual pipeline desynchronization**. The app reports metrics for Model A (XGBoost) while running inference on Model B (GradientBoosting).

---

### 4. API COMPLETENESS
| Endpoint | Method | Working / Broken | Notes |
| :--- | :--- | :--- | :--- |
| `/health` | GET | Working | Returns healthy status |
| `/` | GET | Working | Root documentation link |
| `/api/auth/register` | POST | Working | Issues tokens |
| `/api/auth/login` | POST | Working | Issues tokens; refresh token has no `/refresh` route |
| `/api/auth/profile` | GET / PUT | Working | Duplicates `/api/user/profile` |
| `/api/assessment` | POST | Working | Stores assessment; does not trigger prediction |
| `/api/assessment/history` | GET | Working | Returns all assessments |
| `/api/assessment/{id}` | GET / DEL | Working | Fetches or deletes assessment |
| `/api/prediction` | POST | Working | Runs v2 inference; guest or auth |
| `/api/prediction/latest` | GET | Working | Retrieves latest prediction |
| `/api/prediction/accuracy` | GET | Inconsistent | Returns v1 XGBoost metrics (82.27%) instead of v2 |
| `/api/prediction/history` | GET | Degraded | Returns static dummy recommendation text |
| `/api/dashboard` | GET | Working | Aggregates data; English only |
| `/api/diet/latest` | GET | Working | Returns localized diet plan |
| `/api/diet/{prediction_id}` | GET | **Vulnerable** | IDOR: does not check user ownership |
| `/api/reports/{id}` | GET | Working | Returns report metadata |
| `/api/reports/latest/pdf` | GET | Working | Fabricates fake patient data if history is empty |
| `/api/reports/{id}/pdf` | GET | Broken Status | Returns 200 instead of 403/404 on unowned/missing IDs |
| `/api/food/analyze-text` | POST | Degraded | Gemini 404s; falls back to 13 static dishes |
| `/api/food/analyze-image` | POST | Degraded | Gemini 404s; falls back to filename keyword heuristic |
| `/api/chatbot/query` | POST | Degraded | Gemini 404s; falls back to 2-topic rule-based NLP |
| `/api/nearby-care` | GET | Working | High latency on public Overpass mirrors |
| `/api/nearby-care/geocode` | GET | Working | Geocodes PINs and cities |
| `/api/smart-assessment/extract-report` | POST | Degraded | PDF works; image OCR crashes if pytesseract uninstalled |
| `/api/user/me` | GET | Working | Profile retrieval |
| `/api/user/profile` | GET / PUT | Working | Profile with stats |
| `/api/user/change-password` | PUT | Working | Does not invalidate active JWTs |
| `/api/contact` | POST | Working | DB saved; SMTP unconfigured (console log only) |

---

### 5. DATABASE STATUS
- **Active Engine:** Local SQLite fallback (`sqlite:///./diasense.db`). Remote PostgreSQL (Supabase) fails with `tenant not found`.
- **Tables Initialized:** `users`, `assessments`, `predictions`, `diet_plans`, `contact_messages`.
- **Migrations:** **None**. No Alembic configuration or migration files exist despite `alembic` in `requirements.txt`. Table alterations must be applied manually.
- **Foreign Keys:** SQLite does not enforce foreign keys or cascade deletes unless `PRAGMA foreign_keys = ON;` is set.

---

### 6. FOOD ANALYZER STATUS
- **Gemini Integration:** **Broken**. The service targets `models/gemini-3.5-flash`, which does not exist in Google Generative AI API. `GEMINI_API_KEY` is not defined in `.env`.
- **Fallback Behavior:** Falls back to hardcoded `FOOD_KNOWLEDGE_BASE` (13 Indian dishes) or filename keyword parsing (e.g., "chicken" -> "Roasted Chicken with Green Beans"; otherwise "Avocado Quinoa Salad Bowl").
- **Multilingual Support:** Implemented for English, Kannada, Hindi, Tamil, Telugu, and Malayalam across the static knowledge base items.

---

### 7. CHATBOT STATUS
- **Gemini Integration:** **Broken**. Model list contains non-existent names (`gemini-3.5-flash`, `gemma-4-26b-a4b-it`, `gemini-3.1-flash-lite`).
- **Rule-Based Engine:** Only recognizes 2 queries:
  1. "What is diabetes"
  2. "Why is my risk high"
  All other user inputs receive a generic 2-sentence lifestyle recommendation.
- **Accuracy Discrepancy:** Chatbot responses claim "96.8% accurate XGBoost model" (legacy Pima figure).

---

### 8. MEDICAL REPORT EXTRACTION STATUS
- **Digital PDFs:** **Working**. Extracts text using `pypdf`, `pdfplumber`, and `PyMuPDF`. Accurately parses Fasting Blood Glucose, HbA1c, Blood Pressure, BMI, Age, Gender, and lifestyle fields.
- **Scanned PDFs & Images:** **Broken / Fragile**. Requires `pytesseract` which is missing from `requirements.txt`, and requires system Tesseract binary.
- **Extraction Logic:** High quality unit conversion (mmol/L -> mg/dL, lbs -> kg, feet/inches -> cm) and physiological confidence scoring.

---

### 9. MISSING FEATURES
1. **JWT Refresh Endpoint:** Refresh tokens are generated upon login/registration, but `POST /api/auth/refresh` does not exist.
2. **Alembic Migrations:** `alembic.ini` and migration scripts are missing.
3. **True Live Email Delivery:** SMTP user and password are unconfigured.
4. **Google Places Discovery:** `GOOGLE_PLACES_API_KEY` is unconfigured.
5. **Localization for v2 Factors:** `i18n.py` only translates v1 Pima feature names; v2 Indian dataset features remain untranslated in English.
6. **Token Blacklisting / Revocation:** No Redis or database table exists to revoke tokens upon password change or logout.
