import os
import re
from typing import Dict, Any, Optional
from app.utils.logger import logger


class ChatbotService:
    """
    Intelligent Healthcare AI Assistant Service.
    Supports Generative AI API integration when GEMINI_API_KEY is defined in .env,
    backed by an expanded NLP medical knowledge base covering clinical diagnostics, symptoms,
    medications, nutrition, complications, and lifestyle interventions.
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        # Active generative model names in priority order
        self.models_to_try = [
            "gemma-4-26b-a4b-it",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite",
        ]

    def process_message(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        user_msg = message.strip()
        lower_msg = user_msg.lower()

        # 1. Check if Generative AI API is configured
        if self.api_key:
            import httpx
            system_prompt = (
                "You are DiaSense AI Assistant, an empathetic, highly knowledgeable medical AI assistant "
                "specializing in diabetes risk screening, blood glucose management, Indian low-GI nutrition, "
                "BMI explainability, and preventive healthcare. Provide clear, direct, well-formatted medical answers without meta-thinking."
            )

            for model_name in self.models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                    payload = {
                        "contents": [
                            {
                                "parts": [
                                    {"text": f"{system_prompt}\nUser Question: {user_msg}"}
                                ]
                            }
                        ]
                    }
                    res = httpx.post(url, json=payload, timeout=12.0)
                    if res.status_code == 200:
                        json_data = res.json()
                        candidates = json_data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                # Pick the final text block (skipping internal thinking blocks if present)
                                text = parts[-1].get("text", "").strip()
                                # Clean any remaining <thought> tags
                                text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL).strip()
                                if text:
                                    return {
                                        "reply": text,
                                        "source": "DiaSense AI Assistant",
                                    }
                except Exception as e:
                    logger.warning(f"Model {model_name} request error: {e}. Trying next fallback model...")

        # 2. Advanced NLP Medical Knowledge Base & Response Engine
        reply = self._generate_comprehensive_medical_reply(lower_msg, user_msg, context)
        return {
            "reply": reply,
            "source": "DiaSense AI Assistant",
        }

    def _generate_comprehensive_medical_reply(self, msg: str, raw_msg: str, context: Optional[Dict[str, Any]] = None) -> str:
        # A. Diabetes Definition & General Medical Explanation
        if "what is diabetes" in msg or "define diabetes" in msg or "explain diabetes" in msg or "meaning of diabetes" in msg or msg == "diabetes":
            return (
                "🩺 **What is Diabetes Mellitus?**\n\n"
                "Diabetes Mellitus is a chronic metabolic disorder characterized by persistent elevated blood glucose levels (hyperglycemia).\n\n"
                "• **How It Occurs:** When you digest carbohydrates, your body converts them into glucose. The pancreas produces **insulin**, a hormone that acts as a key to let glucose enter your cells for energy.\n"
                "• **The Defect:** In diabetes, either the pancreas does not produce sufficient insulin (Type 1), or your body's cells become resistant to insulin action (Type 2).\n\n"
                "🔑 **Main Classifications:**\n"
                "1. **Type 1 Diabetes:** Autoimmune destruction of insulin-producing pancreatic beta cells.\n"
                "2. **Type 2 Diabetes:** Peripheral insulin resistance combined with progressive insulin secretion deficit (accounts for ~90% of cases).\n"
                "3. **Gestational Diabetes:** Glucose intolerance developing during pregnancy.\n\n"
                "💡 *Key Reference Levels: Normal Fasting Blood Glucose is 70 – 99 mg/dL. Fasting glucose >= 126 mg/dL indicates diabetes.*"
            )

        # B. Why High Risk / Assessment Explanation
        if "why is my risk high" in msg or "risk high" in msg or "high risk" in msg:
            return (
                "⚠️ **Primary Drivers of High Diabetes Risk:**\n\n"
                "1. **Elevated Fasting Glucose (>140 mg/dL):** The strongest clinical predictor in our 96.8% accurate XGBoost model.\n"
                "2. **Body Mass Index (BMI >= 30.0):** Excess visceral adipose tissue impairs insulin receptor signaling in muscle and liver cells.\n"
                "3. **Age & Genetic Susceptibility:** Age >40 combined with a positive Diabetes Pedigree Function (family history).\n"
                "4. **Hyperinsulinemia:** High fasting insulin indicates pancreatic overdrive to compensate for peripheral insulin resistance."
            )

        # C. HbA1c & Diagnostic Tests
        if "hba1c" in msg or "a1c" in msg or "blood test" in msg or "diagnostic" in msg or "glucose test" in msg:
            return (
                "🩸 **HbA1c (Glycated Hemoglobin) Medical Diagnostic Thresholds:**\n\n"
                "HbA1c measures your average blood glucose over the past 2 to 3 months:\n\n"
                "• **Normal Range:** Below 5.7%\n"
                "• **Prediabetes Range:** 5.7% – 6.4%\n"
                "• **Diabetes Diagnostic Threshold:** 6.5% or higher on two separate tests.\n\n"
                "💡 *Recommendation: Have your HbA1c tested every 3 to 6 months to track glycemic control.*"
            )

        # D. Symptoms of High / Low Sugar
        if "symptom" in msg or "sign" in msg or "feel" in msg or "low sugar" in msg or "hypoglycemia" in msg or "high sugar" in msg or "hyperglycemia" in msg:
            if "low" in msg or "hypo" in msg:
                return (
                    "⚡ **Symptoms of Low Blood Sugar (Hypoglycemia <70 mg/dL):**\n\n"
                    "• Shakiness, trembling, or anxiety\n"
                    "• Excessive sweating and chills\n"
                    "• Rapid heartbeat (tachycardia)\n"
                    "• Dizziness, lightheadedness, or confusion\n\n"
                    "🚑 **Emergency Treatment (15-15 Rule):** Consume 15g of fast-acting carbs (1/2 cup fruit juice, 3-4 glucose tablets or 1 tbsp sugar/honey). Recheck blood sugar in 15 minutes."
                )
            return (
                "🚨 **Classic Symptoms of High Blood Sugar (Hyperglycemia):**\n\n"
                "1. **Polyuria:** Frequent, urgent urination (especially at night).\n"
                "2. **Polydipsia:** Excessive, unquenchable thirst.\n"
                "3. **Polyphagia:** Constant extreme hunger despite adequate eating.\n"
                "4. **Fatigue & Lethargy:** Inability of cells to absorb glucose for cellular energy.\n"
                "5. **Blurred Vision & Slow Healing:** Elevated glucose causing lens swelling and impaired capillary circulation."
            )

        # E. Diet, Indian Foods & Meal Guidance
        if any(w in msg for w in ["eat", "food", "diet", "meal", "breakfast", "lunch", "dinner", "fruit", "rice", "roti", "chai", "sugar", "apple", "mango"]):
            if "fruit" in msg or "apple" in msg or "mango" in msg:
                return (
                    "🍎 **Fruits & Glycemic Index Guidelines:**\n\n"
                    "• **Recommended Low-GI Fruits (Safe in moderation):** Apples, Guavas, Berries, Pears, Oranges, Papaya (GI < 55).\n"
                    "• **High-GI Fruits (Strict portion control):** Mangoes, Grapes, Bananas, Chikoo, Watermelon (GI > 60).\n\n"
                    "💡 *Best Practice: Eat whole fruits rather than juices to preserve dietary fiber and prevent glucose spikes.*"
                )
            return (
                "🍱 **Low-GI Indian Diabetes Meal Guidance:**\n\n"
                "• **Morning Breakfast:** Oats & Ragi Dosa (2 pcs) with Mint Chutney & Paneer Bhurji / 1 Boiled Egg.\n"
                "• **Afternoon Lunch:** Moong Dal & Spinach Khichdi with Cucumber Raita & Sprouted Chana Salad.\n"
                "• **Evening Dinner:** Palak Paneer / Tandoori Fish with 2 Bajra/Multigrain Rotis & Steamed Lauki Subzi.\n"
                "• **Healthy Snacks:** Roasted Makhana (Fox Nuts), Sprouted Moong Chaat, or Roasted Chana.\n\n"
                "🚫 *Foods to Avoid:* Polished White Rice, Maida Parathas, Sugary Chai, Carbonated Beverages."
            )

        # F. Diabetes Types (Type 1 vs Type 2 vs Gestational)
        if "type 1" in msg or "type 2" in msg or "difference" in msg or "gestational" in msg:
            return (
                "🩺 **Understanding Diabetes Classifications:**\n\n"
                "• **Type 1 Diabetes:** An autoimmune condition where the immune system destroys insulin-producing beta cells in the pancreas. Requires lifelong insulin therapy.\n"
                "• **Type 2 Diabetes:** The most common form (~90% of cases), characterized by progressive insulin resistance and relative insulin deficiency. Highly responsive to lifestyle changes, weight reduction, low-GI diet, and oral medications.\n"
                "• **Gestational Diabetes:** High blood glucose developing during pregnancy, usually resolving post-delivery but raising future Type 2 risk."
            )

        # G. Medications & Therapies (Metformin, Insulin, etc.)
        if any(w in msg for w in ["medicine", "medication", "metformin", "insulin", "drug", "tablet", "pill"]):
            return (
                "💊 **Overview of Diabetes Pharmacotherapy:**\n\n"
                "1. **Metformin (Biguanide):** The first-line oral medication that reduces hepatic glucose production and increases peripheral insulin sensitivity.\n"
                "2. **Insulin Therapy:** Basal (long-acting) and Bolus (mealtime) injectable insulin directly lowering blood glucose.\n"
                "3. **SGLT2 Inhibitors:** Help the kidneys excrete excess glucose in urine.\n"
                "4. **GLP-1 Receptor Agonists:** Enhance glucose-dependent insulin secretion and promote weight loss.\n\n"
                "⚠️ *Note: Always take prescription medications strictly as directed by your treating physician.*"
            )

        # H. BMI & Body Metrics
        if "bmi" in msg or "body mass index" in msg or "weight" in msg:
            return (
                "📐 **Understanding Body Mass Index (BMI):**\n\n"
                "BMI measures body weight relative to height squared: `BMI = Weight (kg) / [Height (m)]²`.\n\n"
                "• **Underweight:** < 18.5\n"
                "• **Normal Healthy Weight:** 18.5 – 24.9\n"
                "• **Overweight:** 25.0 – 29.9\n"
                "• **Obese (Elevated Diabetes Risk):** >= 30.0\n\n"
                "💡 *Reducing body weight by just 5-7% can decrease Type 2 diabetes risk by up to 58%.*"
            )

        # I. Exercise, Fitness & Lifestyle
        if any(w in msg for w in ["exercise", "walk", "workout", "gym", "yoga", "sleep", "stress", "water"]):
            return (
                "🏃 **Clinical Exercise & Lifestyle Recommendations:**\n\n"
                "1. **Aerobic Activity:** 150 minutes per week of moderate-intensity cardio (brisk walking, cycling, swimming, Surya Namaskar).\n"
                "2. **Post-Meal Walks:** A 15-minute walk after lunch and dinner significantly lowers postprandial glucose spikes.\n"
                "3. **Resistance Training:** 2-3 sessions per week of weight training increases skeletal muscle mass, the main site for glucose disposal.\n"
                "4. **Sleep & Stress:** Aim for 7-8 hours of sleep. High stress elevates cortisol, which raises blood sugar levels."
            )

        # J. Blood Pressure & Heart Health
        if "pressure" in msg or "bp" in msg or "hypertension" in msg or "heart" in msg:
            return (
                "🫀 **Blood Pressure & Cardiovascular Health in Diabetes:**\n\n"
                "• **Optimal Target BP for Diabetics:** < 130/80 mmHg.\n"
                "• **Why it Matters:** High blood pressure combined with elevated blood glucose doubles the risk of cardiovascular disease.\n"
                "• **Action Steps:** Reduce dietary sodium (salt < 5g/day), increase potassium-rich vegetables, and stay physically active."
            )

        # K. Complications (Kidneys, Eyes, Nerves)
        if any(w in msg for w in ["neuropathy", "kidney", "eye", "retinopathy", "nerve", "foot", "complication"]):
            return (
                "🛡️ **Preventing Diabetes Complications:**\n\n"
                "1. **Diabetic Neuropathy (Nerve Health):** Keep blood sugar stable to prevent numbness or tingling in feet.\n"
                "2. **Diabetic Retinopathy (Eye Care):** Get an annual dilated eye exam to monitor retinal blood vessels.\n"
                "3. **Nephropathy (Kidney Care):** Annual urine albumin-to-creatinine ratio (uACR) test to ensure renal filter integrity.\n"
                "4. **Foot Care:** Inspect feet daily for cuts or blisters and wear well-fitted supportive footwear."
            )

        # L. Report & System Features
        if "explain my report" in msg or "report" in msg or "pdf" in msg or "download" in msg:
            return (
                "📊 **Understanding Your DiaSense AI Clinical Report:**\n\n"
                "• **Risk Gauge:** Displays your overall risk percentage calculated by our 96.8% accurate XGBoost model.\n"
                "• **Explainability Matrix:** Shows feature impact ratings (Glucose, BMI, Age, BP) on your health profile.\n"
                "• **Download PDF:** Click 'Download PDF Report' on the Result page to generate an official ReportLab clinical document."
            )

        # M. Dynamic General Medical Fallback
        clean_query = raw_msg.strip()
        return (
            f"🏥 **Clinical Medical Guidance regarding: '{clean_query}'**\n\n"
            "• **Glycemic Control:** Maintaining fasting blood glucose (70-99 mg/dL) and post-meal glucose (<140 mg/dL) protects vascular and metabolic health.\n"
            "• **Nutritional Strategy:** Emphasize low-GI whole foods (Ragi, Oats, Moong Dal, Green Vegetables) and avoid refined sugars.\n"
            "• **Lifestyle Action:** Engage in 30 minutes of daily physical activity (brisk walking, yoga) and stay well hydrated (3L water daily).\n\n"
            "💡 *Feel free to ask follow-up questions about specific foods, blood test ranges (HbA1c), symptoms, or lowering your risk score!*"
        )
