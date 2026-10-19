# DiaSense AI — Authentication & Regression Test Report

**Date:** 2026-10-19  
**Execution Environment:** Windows 11, Python 3.14.7, Node.js, Vite 8.1.5, Pytest 9.1.1  
**Target:** `DiaSenseAI/project_src`

---

## 1. Automated Test Execution

### Pytest Auth Suite (`backend/tests/test_auth.py`)
Command:
```bash
python -m pytest tests/test_auth.py -v
```

Output:
```
============================= test session starts =============================
platform win32 -- Python 3.14.7, pytest-9.1.1, pluggy-1.6.0
collected 8 items

tests/test_auth.py::test_register_and_login_flow PASSED                 [ 12%]
tests/test_auth.py::test_duplicate_registration_prevented PASSED        [ 25%]
tests/test_auth.py::test_login_invalid_credentials PASSED               [ 37%]
tests/test_auth.py::test_forgot_password_flow PASSED                    [ 50%]
tests/test_auth.py::test_reset_password_flow PASSED                     [ 62%]
tests/test_auth.py::test_reset_password_invalid_token PASSED            [ 75%]
tests/test_auth.py::test_unauthenticated_protected_route_rejected PASSED [ 87%]
tests/test_auth.py::test_logout_endpoint PASSED                         [100%]

======================= 8 passed, 88 warnings in 5.92s ========================
```

### Pytest Security & IDOR Suite (`backend/tests/test_report_endpoints.py`)
Command:
```bash
python -m pytest tests/test_report_endpoints.py -v
```

Output:
```
============================= test session starts =============================
collected 6 items

tests/test_report_endpoints.py::test_download_pdf_success_with_bearer_token PASSED [ 16%]
tests/test_report_endpoints.py::test_download_pdf_success_with_query_token PASSED  [ 33%]
tests/test_report_endpoints.py::test_download_pdf_unauthenticated PASSED           [ 50%]
tests/test_report_endpoints.py::test_download_pdf_idor_cross_user_forbidden PASSED [ 66%]
tests/test_report_endpoints.py::test_download_pdf_not_found PASSED                [ 83%]
tests/test_report_endpoints.py::test_get_report_metadata PASSED                   [100%]

======================= 6 passed, 89 warnings in 5.49s ========================
```

### Frontend Production Build
Command:
```bash
npm run build (in frontend/)
```

Output:
```
vite v8.1.5 building client environment for production...
transforming...✓ 1119 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.17 kB │ gzip:   0.57 kB
dist/assets/index-DeXjeM2B.css    137.82 kB │ gzip:  24.34 kB
dist/assets/index-DzMXzr_b.js   1,467.14 kB │ gzip: 405.65 kB
✓ built in 2.03s
```

---

## 2. Acceptance Criteria Verification Matrix

| # | Acceptance Criterion | Status | Evidence / Verification |
| :--- | :--- | :---: | :--- |
| **1** | A new user registers using their email address and password. | **PASS** | `test_register_and_login_flow` PASSED. Form in `Register.jsx` properly validated and returns JWT tokens. |
| **2** | Registration creates one account, not a new account on every visit. | **PASS** | User records are saved to the persistent database with UNIQUE constraint on `email`. |
| **3** | A user who already has an account can log in using their registered email and password. | **PASS** | `test_register_and_login_flow` & `Login.jsx` successfully authenticate against hashed bcrypt passwords. |
| **4** | Attempting to register with an existing email must not create a duplicate account. | **PASS** | `test_duplicate_registration_prevented` PASSED with HTTP 400. No duplicate records inserted. |
| **5** | Show clear message: "An account with this email may already exist. Try logging in or resetting your password." | **PASS** | Verified in `auth_service.py:43` and `en.json:139`. Returned in HTTP 400 response body and rendered by toast. |
| **6** | Provide a "Forgot password?" link on the login page. | **PASS** | Verified in `Login.jsx:106`. Renders link to `/forgot-password` directly below the password input field. |
| **7** | User enters registered email and receives password-reset link. | **PASS** | `test_forgot_password_flow` PASSED. Secure token generated and dispatched via `EmailService`. |
| **8** | Reset link opens secure reset-password page where user sets new password. | **PASS** | `ResetPassword.jsx` registered at `/reset-password`, parses token from URL parameter, validates password strength. |
| **9** | New password works for subsequent logins. | **PASS** | `test_reset_password_flow` PASSED. Verified old password fails (401) and new password succeeds (200). |
| **10** | Existing authenticated users remain logged in across page reloads according to session policy. | **PASS** | `ACCESS_TOKEN_EXPIRE_MINUTES` extended to 1440 (24h). `localStorage` holds token and reloads persist session. |
| **11** | Logout ends local authenticated session and revokes credentials. | **PASS** | `test_logout_endpoint` PASSED. `handleLogout` in `Navbar.jsx` clears `access_token`, `user`, and navigates to `/login`. |
| **12** | Protected pages and APIs reject unauthenticated requests. | **PASS** | `test_unauthenticated_protected_route_rejected` PASSED (401). `ProtectedRoute.jsx` redirects unauthenticated visitors. |
| **13** | User profiles and application records persist in database. | **PASS** | Anchored canonical database path eliminates split-brain data loss. Schema auto-migration preserves all user rows. |
| **14** | Supabase database audit conducted & documented. | **PASS** | Detailed socket & psycopg2 diagnostics documented in `docs/SUPABASE_DATABASE_AUDIT.md`. |
