# DiaSense AI — Deployment & Infrastructure Guide

**Guide Version:** 2.0  
**Target Environments:** Local Workstation (Development) & Multi-Cloud (Production: Render + Vercel)  
**System Components:** FastAPI Python Backend + React Vite Frontend + PostgreSQL / SQLite Database  

---

## 1. System Requirements & Prerequisites

### Minimum Hardware
- **CPU:** Dual-core processor (Quad-core recommended for XGBoost inference)
- **RAM:** Minimum 4 GB (8 GB recommended)
- **Storage:** 2 GB free disk space

### Software Runtimes
- **Python:** 3.10 – 3.14 (Verified on Python 3.14)
- **Node.js:** v18.0.0 or higher (with npm v9+)
- **Git:** 2.30+

---

## 2. Local Workstation Setup (Step-by-Step)

### Step 2.1 — Clone & Repository Navigation
```powershell
git clone https://github.com/GAGANVK43/MajorPro.git
cd MajorPro\DiaSenseAI\project_src
```

### Step 2.2 — Backend Environment Setup
1. Open a terminal in `backend/`:
   ```powershell
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install production and ML dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Configure Environment Variables:
   Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
   *Note: If no PostgreSQL `DATABASE_URL` is configured or if Supabase is unreachable, DiaSense AI automatically initializes and operates on local SQLite (`diasense.db`).*

5. Verify Test Suite:
   ```powershell
   python -m pytest tests/ -v
   ```
   *Expected: 42 passed (100% pass rate).*

6. Launch the FastAPI Development Server:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - API Root: `http://127.0.0.1:8000`
   - Interactive Swagger Docs: `http://127.0.0.1:8000/docs`
   - Health Probe: `http://127.0.0.1:8000/health`

---

### Step 2.3 — Frontend Environment Setup
1. In a separate terminal, navigate to `frontend/`:
   ```powershell
   cd frontend
   ```
2. Install Node dependencies:
   ```powershell
   npm install
   ```
3. Create Local Environment Configuration:
   Create `.env.local` or edit `.env`:
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```
4. Verify Production Build:
   ```powershell
   npm run build
   ```
5. Launch Vite Development Server:
   ```powershell
   npm run dev
   ```
   - Frontend Application: `http://localhost:5173`

---

## 3. Production Cloud Deployment

### 3.1 Backend Deployment on Render (Web Service)

The repository includes a root `render.yaml` specification for zero-config deployments.

#### Configuration Settings:
- **Environment:** Python 3
- **Root Directory:** `DiaSenseAI/project_src/backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`
- **Health Check Path:** `/health`

#### Required Environment Variables in Render Dashboard:
| Variable Name | Recommended Value / Description |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Your active PostgreSQL Connection String (or leave empty for SQLite) |
| `JWT_SECRET_KEY` | Generate via `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) |
| `GEMINI_API_KEY` | *(Optional)* Google AI Studio API key for Food Vision & Generative Chatbot |
| `CORS_ORIGINS` | `https://your-frontend-app.vercel.app` |

---

### 3.2 Frontend Deployment on Vercel

The frontend includes a pre-configured `vercel.json` routing all SPA deep links to `/index.html`.

#### Deployment Steps:
1. Connect your GitHub repository to Vercel.
2. Set **Root Directory** to:
   `DiaSenseAI/project_src/frontend`
3. Framework Preset: **Vite**
4. Configure Build & Output:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Configure Environment Variables in Vercel Project Settings:
   - `VITE_API_BASE_URL`: `https://diasense-ai-backend.onrender.com`
6. Click **Deploy**.

---

## 4. Production Smoke Test & Health Checklist

After deploying, verify the following sequence:
1. `GET https://<backend>/health` returns `{"success": true, "data": {"status": "healthy"}}`.
2. `GET https://<backend>/docs` loads the Swagger UI.
3. Open `https://<frontend>`, register a test user, and log in.
4. Complete an assessment and verify prediction returns in $<500$ ms.
5. Download the certified PDF report and verify layout and data integrity.
6. Test multilingual toggle (English, Hindi, Kannada) and verify question voice synthesis.
