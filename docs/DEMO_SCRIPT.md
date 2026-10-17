# DiaSense AI — Final-Year Major Project Live Demonstration Script

**Project Title:** DiaSense AI — AI-Assisted Diabetes Risk Screening & Health Assistance System  
**Institution:** Department of Computer Science & Engineering, East Point College of Engineering & Technology, Bengaluru  
**Presenter:** Project Team  
**Estimated Presentation Duration:** 8 – 10 Minutes  

---

## 1. Setup & Pre-Flight Checklist

Prior to entering the examination room or screen share:
- [ ] Backend active on `http://127.0.0.1:8000` (Verify via `curl http://127.0.0.1:8000/health`).
- [ ] Frontend active on `http://localhost:5173`.
- [ ] Demo account prepared: `demo@diasense.ai` / `Demo@1234` (or register fresh in $<10$ seconds).
- [ ] Sample digital laboratory blood test PDF saved on Desktop for instant drag-and-drop demonstration.
- [ ] Audio enabled for Kannada / Hindi / English voice assistant demonstration.

---

## 2. Minute-by-Minute Demonstration Walkthrough

### Minute 0:00 – 1:30 | Introduction & The Clinical Problem
- **Slide / View:** Landing Page (`/`)
- **Key Talking Points:**
  - *"Respected examiners, India is recognized globally as the diabetes capital of the world, with over 101 million diagnosed individuals and an estimated 136 million in the pre-diabetic state."*
  - *"Conventional screening suffers from two bottlenecks: clinical fear and late detection after macrovascular complications have already started."*
  - *"DiaSense AI bridges this gap as a zero-barrier, multilingual preventive health screening platform specifically calibrated for Indian dietary habits and metabolic phenotypes."*
- **Live Action:** Scroll past the Hero section. Point to the **82.27% Clinical Accuracy** badge, explaining that it is fetched live from the backend API (`/api/prediction/accuracy`), validated across 25,500 real Indian patient records.

---

### Minute 1:30 – 3:30 | Patient Authentication & Multilingual Voice Assessment
- **Live Action:**
  1. Click **"Get Started"** or **"Start Assessment"**.
  2. Demonstrate language switcher: Toggle between **English**, **Kannada (ಕನ್ನಡ)**, and **Hindi (हिन्दी)**.
  3. Show the dynamic speech synthesis reciting the question in authentic regional vernacular:
     - *ಕನ್ನಡ: "ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು?"*
     - *हिन्दी: "आपकी उम्र क्या है?"*
  4. Showcase the **Smart Report Extraction** feature:
     - Drag and drop a sample diagnostic lab report PDF.
     - Highlight that the backend extractor automatically parses Fasting Blood Sugar, HbA1c, and Lipid metrics without requiring manual data entry.
  5. Click **"Analyze My Health Risk"**.

---

### Minute 3:30 – 5:30 | ML Inference, Health Story & Explainable AI (XAI)
- **Live Action:** The **Result Page** loads in $<400$ ms.
- **Key Talking Points:**
  - *"Our backend executes an optimized Gradient Boosting / XGBoost pipeline trained on the India Diabetes Patient Dataset."*
  - *"Notice that the application does NOT claim to make a clinical medical diagnosis. Instead, it computes an authentic screening risk probability and provides an Explainable Health Story."*
  - Show the **Top Contributing Factors**:
    - Daily Sugar Intake
    - Physical Inactivity Ratio
    - Visceral BMI score
  - Click **"Why?"** on each domain card to reveal actionable, physician-aligned lifestyle advice.

---

### Minute 5:30 – 7:00 | Nutrition Plan, Food AI & Certified PDF Report
- **Live Action:**
  1. Navigate to **Diet Plan**:
     - Display the generated 7-Day Indian Low-GI meal schedule (e.g., Ragi Roti, Moong Dal Khichdi, Sprouted Salad).
     - Show the Glycemic Load calculations and regional preference filters.
  2. Open **Food Analyzer**:
     - Type or upload a popular Indian meal: *"2 Idli with Sambar"*.
     - Highlight the instant breakdown: calories, net carbohydrates, glycemic index (35), and localized diabetic suitability badge (**Diabetic Friendly**).
  3. Click **"Download Certified Health Summary (PDF)"**:
     - Open the generated ReportLab 2-page document.
     - Show the certified cryptographic timestamp, patient metric breakdown, risk gauge visualization, and clinical disclaimer.

---

### Minute 7:00 – 8:30 | Healthcare Facility Locator & AI Chatbot
- **Live Action:**
  1. Navigate to **Nearby Care**:
     - Show geodesic Haversine discovery of nearby hospitals, diabetes clinics, and diagnostic pathology labs with one-click Google Maps routing.
  2. Open the **DiaSense AI Chatbot**:
     - Ask a clinical question in Kannada: *"ಮಧುಮೇಹವನ್ನು ನಿಯಂತ್ರಿಸಲು ಉತ್ತಮ ಆಹಾರ ಯಾವುದು?"*
     - Demonstrate the natural, empathetic, and clinically safe response returned.

---

## 3. Defense Strategy: Frequently Asked Questions by Examiners

### Q1: "Why is your model accuracy 82.27% instead of 98% or 99%?"
> **Answer:** *"Many student projects report 99% accuracy because they train on synthetic or over-sampled toy datasets where data leakage allows the model to memorize patterns. In actual clinical epidemiology, real human biology has inherent variance. Our model is trained on 25,500 authentic Indian clinical encounters, achieving an 82.27% accuracy with an outstanding 0.8862 ROC-AUC. In healthcare, an 82% verified clinical model is realistic, robust, and generalizable."*

### Q2: "What is your decision threshold and why isn't it 0.5?"
> **Answer:** *"In general classification, 0.5 is standard. However, in medical risk screening, a False Negative (missing an at-risk pre-diabetic patient) has severe health consequences, whereas a False Positive merely prompts a non-invasive confirmatory blood test. We tuned our threshold to 0.31 – 0.45, boosting screening Recall (Sensitivity) to nearly 80%."*

### Q3: "How is patient data secured?"
> **Answer:** *"The system incorporates enterprise-grade security: Passwords are salted and hashed using bcrypt. All protected routes require JWT Bearer authorization. Furthermore, we conducted a security audit that identified and eliminated an Insecure Direct Object Reference (IDOR) flaw in PDF generation, guaranteeing multi-tenant isolation."*

### Q4: "What happens if the remote database is offline?"
> **Answer:** *"Our database abstraction layer features automated failover. If our cloud PostgreSQL database is unreachable, the engine gracefully activates local SQLite persistence without crashing, ensuring 100% demo and screening uptime."*
