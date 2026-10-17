# DiaSense AI — Food Analyzer Setup & Operational Guide

## 1. System Requirements & Prerequisites

- **Operating System**: Windows 10/11, macOS, or Linux (Ubuntu 20.04+).
- **Python**: Python 3.10 to 3.14 (tested and verified on Python 3.14.7 x64).
- **Node.js**: Node.js 18+ (tested on Node v20/v22) and `npm`.
- **Memory**: Minimum 4 GB RAM (deep vision engine requires ~10 MB RAM footprint).
- **Hardware Acceleration**: CPU-only execution fully supported and optimized (average inference latency ~33 ms). No GPU required.

---

## 2. Backend Installation & Environment Setup

### 2.1 Dependencies Installation
From `DiaSenseAI/project_src/backend`:

```bash
# Core web framework & ML libraries
pip install -r requirements.txt

# PyTorch CPU & Computer Vision Backbone
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 2.2 Environment Configuration (`backend/.env`)
Create or edit `backend/.env`:

```env
# Server Configuration
ENVIRONMENT=development
PORT=8000

# Optional Multimodal Cloud Vision (Gemini / OpenAI)
# If provided, the system utilizes cloud multimodal vision.
# If omitted or empty (""), the system automatically operates via local DeepFoodVisionEngine (MobileNetV3).
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database (falls back automatically to local SQLite if PostgreSQL is unreachable)
DATABASE_URL=sqlite:///./diasense.db
```

---

## 3. Frontend Installation & Execution

From `DiaSenseAI/project_src/frontend`:

```bash
# Install NPM packages
npm install

# Start Vite Development Server
npm run dev
# The application will be available at http://localhost:5173

# Production Build
npm run build
```

---

## 4. Running the Complete System

### Terminal 1: Backend API Service
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is accessible at `http://127.0.0.1:8000/docs`.

### Terminal 2: Frontend Web Client
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173/food-analyzer` to access the interactive Food Analyzer.

---

## 5. Running the Test Suite

Execute the full automated test suite to verify vision model inference, clinical nutrition mapping, and zero-staleness concurrency:

```bash
cd backend

# Run dedicated Food Analyzer tests
python -m pytest tests/test_food_analyzer_rebuild.py tests/test_food_analysis.py -v

# Run entire backend test suite
python -m pytest tests/ -v
```
