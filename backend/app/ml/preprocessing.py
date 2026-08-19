import numpy as np
from typing import Dict, Any

CANONICAL_FEATURES = [
    "pregnancies",
    "glucose",
    "blood_pressure",
    "skin_thickness",
    "insulin",
    "bmi",
    "diabetes_pedigree_function",
    "age",
]


def preprocess_assessment_data(data: Dict[str, Any]) -> np.ndarray:
    """
    Extracts canonical physiological metrics and computes engineered feature interactions
    for high-accuracy XGBoost model inference.
    """
    pregnancies = float(data.get("pregnancies", 1))
    glucose = float(data.get("glucose", 120.0))
    blood_pressure = float(data.get("blood_pressure", 70.0))
    skin_thickness = float(data.get("skin_thickness", 20.0))
    insulin = float(data.get("insulin", 80.0))
    bmi = float(data.get("bmi", 25.0))
    dpf = float(data.get("diabetes_pedigree_function", 0.47))
    age = float(data.get("age", 30))

    # Clean zero values for physiological metrics
    if glucose <= 0: glucose = 120.0
    if blood_pressure <= 0: blood_pressure = 70.0
    if skin_thickness <= 0: skin_thickness = 20.0
    if insulin <= 0: insulin = 80.0
    if bmi <= 0: bmi = 25.0

    # Interaction & clinical threshold features
    glucose_bmi = glucose * bmi
    glucose_age = glucose * age
    high_glucose = 1.0 if glucose >= 140.0 else 0.0
    high_bmi = 1.0 if bmi >= 30.0 else 0.0

    feature_vector = [
        pregnancies,
        glucose,
        blood_pressure,
        skin_thickness,
        insulin,
        bmi,
        dpf,
        age,
        glucose_bmi,
        glucose_age,
        high_glucose,
        high_bmi,
    ]

    return np.array([feature_vector], dtype=np.float32)
