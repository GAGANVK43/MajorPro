# DiaSense AI — Known Limitations & System Boundaries

**Document Purpose:** Honest, transparent technical disclosure of system boundaries, network fallbacks, and scope constraints for evaluation committees, peer reviewers, and deployment engineers.

---

## 1. Remote Database Connectivity & Local SQLite Failover
- **Condition:** The configured Supabase remote PostgreSQL pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) returns `(ENOTFOUND) tenant/user postgres.zswrgozetsvgblsigqpb not found` when the remote project is paused or network-restricted.
- **Architectural Behavior:** `backend/app/config/database.py` catches the connection failure gracefully and establishes an ACID-compliant local SQLite engine (`diasense.db`).
- **User Impact:** Zero operational interruption; all auth, predictions, assessments, and diet schedules persist locally.
- **Production Recommendation:** If deploying to a multi-instance cloud environment (e.g., Render / AWS ECS), configure an active PostgreSQL URI (`DATABASE_URL`) with connection pooling enabled.

---

## 2. OpenStreetMap Overpass API Rate Limits
- **Condition:** The OpenStreetMap Overpass public servers (`overpass-api.de`, `kumi.systems`) are shared community infrastructure subject to occasional rate limiting (HTTP 429) or high-load query timeouts (HTTP 504).
- **Architectural Behavior:** `NearbyCareService` implements a 3-tier safety net:
  1. Multi-mirror rotation across 5 distinct Overpass API endpoints.
  2. Fallback to Nominatim POI bounding-box searches.
  3. Offline verified healthcare institutions database (`VERIFIED_INDIAN_HEALTHCARE_HUBS`) with Haversine distance calculation.
- **User Impact:** Even under complete external API outage, users searching major Indian metro areas (Bengaluru, Delhi, Mumbai, Hyderabad, Chennai) receive verified medical facilities with accurate distance sorting.

---

## 3. Food Vision Classification Modes
- **Condition:** Cloud-based multimodal food image recognition uses Google Gemini Vision API (`models/gemini-2.5-flash`). This requires an active `GEMINI_API_KEY` in `backend/.env`.
- **Architectural Behavior:** When `GEMINI_API_KEY` is not present, DiaSense executes an offline **Perceptual Visual Feature Extraction Engine** (statistical RGB color distribution, standard deviation texture variance, and blank image detection).
- **User Impact:** 
  - If a user uploads an image with ambiguous contrast, the system flags `is_ambiguous: true` with an explanatory notice.
  - The UI presents clickable candidate alternatives and an inline **Dish Correction Box** with a **Recalculate** button, allowing the user to select or type the exact dish without re-uploading.

---

## 4. Clinical & Legal Screening Boundary
- **Classification Nature:** DiaSense AI is a **metabolic risk screening and health guidance system**, NOT a medical diagnostic device.
- **Terminology:** In compliance with clinical validation standards (ADA / WHO / ICMR), machine learning predictions are classified as **"Elevated Risk Pattern"** or **"Lower Risk Pattern"**, never as a definitive clinical diagnosis.
- **Safety Prompts:** Every screening report, dashboard, food analysis, and nearby care view explicitly presents a clinical advisory emphasizing consultation with registered healthcare professionals.
