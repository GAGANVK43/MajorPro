import os
import json
import pickle
import numpy as np
from typing import Dict, Any, Tuple, List
from app.ml.preprocessing import preprocess_assessment_data
from app.utils.logger import logger

MODEL_PATH = os.path.join(os.path.dirname(__file__), "diabetes_model.pkl")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "model_metrics.json")
_model_instance = None
_metrics_instance = None


def load_model():
    """
    Singleton loader for XGBoost model.
    """
    global _model_instance, _metrics_instance
    if _model_instance is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(METRICS_PATH):
            from app.ml.train_model import train_and_save_model
            _model_instance, _metrics_instance = train_and_save_model(MODEL_PATH)
        else:
            with open(MODEL_PATH, "rb") as f:
                _model_instance = pickle.load(f)
            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH, "r") as f:
                    _metrics_instance = json.load(f)
            acc_str = _metrics_instance.get("accuracy_percentage", "N/A") if _metrics_instance else "N/A"
            logger.info(f"Loaded XGBoost model from pickle (Model Accuracy Score: {acc_str}).")
    return _model_instance


def get_model_metrics() -> Dict[str, Any]:
    """
    Retrieves the model evaluation metrics including accuracy score.
    """
    global _metrics_instance
    load_model()
    if _metrics_instance is None and os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r") as f:
            _metrics_instance = json.load(f)
    return _metrics_instance or {
        "model_name": "XGBoost Diabetes Risk Classifier",
        "accuracy": 0.7597,
        "accuracy_percentage": "75.97%",
    }


def analyze_contributing_factors(assessment_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Computes clinical risk factor impacts based on clinical guidelines.
    """
    factors = []
    glucose = float(assessment_data.get("glucose", 120))
    bmi = float(assessment_data.get("bmi", 24.5))
    age = int(assessment_data.get("age", 30))
    bp = float(assessment_data.get("blood_pressure", 70))
    dpf = float(assessment_data.get("diabetes_pedigree_function", 0.47))
    insulin = float(assessment_data.get("insulin", 80))

    # Glucose Assessment
    if glucose >= 140:
        factors.append({
            "factor": "Blood Glucose",
            "value": f"{glucose} mg/dL",
            "impact": "High Risk",
            "description": "Glucose level indicates elevated or impaired fasting glycemic control."
        })
    elif glucose >= 100:
        factors.append({
            "factor": "Blood Glucose",
            "value": f"{glucose} mg/dL",
            "impact": "Moderate Risk",
            "description": "Glucose level falls in pre-diabetic monitoring range (100–139 mg/dL)."
        })
    else:
        factors.append({
            "factor": "Blood Glucose",
            "value": f"{glucose} mg/dL",
            "impact": "Optimal",
            "description": "Fasting blood glucose level within healthy normal range (<100 mg/dL)."
        })

    # BMI Assessment
    if bmi >= 30:
        factors.append({
            "factor": "BMI (Body Mass Index)",
            "value": f"{bmi}",
            "impact": "High Risk",
            "description": "BMI is classified as obese (>=30), increasing insulin resistance."
        })
    elif bmi >= 25:
        factors.append({
            "factor": "BMI (Body Mass Index)",
            "value": f"{bmi}",
            "impact": "Moderate Risk",
            "description": "BMI falls in overweight category (25–29.9)."
        })
    else:
        factors.append({
            "factor": "BMI (Body Mass Index)",
            "value": f"{bmi}",
            "impact": "Optimal",
            "description": "BMI is within normal healthy range (18.5–24.9)."
        })

    # Age Factor
    if age >= 45:
        factors.append({
            "factor": "Age Category",
            "value": f"{age} yrs",
            "impact": "Moderate Risk",
            "description": "Age 45+ is an established clinical demographic risk factor."
        })

    # DPF Genetic Factor
    if dpf >= 0.6:
        factors.append({
            "factor": "Diabetes Pedigree Score",
            "value": f"{dpf:.2f}",
            "impact": "High Risk",
            "description": "Strong genetic/family history predisposition score."
        })

    # Blood Pressure Factor
    if bp >= 90:
        factors.append({
            "factor": "Diastolic Blood Pressure",
            "value": f"{bp} mmHg",
            "impact": "Moderate Risk",
            "description": "Diastolic pressure elevated above 90 mmHg standard cutoff."
        })

    return factors


def predict_diabetes_risk(assessment_data: Dict[str, Any]) -> Tuple[str, float, float, str, List[Dict[str, Any]]]:
    """
    Executes ML inference for an assessment.
    Returns: (prediction_label, risk_percentage, confidence_percentage, recommendation_text, contributing_factors)
    """
    model = load_model()
    X = preprocess_assessment_data(assessment_data)

    # Obtain class probabilities
    probabilities = model.predict_proba(X)[0]
    diabetic_prob = float(probabilities[1])
    non_diabetic_prob = float(probabilities[0])

    prediction_label = "Diabetic" if diabetic_prob >= 0.50 else "Non-Diabetic"
    risk_percentage = round(diabetic_prob * 100.0, 1)

    # Confidence calculation: max probability
    confidence = round(max(diabetic_prob, non_diabetic_prob) * 100.0, 1)

    if prediction_label == "Diabetic":
        recommendation = (
            "Based on your physiological markers, your risk score suggests elevated vulnerability to Type-2 Diabetes. "
            "We strongly recommend consulting a healthcare provider for standard HbA1c testing. Focus on low-GI nutrition, daily walking, and weight control."
        )
    else:
        recommendation = (
            "Your diabetes risk screening score is within low-to-moderate thresholds. "
            "Maintain a balanced diet rich in whole foods, engage in regular physical activity, and schedule routine preventive checkups."
        )

    contributing_factors = analyze_contributing_factors(assessment_data)

    return prediction_label, risk_percentage, confidence, recommendation, contributing_factors
