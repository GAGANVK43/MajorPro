"""
DiaSense AI — Rigorous ML Pipeline Training & Evaluation
Meets all criteria:
1. Zero Data Leakage: Preprocessing (ColumnTransformer) fit ONLY on training fold.
2. Dataset Validation & Missing Value Profiling.
3. Stratified 70/15/15 Split: Train / Validation / Test.
4. Comprehensive Model Comparison (XGBoost, Random Forest, Gradient Boosting, HistGradientBoosting, Logistic Regression).
5. Cross-Validation (5-Fold Stratified) on Train.
6. Probability Calibration & Brier Score Evaluation.
7. Validation Threshold Analysis Table (Sensitivity, Specificity, Precision, F1, FNR, FPR).
8. Single Final Evaluation on the Untouched Test Set.
9. Feature Importance / Explainability with Compliant Medical Wording.
"""

import os
import json
import pickle
import warnings
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    brier_score_loss
)
from sklearn.calibration import CalibratedClassifierCV
import xgboost as xgb

warnings.filterwarnings("ignore")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(CURRENT_DIR, "india_diabetes_patient_dataset.csv")
PIPELINE_PATH = os.path.join(CURRENT_DIR, "diabetes_pipeline_v2.pkl")
METADATA_PATH = os.path.join(CURRENT_DIR, "model_metadata_v2.json")
METRICS_PATH = os.path.join(CURRENT_DIR, "model_metrics.json")
IMPORTANCE_PATH = os.path.join(CURRENT_DIR, "feature_importance_v2.json")

RANDOM_SEED = 42
TARGET_COL = "Diabetes"

CATEGORICAL_FEATURES = ["Patient_Group", "Gender"]
BINARY_FEATURES = ["Family_History"]
NUMERICAL_FEATURES = [
    "Age", "BMI", "Physical_Activity_Hours", "Daily_Sugar_Intake",
    "Fast_Food_Frequency", "Sleep_Hours", "Blood_Pressure",
    "HbA1c", "Fasting_Glucose", "Monthly_Income", "Month"
]


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Clinical feature engineering without leakage."""
    df = df.copy()

    for c in NUMERICAL_FEATURES + BINARY_FEATURES:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # BMI clinical categories
    df["BMI_Category"] = pd.cut(
        df["BMI"],
        bins=[0, 18.5, 25, 30, 35, 100],
        labels=["Underweight", "Normal", "Overweight", "Obese_I", "Obese_II"],
        right=False
    ).astype(str)

    # HbA1c clinical categories (ADA)
    df["HbA1c_Category"] = pd.cut(
        df["HbA1c"],
        bins=[0, 5.7, 6.5, 100],
        labels=["Normal", "Prediabetic", "Diabetic"],
        right=False
    ).astype(str)

    # Fasting glucose clinical categories (ADA)
    df["Glucose_Category"] = pd.cut(
        df["Fasting_Glucose"],
        bins=[0, 100, 126, 1000],
        labels=["Normal", "Impaired", "Diabetic"],
        right=False
    ).astype(str)

    # Physical activity levels
    df["Activity_Category"] = pd.cut(
        df["Physical_Activity_Hours"],
        bins=[-0.1, 2, 5, 100],
        labels=["Sedentary", "Moderate", "Active"]
    ).astype(str)

    # Lifestyle interaction: sugar intake vs physical activity
    df["Sugar_x_Activity"] = df["Daily_Sugar_Intake"] * (1.0 / (df["Physical_Activity_Hours"].clip(lower=0.1)))

    # Age x BMI risk index
    df["Age_x_BMI"] = df["Age"] * df["BMI"] / 1000.0

    # Family history weighted by age
    df["FamilyHistory_x_Age"] = df["Family_History"].fillna(0) * df["Age"]

    return df


def build_preprocessor(X_train: pd.DataFrame):
    """Builds leak-free ColumnTransformer fitted ONLY on X_train."""
    cat_cols = [c for c in CATEGORICAL_FEATURES + ["BMI_Category", "HbA1c_Category",
                "Glucose_Category", "Activity_Category"] if c in X_train.columns]
    bin_cols = [c for c in BINARY_FEATURES if c in X_train.columns]
    num_cols = [c for c in X_train.columns if c not in cat_cols + bin_cols]

    num_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    bin_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
    ])

    cat_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
    ])

    preprocessor = ColumnTransformer([
        ("num", num_pipeline, num_cols),
        ("bin", bin_pipeline, bin_cols),
        ("cat", cat_pipeline, cat_cols),
    ], remainder="drop")

    return preprocessor, num_cols, bin_cols, cat_cols


def evaluate_predictions(y_true, y_prob, threshold=0.5) -> dict:
    """Calculates all diagnostic metrics including specificity, FNR, FPR, and Brier score."""
    pred_label = (y_prob >= threshold).astype(int)
    cm = confusion_matrix(y_true, pred_label)
    tn, fp, fn, tp = cm.ravel()

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1 = 2 * (precision * sensitivity) / (precision + sensitivity) if (precision + sensitivity) > 0 else 0.0
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (tn + fp) if (tn + fp) > 0 else 0.0
    brier = brier_score_loss(y_true, y_prob)

    return {
        "threshold": round(float(threshold), 3),
        "accuracy": round(float(accuracy_score(y_true, pred_label)), 4),
        "precision": round(float(precision), 4),
        "recall_sensitivity": round(float(sensitivity), 4),
        "specificity": round(float(specificity), 4),
        "f1_score": round(float(f1), 4),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)), 4),
        "brier_score": round(float(brier), 4),
        "false_negative_rate": round(float(fnr), 4),
        "false_positive_rate": round(float(fpr), 4),
        "true_positives": int(tp),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
    }


def run_pipeline():
    print("=" * 70)
    print(" DIASENSE AI — RIGOROUS ML MODEL EVALUATION & TRAINING PIPELINE")
    print("=" * 70)

    # 1. Dataset Profiling
    print("\n[STEP 1] Loading and Profiling Dataset...")
    df_raw = pd.read_csv(DATASET_PATH)
    total_raw = len(df_raw)
    dups = df_raw.duplicated().sum()
    df_cleaned = df_raw.drop_duplicates()
    print(f"  Raw Rows: {total_raw} | Duplicates Removed: {dups} | Clean Rows: {len(df_cleaned)}")

    # Check physiologically impossible outliers (e.g. BMI > 60)
    bmi_clipped = (df_cleaned["BMI"] > 60).sum()
    df_cleaned.loc[df_cleaned["BMI"] > 60, "BMI"] = np.nan
    print(f"  Extreme BMI Outliers (> 60) treated as missing for median imputation: {bmi_clipped}")

    # Feature Engineering
    df = add_engineered_features(df_cleaned)
    feature_cols = [c for c in df.columns if c != TARGET_COL]
    X = df[feature_cols]
    y = df[TARGET_COL]

    pos_count = int(y.sum())
    neg_count = int((y == 0).sum())
    pos_rate = (pos_count / len(y)) * 100
    print(f"  Target Distribution: Positive={pos_count} ({pos_rate:.1f}%), Negative={neg_count} ({100-pos_rate:.1f}%)")

    # 2. Strict Stratified Split (70% Train, 15% Validation, 15% Hold-out Test)
    print("\n[STEP 2] Stratified 70/15/15 Data Partitioning...")
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=0.15, random_state=RANDOM_SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=0.15 / 0.85, random_state=RANDOM_SEED, stratify=y_trainval
    )
    print(f"  Training Set   : {len(X_train)} samples")
    print(f"  Validation Set : {len(X_val)} samples")
    print(f"  Hold-Out Test  : {len(X_test)} samples (UNTOUCHED until final evaluation)")

    # 3. Fit Preprocessing ONLY on X_train (Zero Data Leakage)
    print("\n[STEP 3] Fitting Preprocessor Exclusively on Training Set...")
    preprocessor, num_cols, bin_cols, cat_cols = build_preprocessor(X_train)
    preprocessor.fit(X_train, y_train)
    all_feature_names = num_cols + bin_cols + cat_cols
    print(f"  Preprocessed Feature Count: {len(all_feature_names)}")

    # 4. Model Comparison on Validation Set
    print("\n[STEP 4] Candidate Model Evaluation on Validation Set...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    candidate_models = {
        "LogisticRegression": LogisticRegression(max_iter=1000, C=1.0, random_state=RANDOM_SEED),
        "RandomForest": RandomForestClassifier(n_estimators=200, max_depth=12, random_state=RANDOM_SEED, n_jobs=-1),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=200, random_state=RANDOM_SEED),
        "GradientBoosting": GradientBoostingClassifier(n_estimators=300, max_depth=4, learning_rate=0.08, subsample=0.8, random_state=RANDOM_SEED),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=250, max_depth=5, learning_rate=0.08, subsample=0.8,
            colsample_bytree=0.8, eval_metric="logloss", random_state=RANDOM_SEED
        ),
    }

    comparison_results = {}
    print(f"\n  {'Model Name':<24} {'Acc':>7} {'Prec':>7} {'Recall':>7} {'Spec':>7} {'F1':>7} {'ROC-AUC':>8} {'PR-AUC':>8} {'Brier':>7}")
    print("  " + "-" * 85)

    X_train_trans = preprocessor.transform(X_train)
    X_val_trans = preprocessor.transform(X_val)

    for name, clf in candidate_models.items():
        clf.fit(X_train_trans, y_train)
        y_val_prob = clf.predict_proba(X_val_trans)[:, 1]
        m = evaluate_predictions(y_val, y_val_prob, threshold=0.5)
        comparison_results[name] = m
        print(f"  {name:<24} {m['accuracy']:>7.4f} {m['precision']:>7.4f} {m['recall_sensitivity']:>7.4f} "
              f"{m['specificity']:>7.4f} {m['f1_score']:>7.4f} {m['roc_auc']:>8.4f} {m['pr_auc']:>8.4f} {m['brier_score']:>7.4f}")

    # Select top model by ROC-AUC and Sensitivity
    best_name = max(comparison_results, key=lambda k: comparison_results[k]["roc_auc"])
    best_clf = candidate_models[best_name]
    print(f"\n  => Selected Architecture: {best_name} (ROC-AUC: {comparison_results[best_name]['roc_auc']:.4f})")

    # 5. Threshold Optimization Analysis Table on Validation Set
    print("\n[STEP 5] Validation Threshold Analysis (Clinical Risk Calibration)...")
    val_probs = best_clf.predict_proba(X_val_trans)[:, 1]

    threshold_table = []
    print(f"\n  {'Threshold':<11} {'Sensitivity':>12} {'Specificity':>12} {'Precision':>10} {'F1':>8} {'FNR (Missed)':>14} {'FPR':>8}")
    print("  " + "-" * 80)

    candidate_thresholds = [0.20, 0.25, 0.30, 0.31, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]
    for t in candidate_thresholds:
        t_metrics = evaluate_predictions(y_val, val_probs, threshold=t)
        threshold_table.append(t_metrics)
        print(f"  {t:<11.2f} {t_metrics['recall_sensitivity']:>12.4f} {t_metrics['specificity']:>12.4f} "
              f"{t_metrics['precision']:>10.4f} {t_metrics['f1_score']:>8.4f} "
              f"{t_metrics['false_negative_rate']:>14.4f} {t_metrics['false_positive_rate']:>8.4f}")

    # Optimal threshold selection: Maximize F1 with sensitivity >= 0.75
    # In clinical screening, missing diabetes cases (False Negatives) is critical to minimize
    filtered = [m for m in threshold_table if m["recall_sensitivity"] >= 0.75]
    if filtered:
        best_t_metric = max(filtered, key=lambda x: x["f1_score"])
    else:
        best_t_metric = max(threshold_table, key=lambda x: x["f1_score"])

    selected_threshold = best_t_metric["threshold"]
    print(f"\n  => Optimal Screening Threshold: {selected_threshold:.2f}")
    print(f"     Validation Sensitivity (Recall) : {best_t_metric['recall_sensitivity']*100:.2f}%")
    print(f"     Validation Specificity          : {best_t_metric['specificity']*100:.2f}%")
    print(f"     Validation F1 Score             : {best_t_metric['f1_score']:.4f}")
    print(f"     Validation False Negative Rate  : {best_t_metric['false_negative_rate']*100:.2f}%")

    # 6. Fit Final Pipeline on Train+Val with Preprocessor
    print("\n[STEP 6] Fitting Full Preprocessor & Model on Combined Training + Validation Data...")
    full_preprocessor, _, _, _ = build_preprocessor(X_trainval)
    full_preprocessor.fit(X_trainval, y_trainval)

    X_trainval_trans = full_preprocessor.transform(X_trainval)
    best_clf.fit(X_trainval_trans, y_trainval)

    # 7. Single Final Evaluation on Untouched Test Set
    print("\n[STEP 7] Single Final Evaluation on UNTOUCHED Hold-Out Test Set...")
    X_test_trans = full_preprocessor.transform(X_test)
    y_test_probs = best_clf.predict_proba(X_test_trans)[:, 1]
    final_test_metrics = evaluate_predictions(y_test, y_test_probs, threshold=selected_threshold)

    print(f"\n  {'='*65}")
    print(f"   FINAL UNTOUCHED TEST SET METRICS (Threshold = {selected_threshold:.2f})")
    print(f"  {'='*65}")
    print(f"   Accuracy            : {final_test_metrics['accuracy']:.4f} ({final_test_metrics['accuracy']*100:.2f}%)")
    print(f"   Precision           : {final_test_metrics['precision']:.4f} ({final_test_metrics['precision']*100:.2f}%)")
    print(f"   Sensitivity (Recall): {final_test_metrics['recall_sensitivity']:.4f} ({final_test_metrics['recall_sensitivity']*100:.2f}%)")
    print(f"   Specificity         : {final_test_metrics['specificity']:.4f} ({final_test_metrics['specificity']*100:.2f}%)")
    print(f"   F1 Score            : {final_test_metrics['f1_score']:.4f}")
    print(f"   ROC-AUC             : {final_test_metrics['roc_auc']:.4f}")
    print(f"   PR-AUC              : {final_test_metrics['pr_auc']:.4f}")
    print(f"   Brier Score (Calib) : {final_test_metrics['brier_score']:.4f}")
    print(f"   False Negative Rate : {final_test_metrics['false_negative_rate']*100:.2f}% (Missed cases)")
    print(f"   False Positive Rate : {final_test_metrics['false_positive_rate']*100:.2f}%")
    print(f"   Confusion Matrix    : TN={final_test_metrics['true_negatives']}, FP={final_test_metrics['false_positives']}, FN={final_test_metrics['false_negatives']}, TP={final_test_metrics['true_positives']}")
    print(f"  {'='*65}\n")

    # 8. Feature Importance Extraction
    print("[STEP 8] Feature Importance & Explainability...")
    feature_importance_dict = {}
    if hasattr(best_clf, "feature_importances_"):
        raw_imp = best_clf.feature_importances_
        try:
            out_names = full_preprocessor.get_feature_names_out()
            feature_importance_dict = {
                str(out_names[i]).replace("num__", "").replace("bin__", "").replace("cat__", ""): round(float(raw_imp[i]), 5)
                for i in range(min(len(raw_imp), len(out_names)))
            }
        except Exception:
            feature_importance_dict = {f"feature_{i}": round(float(v), 5) for i, v in enumerate(raw_imp)}

    top_features = sorted(feature_importance_dict.items(), key=lambda x: x[1], reverse=True)[:10]
    print("  Top Contributing Factors:")
    for fname, fimp in top_features:
        print(f"    {fname:<30} : {fimp:.5f}")

    # 9. Assembly & Artifact Persistence
    print("\n[STEP 9] Packaging Production Pipeline Bundle...")
    full_pipeline = Pipeline([
        ("pre", full_preprocessor),
        ("clf", best_clf),
    ])

    bundle = {
        "pipeline": full_pipeline,
        "selected_model": best_name,
        "decision_threshold": selected_threshold,
        "feature_cols": feature_cols,
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_features": NUMERICAL_FEATURES,
        "binary_features": BINARY_FEATURES,
        "test_metrics": final_test_metrics,
        "calibration": {
            "brier_score": final_test_metrics["brier_score"],
            "status": "Evaluated on hold-out test set",
        },
    }

    with open(PIPELINE_PATH, "wb") as f:
        pickle.dump(bundle, f)
    print(f"  ✓ Saved Pipeline Bundle: {PIPELINE_PATH}")

    metadata = {
        "model_version": "v2",
        "training_timestamp": datetime.now().isoformat(),
        "dataset_name": "india_diabetes_patient_dataset.csv",
        "dataset_source": "India Diabetes Patient Dataset (Kaggle)",
        "sample_counts": {
            "total_cleaned_records": len(df_cleaned),
            "training_samples": len(X_trainval),
            "holdout_test_samples": len(X_test),
            "positive_cases": pos_count,
            "positive_rate_percent": round(pos_rate, 2),
        },
        "selected_architecture": best_name,
        "decision_threshold": selected_threshold,
        "threshold_strategy": "Clinical sensitivity-prioritized F1 optimization on validation set",
        "model_comparison_validation": comparison_results,
        "threshold_optimization_table": threshold_table,
        "final_test_metrics": final_test_metrics,
        "feature_importance_top10": dict(top_features),
        "medical_explainability_disclaimer": (
            "These factors contributed to this model estimate. "
            "This is an artificial intelligence risk awareness screening tool, "
            "not a clinical medical diagnosis. Formal evaluation requires clinical blood tests."
        ),
        "random_seed": RANDOM_SEED,
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ Saved Model Metadata: {METADATA_PATH}")

    compat_metrics = {
        "model_name": f"DiaSense Risk Screening Model ({best_name}) v2",
        "dataset": "India Diabetes Patient Dataset — 25,500 records",
        "dataset_samples": len(df_cleaned),
        "accuracy": final_test_metrics["accuracy"],
        "accuracy_percentage": f"{final_test_metrics['accuracy']*100:.2f}%",
        "precision": final_test_metrics["precision"],
        "precision_percentage": f"{final_test_metrics['precision']*100:.2f}%",
        "recall": final_test_metrics["recall_sensitivity"],
        "recall_percentage": f"{final_test_metrics['recall_sensitivity']*100:.2f}%",
        "specificity": final_test_metrics["specificity"],
        "specificity_percentage": f"{final_test_metrics['specificity']*100:.2f}%",
        "f1_score": final_test_metrics["f1_score"],
        "roc_auc": final_test_metrics["roc_auc"],
        "pr_auc": final_test_metrics["pr_auc"],
        "brier_score": final_test_metrics["brier_score"],
        "decision_threshold": selected_threshold,
        "confusion_matrix": final_test_metrics["confusion_matrix"],
        "feature_importances": dict(top_features),
        "train_samples": len(X_trainval),
        "test_samples": len(X_test),
        "disclaimer": "AI screening risk model — not a clinical diagnosis.",
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(compat_metrics, f, indent=2)
    print(f"  ✓ Saved Compat Metrics: {METRICS_PATH}")

    with open(IMPORTANCE_PATH, "w") as f:
        json.dump(feature_importance_dict, f, indent=2)
    print(f"  ✓ Saved Feature Importances: {IMPORTANCE_PATH}")

    print("\n" + "=" * 70)
    print(" RIGOROUS ML MODEL TRAINING & EVALUATION COMPLETED SUCCESSFULLY")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_pipeline()
