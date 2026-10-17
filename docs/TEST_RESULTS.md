# DiaSense AI — Test Execution & Verification Report

**Date of Execution:** October 17, 2026  
**Environment:** Python 3.14.7 | pytest 9.1.1 | Node.js v20+ | Vite 8.1.5  
**Total Automated Tests:** 50 Backend Tests | 1 Frontend Production Build  
**Overall Result:** **ALL 50 TESTS PASSED (100% Pass Rate, 0 Failures)**

---

## 1. Backend Pytest Execution Summary

```
============================= test session starts =============================
platform win32 -- Python 3.14.7, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\Admin\Downloads\FinalDP\DiaSenseAI\project_src\backend
collected 50 items

tests/test_assessment_nulls.py::test_prediction_with_all_optional_fields_null PASSED [  2%]
tests/test_auth.py::test_register_user PASSED                                [  4%]
tests/test_auth.py::test_login_user PASSED                                   [  6%]
tests/test_auth.py::test_login_invalid_password PASSED                       [  8%]
tests/test_auth.py::test_login_nonexistent_user PASSED                       [ 10%]
tests/test_auth.py::test_register_duplicate_email PASSED                     [ 12%]
tests/test_auth_and_security.py::test_register_and_login_flow PASSED         [ 14%]
tests/test_auth_and_security.py::test_register_duplicate_email PASSED        [ 16%]
tests/test_auth_and_security.py::test_login_invalid_credentials PASSED       [ 18%]
tests/test_auth_and_security.py::test_protected_routes_require_token PASSED  [ 20%]
tests/test_auth_and_security.py::test_token_refresh_flow PASSED             [ 22%]
tests/test_auth_and_security.py::test_invalid_token_rejected PASSED         [ 24%]
tests/test_dashboard.py::test_dashboard_endpoint_authenticated PASSED        [ 26%]
tests/test_dashboard.py::test_dashboard_endpoint_unauthenticated PASSED      [ 28%]
tests/test_dashboard_empty_state.py::test_dashboard_empty_state_zero_assessments PASSED [ 30%]
tests/test_food_analysis.py::test_text_analysis_known_staple PASSED         [ 32%]
tests/test_food_analysis.py::test_text_analysis_unknown_safe_estimate PASSED [ 34%]
tests/test_food_analysis.py::test_text_analysis_empty_rejects PASSED        [ 36%]
tests/test_food_analysis.py::test_image_analysis_green_dish PASSED          [ 38%]
tests/test_food_analysis.py::test_image_analysis_yellow_dish PASSED         [ 40%]
tests/test_food_analysis.py::test_image_analysis_blank_image_flagged_ambiguous PASSED [ 42%]
tests/test_food_analysis.py::test_image_analysis_corrupted_bytes_fails_safely PASSED [ 44%]
tests/test_ml_pipeline.py::test_xgboost_v2_model_loaded PASSED              [ 46%]
tests/test_ml_pipeline.py::test_feature_names_and_count PASSED               [ 48%]
tests/test_ml_pipeline.py::test_scaler_transform PASSED                     [ 50%]
tests/test_ml_pipeline.py::test_prediction_probabilities_range PASSED        [ 52%]
tests/test_ml_pipeline.py::test_threshold_consistency PASSED                [ 54%]
tests/test_nearby_care.py::test_haversine_distance_accuracy PASSED          [ 56%]
tests/test_nearby_care.py::test_pin_cluster_geocoding_instant PASSED        [ 58%]
tests/test_nearby_care.py::test_nearby_facilities_sorted_by_distance PASSED [ 60%]
tests/test_nearby_care.py::test_nearby_laboratories_category PASSED         [ 62%]
tests/test_prediction.py::test_prediction_low_risk PASSED                   [ 64%]
tests/test_prediction.py::test_prediction_high_risk PASSED                  [ 66%]
tests/test_prediction.py::test_prediction_accuracy_endpoint PASSED          [ 68%]
tests/test_prediction.py::test_prediction_history_unauthenticated PASSED    [ 70%]
tests/test_report_endpoints.py::test_pdf_report_generation PASSED           [ 72%]
tests/test_report_endpoints.py::test_report_metadata PASSED                 [ 74%]
tests/test_report_endpoints.py::test_unauthenticated_report_access PASSED   [ 76%]
[... 12 additional test fixtures passed]
================= 50 passed, 126 warnings in 64.87s (0:01:04) =================
```

---

## 2. Frontend Production Build Summary

```
> frontend@0.0.0 build
> vite build

vite v8.1.5 building client environment for production...
transforming...✓ 1115 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.17 kB │ gzip:   0.58 kB
dist/assets/index-CVH16f3Q.css    139.84 kB │ gzip:  24.72 kB
dist/assets/index-Bd26hkaY.js   1,323.55 kB │ gzip: 373.93 kB
✓ built in 12.16s
```

**Build Status:** Clean build, 0 compile errors, 0 syntax regressions.
