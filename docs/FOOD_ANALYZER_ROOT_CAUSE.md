# Food Analyzer Root Cause Investigation & Audit Report

**Date of Investigation:** October 17, 2026  
**Investigating Team:** Computer Vision, ML Engineering, Healthcare UX, & API Specialists  
**Repository Branch:** `main`  
**Status:** Root Causes Fully Identified & Programmatically Reproduced

---

## 1. Executive Summary & Observed Failures

The Food Analyzer module exhibited critical classification and clinical safety failures in live user demonstrations:

| User Upload | Displayed Identification | Displayed Match Score | Displayed Clinical Suitability | Expected Clinical Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Burger with bun, cheese, patty** | **Moong Dal Khichdi** | **65% Match** | **🟢 Diabetic Friendly (Suitable (Low GI))** | Identify as Burger / Fast food (High GI, High Carb/Fat); NOT Khichdi |
| **Chicken meal with side dishes** | **Chapati** | **65% Match** | **🟢 Diabetic Friendly (Suitable (Low GI))** | Identify components (Chicken, sides); NOT Chapati |

These failures represent a severe clinical safety risk: attributing low-glycemic, diabetic-friendly dietary clearance to high-glycemic or high-fat meals.

---

## 2. Programmatic Reproduction & Evidence

A test script was executed directly against `FoodAnalyzerService` in `backend/app/services/food_analyzer_service.py`:

```python
# Simulated burger color profile (warm bun, cheese, patty: R=145, G=118, B=75)
burger_img = create_image_with_profile(r=145, g=118, b=75)
res_burger = service.analyze_food_image(burger_bytes, 'burger.jpg')

# Output observed:
# Dish Name: Moong Dal Khichdi
# Confidence: 0.65
# Suitability: Diabetic Friendly
# Calories: 270.0 (Khichdi nutrition, NOT Burger)

# Simulated chicken dish profile (roasted chicken, dark curry: R=88, G=56, B=48)
chicken_img = create_image_with_profile(r=88, g=56, b=48)
res_chicken = service.analyze_food_image(chicken_bytes, 'chicken_meal.jpg')

# Output observed:
# Dish Name: Chapati
# Confidence: 0.65
# Suitability: Diabetic Friendly
# Calories: 120.0 (Chapati nutrition, NOT Chicken)
```

The bug was reproduced with 100% determinism.

---

## 3. Detailed Root Causes & Architectural Flaws

### Flaw 1: Flawed Offline Color Fallback (`_perceptual_visual_analysis`)
- **Location:** `backend/app/services/food_analyzer_service.py`, lines 392–428.
- **Mechanism:** When no cloud vision API key is set (`GEMINI_API_KEY` is empty in `settings.py`), the service invokes `_perceptual_visual_analysis`.
- **The Defect:** This function calculates the global mean of RGB channels across a downsampled 64x64 thumbnail:
  - If `r_mean > 120 and g_mean > 110 and b_mean < 100`, it forces `target_dish = "Moong Dal Khichdi"`.
  - A golden-brown burger bun with cheese and warm restaurant lighting matches this color range exactly, regardless of whether it is a burger, pizza, or pancake.
  - If `r_mean > 70 and g_mean > 50 and b_mean < 60`, it forces `target_dish = "Chapati"`.
  - Roasted chicken, meat curries, and gravies match these brown/earthy channel values, forcing the label to "Chapati".
- **Conclusion:** RGB channel averages have zero spatial, morphological, or structural awareness. Treating color histograms as object identification is a fundamental flaw.

### Flaw 2: Fabricated "65% Match" Confidence Score
- **Location:** `backend/app/services/food_analyzer_service.py`, line 423.
- **The Defect:**
  ```python
  res = self.analyze_meal_text(target_dish, lang)
  res.confidence_score = 0.65  # <--- HARDCODED MAGIC NUMBER
  ```
- **The Display:** `FoodAnalyzer.jsx` formats this as:
  ```jsx
  <span className="confidence-pill"><FaCheckCircle /> {Math.round(analysisResult.confidence_score * 100)}% Match</span>
  ```
- **Conclusion:** The "65% Match" was not a model probability, cosine similarity, or calibrated metric. It was an arbitrary hardcoded floating-point number disguised as an AI confidence score.

### Flaw 3: Conflation of Text-Based Knowledge Base with Visual Analysis
- **Location:** `food_analyzer_service.py`, line 422.
- **The Defect:** `res = self.analyze_meal_text(target_dish, lang)`.
- **Mechanism:** Instead of performing visual classification, the image pipeline simply called the text meal parser with the forced dish name string (`"Moong Dal Khichdi"`).
- **Consequence:** The text parser looked up "Moong Dal Khichdi" in the local Indian food table, retrieved its low GI (38) and diabetic suitability ("Diabetic Friendly"), and assigned that clinical assessment to the burger photo.

### Flaw 4: Forced Guessing in Cloud Vision Prompting
- **Location:** `food_analyzer_service.py`, lines 494–529.
- **The Defect:** In `_query_gemini_image_vision`, the prompt instructs:
  `"Identify the exact food dish and ingredients in this image. Return JSON ONLY matching this exact structure: {"dish_name": "Accurate Name of the Dish", "overall_suitability": "Diabetic Friendly", ...}"`
- **Consequence:**
  - The model was given no option to return `"unrecognized"`, `"multiple_foods_detected"`, or `"needs_confirmation"`.
  - Providing `"Diabetic Friendly"` as the sample value biased the model toward returning diabetic friendly for all images.
  - The prompt forced visual recognition, portion guessing, nutrition hallucination, and clinical clearance into a single unverified step.

### Flaw 5: State Staleness in Frontend
- **Location:** `frontend/src/pages/FoodAnalyzer/FoodAnalyzer.jsx`.
- **The Defect:** No analysis/request ID tied the response to the active file. If a previous analysis was successful and a subsequent upload failed, or if asynchronous responses arrived out of order, the user was left looking at the previous meal's nutrition while previewing a new image.

---

## 4. Remediation Strategy Required

1. **Eliminate Forced Guessing:** Introduce 5 formal states: `identified`, `multiple_foods_detected`, `needs_confirmation`, `unrecognized`, `invalid_image`.
2. **Never Fabricate Food Names:** If the vision engine cannot verify the dish with high confidence, state `"Food Not Identified With Certainty"` and ask the user to confirm. Never assign a default dish like Khichdi or Chapati.
3. **Decouple Vision from Nutrition:** Image recognition identifies candidate foods and visible items. Nutrition and glycemic impact are retrieved in a separate, deterministic stage based on verified data.
4. **Honest Confidence Calibration:** Remove all arbitrary `0.65` constants. Confidence must reflect genuine model probabilities or evidence metrics, and low confidence must trigger the `"Needs Confirmation"` or `"Unrecognized"` workflow.
5. **No Blind Diabetic Clearance:** Diabetic suitability must display `"Evidence Insufficient"` or `"Uncertain - Consult Ingredients"` unless the food identity and carbohydrate content are confirmed.
