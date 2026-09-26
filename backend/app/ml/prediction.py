"""
prediction.py — v2 Compatibility Shim
Re-exports the v2 inference functions so existing code that imports
from `app.ml.prediction` continues to work without changes.
"""
# Re-export everything from the v2 module
from app.ml.prediction_v2 import (
    load_pipeline_bundle as load_model,
    get_model_metrics,
    analyze_contributing_factors,
    predict_diabetes_risk,
)

__all__ = [
    "load_model",
    "get_model_metrics",
    "analyze_contributing_factors",
    "predict_diabetes_risk",
]
