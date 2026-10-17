# DiaSense AI — Machine Learning Model Evaluation & Clinical Audit Report

**Report Date:** October 17, 2026  
**Auditor:** ML Evaluation & Statistics Specialist Team  
**System:** DiaSense AI Diabetes Risk Screening & Prediction Engine  
**Dataset:** India Diabetes Patient Dataset (25,500 records)  
**Primary Model Architecture:** Gradient Boosting Classifier / XGBoost Ensemble  

---

## 1. Executive Summary

DiaSense AI incorporates a specialized machine learning pipeline calibrated specifically for the Indian demographic profile. Rather than relying on synthetic datasets or foreign cohorts (e.g., Pima Indians or NHANES), DiaSense AI was trained, validated, and evaluated on the **India Diabetes Patient Dataset**, comprising **25,500 real-world clinical records**.

The production pipeline achieves:
- **Accuracy:** 82.27% (Test Set)
- **ROC-AUC:** 0.8862 (5-Fold Cross-Validation: 0.8874 ± 0.0047)
- **Recall (Sensitivity):** 74.62% – 79.97% (optimized for clinical screening safety)
- **Precision (PPV):** 70.13%
- **Specificity:** 85.71%
- **F1-Score:** 0.7230
- **Precision-Recall AUC (PR-AUC):** 0.7927

> [!IMPORTANT]
> **Clinical Screening Classification Notice:**  
> The model's decision threshold is strategically set to **0.31 – 0.45** (lower than the standard 0.50 cutoff) to minimize false negatives. In preventive healthcare and risk screening, failing to flag a patient with elevated metabolic risk is significantly more dangerous than recommending a confirmatory blood test to a borderline individual.

---

## 2. Dataset Provenance & Characteristics

| Parameter | Clinical Indian Dataset (Production) | Synthetic / Toy Benchmark |
|---|---|---|
| **Source** | Kaggle: `sridevilavanyacse/india-diabetes-patient-dataset` | Synthetic Pima Augmentation |
| **Total Sample Size** | 25,500 patient encounters | ~1,000 synthetic rows |
| **Positive Class (Diabetic)** | 7,750 (30.4% - 31.0%) | 50.0% (artificially balanced) |
| **Negative Class (Non-Diabetic)**| 17,750 (69.6% - 69.0%) | 50.0% |
| **Regional Validity** | South Asian / Indian metabolic traits | Native American / Pima |
| **Authentic Noise & Variance** | High (realistic clinical distributions) | Low (prone to 99%+ overfitting) |

### Socio-Demographic & Clinical Attributes
1. **Patient Group:** Stratified patient demographic classification.
2. **Age:** Range 18–85 years.
3. **Gender:** Male, Female, Other.
4. **BMI:** Body Mass Index ($kg/m^2$), with Indian specific cutoffs ($BMI \ge 23$ overweight, $\ge 25$ obese).
5. **Physical Activity:** Hours per week of dedicated exercise or physical labor.
6. **Daily Sugar Intake:** Grams of refined sugars and sweets consumed daily.
7. **Fast Food Frequency:** Days per week of ultra-processed food consumption.
8. **Sleep Duration:** Average nocturnal sleep hours.
9. **Family History:** Binary familial diabetes disposition (First-degree relatives).
10. **Blood Pressure:** Resting systolic/diastolic measurements ($mmHg$).
11. **HbA1c:** Glycated hemoglobin percentage (Gold standard glycemic marker).
12. **Fasting Glucose:** Plasma glucose after $\ge 8$ hours fast ($mg/dL$).
13. **Monthly Income & Seasonal Indicators:** Socio-economic proxies influencing dietary diversity.

---

## 3. Data Preprocessing & Feature Engineering Pipeline

The inference pipeline employs strict zero-leakage scikit-learn preprocessing:

```
Raw Input Dict / JSON
         │
         ▼
[1. Clinical Imputation & Normalization]
  ├── Missing numericals: Median imputation from training fold
  └── Missing categoricals: Mode imputation / 'Unknown'
         │
         ▼
[2. Domain-Specific Feature Engineering]
  ├── BMI_Category: Underweight (<18.5), Normal (18.5-22.9), Overweight (23-24.9), Obese (≥25)
  ├── HbA1c_Category: Normal (<5.7), Prediabetes (5.7-6.4), Diabetes (≥6.5)
  ├── Glucose_Category: Normal (<100), Impaired (100-125), Elevated (≥126)
  ├── Sugar_x_Activity: Interaction term (Daily Sugar ÷ [Activity Hours + 1])
  ├── Age_x_BMI: Metabolic load proxy
  └── FamilyHistory_x_Age: Weighted genetic vulnerability
         │
         ▼
[3. Scikit-Learn Pipeline Serialization]
  ├── RobustScaler / StandardScaler on continuous distributions
  ├── OneHotEncoder with handle_unknown='ignore'
  └── GradientBoostingClassifier / XGBoostClassifier
```

---

## 4. Full Evaluation Metrics & Confusion Matrix

### Confusion Matrix (Test Set: $N = 3,825$)

| | Actual Negative (Non-Diabetic) | Actual Positive (Diabetic) | Total |
|---|---|---|---|
| **Predicted Negative** | **2,262 (TN)** | **301 (FN)** | 2,563 |
| **Predicted Positive** | **377 (FP)** | **885 (TP)** | 1,262 |
| **Total** | 2,639 | 1,186 | 3,825 |

### Derived Diagnostic Indicators
$$\text{Sensitivity (Recall)} = \frac{885}{885 + 301} = 74.62\%$$
$$\text{Specificity} = \frac{2262}{2262 + 377} = 85.71\%$$
$$\text{Positive Predictive Value (Precision)} = \frac{885}{885 + 377} = 70.13\%$$
$$\text{Negative Predictive Value (NPV)} = \frac{2262}{2262 + 301} = 88.26\%$$
$$\text{Overall Accuracy} = \frac{885 + 2262}{3825} = 82.27\%$$
$$\text{ROC Area Under Curve (AUC)} = 0.8862$$

---

## 5. Feature Importance & Explainability (SHAP / Tree-Gini)

The top predictors ranked by Gini split importance and permutation impact:

1. **Daily Sugar Intake (27.09%):** Strongest dietary predictor of insulin resistance in urban Indian populations.
2. **Sugar-to-Activity Interaction (14.72%):** Net glycemic burden offset by physical exertion.
3. **Physical Activity Hours (8.97%):** Protective lifestyle factor.
4. **HbA1c (7.22%):** Direct biomarker of 3-month glycemic exposure.
5. **BMI (6.17%):** Visceral adiposity indicator (calibrated to WHO South Asian thresholds).
6. **Family History (5.05%):** Genetic predisposition factor.
7. **Patient Group & Demographics (4.74%):** Community baseline prevalence.
8. **Monthly Income (4.44%):** Correlates with refined carbohydrate vs whole grain food accessibility.
9. **Fast Food Frequency (4.30%):** Trans-fat and high glycemic load index.
10. **Family History $\times$ Age Interaction (4.29%):** Cumulative genetic risk expression with age.

---

## 6. Academic Defense vs. 99.47% Synthetic Metric Discrepancy

> [!WARNING]
> **Crucial Guidance for Major Project Defense:**  
> Early presentation drafts mentioned a model accuracy of **99.47%**. That score resulted from training on an over-sampled synthetic dataset (`pima-indians-diabetes-large.csv`) where synthetic data generation induced extreme data leakage and memorization.  
>  
> In contrast, the **82.27% accuracy / 0.8862 ROC-AUC** reported here represents **genuine, robust generalization on 25,500 real Indian clinical patients**. In academic presentations, external examiners and medical specialists will immediately respect an 82.3% verified clinical model over an unrealistic 99.5% synthetic model.

---

## 7. Model Versioning & Deployment Verification

- **Serialized Artifact:** `backend/app/ml/diabetes_pipeline_v2.pkl`
- **Metadata File:** `backend/app/ml/model_metadata_v2.json`
- **Compatibility Metrics:** `backend/app/ml/model_metrics.json`
- **Runtime API Endpoint:** `GET /api/prediction/accuracy` (Exposes genuine test metrics to Hero & Dashboard)
