# DiaSense AI — System Architecture Specification (Ground Truth)

**Project Name:** DiaSense AI — AI-Based Diabetes Prediction and Health Assistance System  
**Institution:** East Point College of Engineering and Technology, Bengaluru  
**Department:** Computer Science & Engineering  
**Version:** 2.0 (Production Architecture)  
**Date:** October 2026

---

## 1. High-Level Architecture Overview

DiaSense AI is designed with an **Enterprise Clean Architecture** separating concerns across presentation, application orchestration, clinical inference, and data persistence layers.

```mermaid
graph TD
    subgraph Client Layer
        WebClient["React 19 + Vite Frontend SPA<br/>(Tailwind CSS, Responsive)"]
        MobileClient["Mobile PWA / Viewport Client<br/>(Touch & Voice Enabled)"]
    end

    subgraph Gateway & Middleware
        CORS["CORS Middleware"]
        AuthMiddleware["JWT Authentication<br/>(Bearer Token & Query Param)"]
        I18nMiddleware["Accept-Language Resolution<br/>(EN, KN, HI, TA, TE, ML)"]
    end

    subgraph Application Service Layer
        AuthSvc["Auth & User Profile Service"]
        AssessSvc["Assessment Service"]
        PredSvc["Prediction & Health Story Service"]
        DietSvc["Tailored Indian Diet Service"]
        FoodSvc["Food AI Nutrition & Vision Service"]
        ChatSvc["Medical NLP Chatbot Service"]
        ReportSvc["Certified Clinical PDF Generator"]
        CareSvc["Nearby Healthcare Locator Service"]
        OcrSvc["Medical Report OCR & Extractor"]
    end

    subgraph Machine Learning Engine
        Preprocessor["Pipeline Preprocessor<br/>(Imputation, Scaling, OHE)"]
        FeatureEng["Clinical Feature Engineering<br/>(Sugar_x_Activity, Age_x_BMI)"]
        Model["India Clinical Dataset Model<br/>(XGBoost / GradientBoosting)"]
        ThresholdEngine["Optimized Decision Engine<br/>(Clinical Threshold: 0.31 / 0.45)"]
    end

    subgraph Data & Storage Layer
        Postgres["Supabase PostgreSQL 15+<br/>(Hosted Cloud Database)"]
        SQLite["SQLite Fallback Database<br/>(diasense.db - Zero-Config Local)"]
    end

    subgraph External Services
        GeminiAPI["Google Gemini Vision & Generative AI<br/>(Optional Cloud Intelligence)"]
        OSM["OpenStreetMap Overpass API<br/>(Public Healthcare POI)"]
        Nominatim["Nominatim Geocoder API<br/>(Coordinates & Pincode Resolution)"]
    end

    WebClient --> CORS
    MobileClient --> CORS
    CORS --> AuthMiddleware
    AuthMiddleware --> I18nMiddleware

    I18nMiddleware --> AuthSvc
    I18nMiddleware --> AssessSvc
    I18nMiddleware --> PredSvc
    I18nMiddleware --> DietSvc
    I18nMiddleware --> FoodSvc
    I18nMiddleware --> ChatSvc
    I18nMiddleware --> ReportSvc
    I18nMiddleware --> CareSvc
    I18nMiddleware --> OcrSvc

    AssessSvc --> PredSvc
    PredSvc --> Preprocessor
    Preprocessor --> FeatureEng
    FeatureEng --> Model
    Model --> ThresholdEngine

    PredSvc --> DietSvc
    PredSvc --> ReportSvc

    AuthSvc --> Postgres
    AssessSvc --> Postgres
    PredSvc --> Postgres
    DietSvc --> Postgres
    Postgres -. Fallback .-> SQLite

    FoodSvc -. API Key .-> GeminiAPI
    ChatSvc -. API Key .-> GeminiAPI
    CareSvc --> OSM
    CareSvc --> Nominatim
```

---

## 2. Component Architecture Breakdown

### 2.1 Frontend Architecture (React 19 + Vite 8)
- **Directory**: `frontend/src/`
- **Routing**: Client-side routing via `react-router-dom` v7.
  - Public routes: `/`, `/login`, `/register`, `/about`, `/contact`
  - Protected routes: `/dashboard`, `/assessment`, `/result`, `/diet-plan`, `/food-analyzer`, `/find-care`, `/profile`
- **State Management**:
  - JWT Access Token stored in `localStorage` under `access_token`.
  - Active user session stored in `localStorage` under `user`.
  - Selected locale stored in `localStorage` under `diasense_language`.
  - `LanguageContext` provides dynamic runtime translation strings from JSON catalogs (`en.json`, `kn.json`, `hi.json`, `ta.json`, `te.json`, `ml.json`).
- **Voice Engine**:
  - Web Speech API integration in `useVoiceAssistant.js` and `VoiceEngine.js`.
  - Hands-free question narration and speech-to-text form input.

### 2.2 Backend Architecture (FastAPI + SQLAlchemy 2.0)
- **Directory**: `backend/app/`
- **Application Core**: `main.py`
  - Lifespan context manager initializes database tables (`init_db()`) and preloads ML models.
  - Standardized JSON responses via `success_response` and `error_response` helpers.
  - Global error handling for validation errors (422), HTTP exceptions, and uncaught exceptions (500).
- **Routers**:
  1. `auth_routes.py`: Registration, JWT login, token verification.
  2. `user_routes.py`: Profile retrieval, updates, password change.
  3. `assessment_routes.py`: Assessment creation, history, individual lookup.
  4. `prediction_routes.py`: Inference execution, latest result, historical trends.
  5. `dashboard_routes.py`: Aggregated user metrics, risk trajectory, quick glance metrics.
  6. `diet_routes.py`: Dynamic 7-day Indian meal plan retrieval.
  7. `food_routes.py`: Text nutrition search and image food vision analyzer.
  8. `chatbot_routes.py`: Multilingual medical assistant query handler.
  9. `report_routes.py`: Certified clinical PDF generation and stream download.
  10. `nearby_care_routes.py`: Geocoded hospital/diagnostic lab discovery.
  11. `smart_assessment_routes.py`: PDF medical report extraction pipeline.
  12. `contact_routes.py`: Inquiries and admin email dispatch.

### 2.3 Machine Learning Pipeline Architecture
- **Dataset**: India Diabetes Patient Dataset (25,500 patient records collected from clinical surveys across Indian urban, semi-urban, and rural populations).
- **Inference Pipeline**:
  1. **Input Normalization**: Patient demographics (Age, Gender, Urban/Rural), clinical lab values (Fasting Glucose, HbA1c, Blood Pressure), anthropometrics (BMI), and lifestyle habits (Daily Sugar, Fast Food, Physical Activity, Sleep, Family History).
  2. **Feature Engineering**: Interaction terms (`Sugar_x_Activity`, `Age_x_BMI`, `FamilyHistory_x_Age`), glycemic category bins (`HbA1c_Category`, `Glucose_Category`), and lifestyle indices.
  3. **Preprocessing Pipeline**: Scikit-Learn `ColumnTransformer` with median imputation and `StandardScaler` for numerical values; mode imputation and `OrdinalEncoder` for categoricals.
  4. **Ensemble Classifier**: Tuned Gradient Boosting / XGBoost Classifier.
  5. **Clinical Threshold Tuning**: Decision boundary set at `0.31` (maximizing F1-score and clinical sensitivity/recall to 79.97% to minimize false negatives in medical screening).
  6. **Explainability Engine**: Computes patient-specific contributing factors categorized by physiological impact (High Risk, Moderate Risk, Optimal) with clinical rationales.

### 2.4 Database Schema & Persistence
- **Primary Database**: Supabase PostgreSQL 15+ via connection pooling.
- **Failover Engine**: Embedded SQLite database (`diasense.db`) automatically activated if remote connection fails.
- **ORM**: SQLAlchemy 2.0 with Declarative Mapping.
- **Entity Relationship Model**:
  - `User` (1) ── (N) `Assessment` (1) ── (1) `Prediction` (1) ── (1) `DietPlan`
  - `User` (1) ── (N) `ContactMessage`

```mermaid
erDiagram
    USERS ||--o{ ASSESSMENTS : submits
    ASSESSMENTS ||--|| PREDICTIONS : generates
    PREDICTIONS ||--|| DIET_PLANS : provides
    USERS ||--o{ CONTACTS : sends

    USERS {
        int id PK
        string email UK
        string password
        string full_name
        int age
        string gender
        datetime created_at
    }

    ASSESSMENTS {
        int id PK
        int user_id FK
        string patient_group
        string gender
        int age
        float bmi
        float blood_pressure
        float hba1c
        float fasting_glucose
        float physical_activity_hours
        float daily_sugar_intake
        float fast_food_frequency
        float sleep_hours
        float family_history
        float monthly_income
        datetime created_at
    }

    PREDICTIONS {
        int id PK
        int assessment_id FK
        string prediction
        float risk_percentage
        float confidence
        datetime created_at
    }

    DIET_PLANS {
        int id PK
        int prediction_id FK
        text breakfast
        text lunch
        text dinner
        text snacks
        text exercise
        text tips
        datetime created_at
    }
```

---

## 3. End-to-End Data Flows

### 3.1 Screening & Assessment Flow
1. User uploads a PDF medical report or completes the smart voice-guided assessment on `/assessment`.
2. Digital PDF values are extracted in milliseconds via `medical_report_extractor.py` without external cloud dependencies.
3. Extracted fields populate form state synchronously; missing fields are highlighted for user completion.
4. Client sends POST request to `/api/prediction` with JWT Bearer Token.
5. Server executes preprocessing, feature engineering, and ensemble model inference.
6. Server persists `Assessment`, `Prediction`, and automatically generates a tailored Indian `DietPlan`.
7. Client receives prediction score, risk percentage, explainability cards, and navigates to `/result`.

### 3.2 Certified PDF Health Report Flow
1. From Result or Dashboard, user clicks "Download Health Report".
2. Client requests `/api/reports/latest/pdf` (or `/api/reports/{id}/pdf`).
3. Server loads assessment, prediction, clinical thresholds, and personalized recommendations.
4. ReportService formats a clean, multi-section clinical PDF matching professional laboratory report standards using ReportLab.
5. Streamed back as `application/pdf` with `Content-Disposition: attachment`.

### 3.3 Nearby Healthcare Facilities Flow
1. User enters location, locality name, or 6-digit Indian PIN code (e.g. `560049`, `560001`, `110001`).
2. Server geocodes location through fast internal PIN cluster lookup or OpenStreetMap Nominatim.
3. Queries OpenStreetMap Overpass across 5 distributed mirrors for hospitals, clinics, or diagnostic laboratories.
4. Filters results by Haversine distance from user coordinates, generates turn-by-turn Google Maps navigation links, and returns structured facilities list.
