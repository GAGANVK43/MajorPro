# DiaSense AI — RESTful API Specification & Developer Guide

**API Version:** 1.0.0  
**Base URL (Local):** `http://127.0.0.1:8000`  
**Base URL (Cloud/Production):** `https://diasense-ai-backend.onrender.com`  
**Interactive Docs:** Swagger UI at `/docs` | ReDoc at `/redoc` | OpenAPI spec at `/openapi.json`  

---

## 1. Authentication & Security Architecture

DiaSense AI uses standard **JSON Web Tokens (JWT)** with the `HS256` symmetric signing algorithm.
To access protected endpoints, clients must include the Bearer token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Tokens expire by default after **10,080 minutes (7 days)** as configured in `settings.ACCESS_TOKEN_EXPIRE_MINUTES`.

### Standard Response Envelope
All API endpoints return JSON conforming to the unified response contract:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

In the event of an error:
```json
{
  "success": false,
  "message": "Descriptive human-readable error message",
  "detail": [ ... ]
}
```

---

## 2. API Endpoints Directory

### 2.1 Health & Diagnostics

#### `GET /health`
- **Access:** Public
- **Description:** System health check and uptime probe.
- **Response:**
  ```json
  {
    "success": true,
    "message": "DiaSense AI Backend is running smoothly.",
    "data": {
      "status": "healthy",
      "app_name": "DiaSense AI Backend",
      "environment": "development"
    }
  }
  ```

---

### 2.2 Authentication Endpoints (`/api/auth`)

#### `POST /api/auth/register`
- **Access:** Public
- **Description:** Registers a new patient/user account with password hashing via passlib bcrypt.
- **Request Body:**
  ```json
  {
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "password": "Password123!",
    "age": 45,
    "gender": "Male"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": 1,
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "age": 45,
        "gender": "Male"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### `POST /api/auth/login`
- **Access:** Public
- **Description:** Authenticates user credentials and issues a JWT token.
- **Request Body:**
  ```json
  {
    "email": "rajesh@example.com",
    "password": "Password123!"
  }
  ```

#### `GET /api/auth/me`
- **Access:** Protected (`Bearer <token>`)
- **Description:** Returns profile metadata for the authenticated user.

---

### 2.3 Assessment Endpoints (`/api/assessment`)

#### `POST /api/assessment`
- **Access:** Protected
- **Description:** Records clinical assessment variables from manual form entry or OCR document confirmation.
- **Request Body:**
  ```json
  {
    "age": 48,
    "gender": "Male",
    "bmi": 27.4,
    "blood_pressure": 135.0,
    "physical_activity_hours": 2.5,
    "daily_sugar_intake": 45.0,
    "fast_food_frequency": 3.0,
    "sleep_hours": 6.5,
    "hba1c": 6.2,
    "fasting_glucose": 118.0,
    "family_history": 1,
    "monthly_income": 45000.0,
    "month": 10
  }
  ```

#### `GET /api/assessment/latest`
- **Access:** Protected
- **Description:** Retrieves the patient's most recent clinical assessment.

#### `GET /api/assessment/history`
- **Access:** Protected
- **Description:** Returns a chronological list of prior assessments.

---

### 2.4 Machine Learning Prediction Endpoints (`/api/prediction`)

#### `POST /api/prediction`
- **Access:** Protected
- **Description:** Executes inference using the gradient-boosted Indian diabetes screening pipeline.
- **Request Body:** Accepts either an `assessment_id` or raw inline feature parameters.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Diabetes risk assessment completed.",
    "data": {
      "prediction_id": 14,
      "prediction_label": "Diabetic",
      "risk_score": 0.725,
      "confidence_score": 0.885,
      "recommendation": "Elevated metabolic pattern detected. Schedule a formal fasting plasma glucose or oral glucose tolerance test.",
      "contributing_factors": [
        {"factor": "Daily Sugar Intake", "impact": "High", "value": 45.0},
        {"factor": "HbA1c", "impact": "Elevated", "value": 6.2},
        {"factor": "BMI", "impact": "Overweight", "value": 27.4}
      ]
    }
  }
  ```

#### `GET /api/prediction/accuracy`
- **Access:** Public
- **Description:** Returns authentic clinical validation metrics from the test set evaluation ($N=3,825$).
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "accuracy": 0.8227,
      "accuracy_percentage": "82.27%",
      "roc_auc": 0.8862,
      "precision": 0.7013,
      "recall": 0.7462,
      "dataset": "India Diabetes Patient Dataset (25,500 records)"
    }
  }
  ```

---

### 2.5 Diet & Nutritional Plan Endpoints (`/api/diet`)

#### `POST /api/diet/generate`
- **Access:** Protected
- **Description:** Generates an individualized 7-day low-glycemic dietary regimen based on risk level and regional preference.
- **Request Body:**
  ```json
  {
    "prediction_id": 14,
    "dietary_preference": "Vegetarian",
    "region": "South Indian"
  }
  ```

#### `GET /api/diet/latest`
- **Access:** Protected
- **Description:** Returns the active 7-day meal schedule complete with macronutrient breakdowns, GI scores, and hydration guidance.

---

### 2.6 Medical Report Extraction Endpoints (`/api/smart-assessment`)

#### `POST /api/smart-assessment/extract`
- **Access:** Protected
- **Description:** Accepts multi-page PDF or image lab reports (CBC, Lipid, Metabolic Panels). Extracts clinical biomarkers using regex and OCR fallback.
- **Form Data:** `file` (Multipart file upload)
- **Extracted Fields:** Fasting Blood Sugar, HbA1c, Postprandial Glucose, Total Cholesterol, Triglycerides, Blood Pressure, BMI.

---

### 2.7 Certified PDF Health Reports (`/api/reports`)

#### `GET /api/reports/latest/pdf`
- **Access:** Protected
- **Description:** Streams a high-resolution, certified 2-page medical summary report created via ReportLab.
- **Content-Type:** `application/pdf`

#### `GET /api/reports/{id}/pdf`
- **Access:** Protected (IDOR Guard Enforced)
- **Description:** Streams the specific archived report for record `{id}`. Returns `403 Forbidden` if accessed across different user accounts.

---

### 2.8 Multilingual Health Assistant & Chatbot (`/api/chatbot`)

#### `POST /api/chatbot/query`
- **Access:** Public or Protected
- **Description:** Evaluates healthcare questions with Generative AI (Gemini 2.5 Flash) with fallback to an extensive 6-language clinical knowledge base.
- **Request Body:**
  ```json
  {
    "message": "ನನಗೆ ಮಧುಮೇಹ ಬರದಂತೆ ತಡೆಯಲು ಏನು ಮಾಡಬೇಕು?",
    "language": "kn"
  }
  ```
- **Response:**
  ```json
  {
    "reply": "ಮಧುಮೇಹವನ್ನು ತಡೆಗಟ್ಟಲು: ದಿನಕ್ಕೆ 30 ನಿಮಿಷ ವಾಕಿಂಗ್ ಮಾಡಿ, ಕಡಿಮೆ ಗ್ಲೈಸೆಮಿಕ್ ಇಂಡೆಕ್ಸ್ ಆಹಾರಗಳನ್ನು ಸೇವಿಸಿ...",
    "source": "DiaSense AI Assistant"
  }
  ```

---

### 2.9 Food Nutrition & Vision Analyzer (`/api/food`)

#### `POST /api/food/analyze-image`
- **Access:** Protected or Public
- **Description:** Processes a food dish photo through Gemini Vision multimodal inspection or authentic Indian diabetic culinary knowledge base.
- **Form Data:** `file` (Image), `language` (e.g. `en`, `hi`, `kn`)
- **Response:** Returns dish name, calories, net carbs, protein, fiber, fat, glycemic index, glycemic load, and localized diabetic suitability badge (`Diabetic Friendly`, `Moderate Intake`, `Avoid`).

---

### 2.10 Location-Based Healthcare Facilities (`/api/nearby`)

#### `GET /api/nearby/hospitals`
- **Access:** Public
- **Query Parameters:** `lat`, `lng`, `radius` (default: 5000 meters)
- **Description:** Computes geodesic Haversine distance to hospitals, diagnostic pathology labs, and endocrinology clinics.
