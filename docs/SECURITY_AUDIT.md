# DiaSense AI — Comprehensive Application Security & Privacy Audit

**Audit Date:** October 17, 2026  
**Auditor:** Application Security & Authentication Specialist Team  
**Target:** DiaSense AI Backend & Frontend Systems  
**Evaluation Standard:** OWASP Top 10 API Security Risks & Healthcare Privacy Safeguards  

---

## 1. Executive Summary

A comprehensive application security and data privacy audit was performed on the DiaSense AI codebase. The application demonstrates solid defensive fundamentals through SQLAlchemy parameterized queries, Pydantic type validation, and bcrypt password hashing.

During the audit, one high-severity access control vulnerability (**IDOR in Report Downloads**) was detected and successfully remediated. Key recommendations have also been formulated for production deployment regarding CORS policy restriction, secret management, and ephemeral storage safeguards.

---

## 2. Threat Vector Analysis & Remediation Log

### 2.1 Insecure Direct Object References (IDOR) — [REMEDIATED]
- **Vulnerability ID:** ISS-003 / SEC-01
- **Severity:** HIGH
- **Location:** `backend/app/routes/report_routes.py` (L90–100)
- **Observed Flaw:**
  Previously, when an authenticated user requested a specific report ID via `GET /api/reports/{id}/pdf`, if the target report ID belonged to another user or did not exist, the route caught the condition and fell back to generating the *requesting user's latest report* (`generate_latest_pdf_report(current_user)`), returning an HTTP 200 OK. This behavior violated standard access control semantics and bypassed strict authorization verification.
- **Remediation Implemented:**
  The route was updated to enforce strict multi-tenant boundary checks:
  ```python
  prediction = db.query(Prediction).filter(Prediction.id == id).first()
  if not prediction:
      raise HTTPException(status_code=404, detail="Prediction record not found.")
  if not prediction.assessment or prediction.assessment.user_id != current_user.id:
      raise HTTPException(
          status_code=403,
          detail="Access denied: You do not have permission to access this report."
      )
  ```
- **Verification:**
  - `tests/test_report_endpoints.py::test_download_pdf_idor_cross_user_forbidden` -> **PASSED**
  - `tests/test_report_endpoints.py::test_download_pdf_not_found` -> **PASSED**

---

### 2.2 Cross-Origin Resource Sharing (CORS) Misconfiguration
- **Vulnerability ID:** ISS-008 / SEC-02
- **Severity:** MEDIUM
- **Location:** `backend/app/main.py` (L56–62)
- **Observed Configuration:**
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=False,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- **Impact:**
  While `allow_credentials` is properly set to `False` (preventing ambient credential leakage via cookies), wildcard `*` origins allow any web domain to issue client-side requests to the API.
- **Production Recommendation:**
  In staging and production environments, configure `allow_origins` to explicitly bind to authorized domain endpoints:
  ```python
  allowed_origins = [
      "https://diasense-ai.vercel.app",
      "https://diasense.onrender.com",
      "http://localhost:5173",
      "http://localhost:3000",
  ]
  ```

---

### 2.3 Secret Management & Version Control Exposure
- **Vulnerability ID:** ISS-009 / SEC-03
- **Severity:** HIGH (Operational Risk)
- **Locations:** `backend/app/config/settings.py`, `backend/.env`
- **Observed Configuration:**
  - A default JWT secret string and Supabase connection URI containing encoded database credentials were found in `.env` and fallback constants in `settings.py`.
- **Mitigation & Defense-in-Depth:**
  1. The remote Supabase endpoint is currently invalid/expired (preventing live exploitation).
  2. For production deployments (e.g., Render, Railway, AWS ECS), environment variables must be injected strictly through platform secret stores, with `.env` files omitted from production artifacts and excluded via `.gitignore`.
  3. A sanitized `.env.example` file has been provided with dummy template placeholders.

---

### 2.4 Authentication & Session Management
- **Password Storage:** Verified. `passlib[bcrypt]` is used to hash passwords with a unique cryptographic salt per user. Plaintext passwords are never persisted to disk or logged.
- **Token Security:** Verified. JWT tokens are signed using `HS256` with tamper-proof signature verification on all protected endpoints (`get_current_user` dependency).
- **Token Expiry:** Standard access tokens are set to expire after 7 days (`ACCESS_TOKEN_EXPIRE_MINUTES = 10080`). For enterprise healthcare environments, a 15-minute access token combined with refresh token rotation is recommended.

---

### 2.5 Injection Defense & Database Integrity
- **SQL Injection:** **ZERO VULNERABILITY FOUND**. All database transactions utilize SQLAlchemy ORM with bound parameterized queries (`db.query(Model).filter(...)`). No raw string formatting or SQL concatenation exists.
- **Input Sanitization:** All payload endpoints enforce Pydantic schema validation (`app.schemas.*`). Out-of-range clinical inputs (e.g., negative glucose, impossible age) are rejected with HTTP 422 Unprocessable Entity before reaching services or the database.

---

### 2.6 Healthcare Privacy & Data Handling (HIPAA / GDPR Alignment)
1. **Local-First ML Screening:** Prediction inference executes completely on the local host or private backend instance using scikit-learn models (`diabetes_pipeline_v2.pkl`). Sensitive metabolic parameters (fasting glucose, HbA1c) are never transmitted to external third-party AI APIs during standard screening.
2. **Generative AI Opt-In:** External generative calls to Google Gemini occur strictly for non-PHI educational questions (Food analysis and General Medical Chatbot) only when explicitly configured by the administrator.
3. **Medical Disclaimers:** All diagnostic and risk outputs carry prominent disclaimers clearly classifying DiaSense AI as an educational risk screening tool rather than a certified medical device.
