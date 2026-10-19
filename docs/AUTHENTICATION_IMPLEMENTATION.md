# DiaSense AI — Authentication & Password Recovery Implementation Documentation

**Date:** 2026-10-19  
**System:** DiaSense AI  
**Scope:** Full-stack implementation details for registration, login, session persistence, password recovery, database integration, and UI routes.

---

## 1. Summary of Changes

### Backend Changes
1. **`backend/app/models/user.py`**
   - Added `reset_token = Column(String(255), nullable=True)`
   - Added `reset_token_expiry = Column(DateTime, nullable=True)`
2. **`backend/app/schemas/auth_schema.py`**
   - Added `ForgotPasswordRequest` schema (`email: EmailStr`)
   - Added `ResetPasswordRequest` schema (`token: str`, `new_password: str`)
3. **`backend/app/routes/auth_routes.py`**
   - Added `POST /api/auth/forgot-password`
   - Added `POST /api/auth/reset-password`
   - Added `POST /api/auth/logout`
4. **`backend/app/services/auth_service.py`**
   - Updated duplicate registration error message to exact specification: `"An account with this email already exists. Try logging in or resetting your password."`
   - Implemented `forgot_password(request)` with cryptographically secure URL-safe token generation and 1-hour expiry.
   - Implemented `reset_password(request)` with token validation, expiry verification, and bcrypt password hashing.
5. **`backend/app/services/email_service.py`**
   - Added `send_password_reset_email(email, reset_token, full_name)` supporting live SMTP delivery and development console logging.
6. **`backend/app/config/database.py`**
   - Standardized canonical SQLite absolute path to prevent split-brain database files across different execution directories.
   - Added automated non-destructive schema migration inside `init_db()` to automatically add `reset_token` and `reset_token_expiry` to existing databases without data loss.
7. **`backend/.env`**
   - Extended `ACCESS_TOKEN_EXPIRE_MINUTES` to `1440` (24 hours).
8. **`backend/tests/test_auth.py`**
   - Added comprehensive regression tests covering registration, login, duplicate email prevention, invalid credentials, forgot-password, reset-password, invalid reset tokens, unauthenticated route rejection, and logout.

### Frontend Changes
1. **`frontend/src/services/api.js`**
   - Added `authService.logout()`, `authService.forgotPassword(data)`, and `authService.resetPassword(data)`.
2. **`frontend/src/pages/Login/Login.jsx`**
   - Added accessible **"Forgot password?"** link directly under the password field linking to `/forgot-password`.
3. **`frontend/src/pages/ForgotPassword/ForgotPassword.jsx` & `ForgotPassword.css`**
   - Created dedicated password recovery page matching DiaSense AI's high-tech medical UI theme.
   - Includes development quick-link so testers can immediately reset passwords without live SMTP configuration.
4. **`frontend/src/pages/ResetPassword/ResetPassword.jsx` & `ResetPassword.css`**
   - Created dedicated password reset page with token parsing, new password fields, real-time password strength checklist, and automatic redirection to `/login` upon success.
5. **`frontend/src/App.jsx`**
   - Registered `/forgot-password` and `/reset-password` public routes.
6. **`frontend/src/locales/en.json`**
   - Added comprehensive internationalization keys for all password reset strings and error messages.
7. **`frontend/src/components/Navbar/Navbar.jsx`**
   - Updated `handleLogout` to dispatch `authService.logout()`, clean `localStorage`, and redirect to `/login`.

---

## 2. API Specifications

### `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123!",
    "age": 35,
    "gender": "Female"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "access_token": "...",
      "refresh_token": "...",
      "token_type": "bearer",
      "user_id": 1,
      "full_name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
  ```
- **Duplicate Error (400 Bad Request):**
  ```json
  {
    "detail": "An account with this email already exists. Try logging in or resetting your password."
  }
  ```

### `POST /api/auth/forgot-password`
- **Request Body:**
  ```json
  {
    "email": "jane@example.com"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "If an account with that email exists, a reset link has been sent.",
    "data": {
      "message": "If an account with that email exists, password reset instructions have been sent.",
      "email": "jane@example.com",
      "reset_token": "..."
    }
  }
  ```

### `POST /api/auth/reset-password`
- **Request Body:**
  ```json
  {
    "token": "...",
    "new_password": "NewSecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Password has been reset successfully. Please log in with your new password.",
    "data": {}
  }
  ```

### `POST /api/auth/logout`
- **Headers:** `Authorization: Bearer <access_token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully",
    "data": {}
  }
  ```
