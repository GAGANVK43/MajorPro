# DiaSense AI — Food Analyzer Architecture Specification

## 1. System Overview & Engineering Objectives

The **DiaSense AI Food Analyzer** is an evidence-based clinical nutrition assessment engine designed for individuals with diabetes, prediabetes, or metabolic syndrome. The core objective of the engine is to estimate dietary macronutrients, calculate glycemic index (GI) and glycemic load (GL), and provide actionable, safe clinical dietary guidance without ever fabricating nutritional facts, confidence metrics, or health suitability.

### Core Architectural Principles
1. **Decoupled 2-Stage Pipeline**: Visual image recognition (Stage 1) is completely decoupled from clinical nutritional data retrieval (Stage 2).
2. **Honesty & Refusal to Guess**: When computer vision models or cloud vision APIs are unconfigured or low-confidence, the system refuses to force raw pixel colors into arbitrary dish classifications. Instead, it presents candidate options and requires user confirmation.
3. **Clinical Safety Guarantee**: High-GI foods (e.g. burgers, french fries, samosas) must never be assigned low glycemic indices or labeled "Diabetic Friendly".
4. **Staleness Elimination**: Image selection, upload errors, or tab switches immediately clear stale results in the user interface.

---

## 2. Two-Stage Decoupled Pipeline

```
                                  [ User Input ]
                                  /            \
                     (Meal Image) /              \ (Meal Text Query)
                                 v                v
                 +-----------------------+   +-----------------------+
                 | STAGE 1: VISUAL REC   |   | Direct Text Parsing   |
                 | - Pixel Variance Pre- |   +-----------+-----------+
                 |   screen (PIL/NumPy)  |               |
                 | - Gemini Vision API   |               |
                 +-----------+-----------+               |
                             |                           |
             +---------------+---------------+           |
             |                               |           |
    [API Online & Conf >= 0.70]     [Offline / Ambiguous] |
             |                               |           |
             v                               v           |
      Dish Identified              Needs Confirmation    |
             |                     (Candidates Offered)  |
             |                               |           |
             |                     [User Confirms Dish]  |
             |                               |           |
             +---------------+---------------+           |
                             |                           |
                             +-------------+-------------+
                                           |
                                           v
                         +-----------------------------------+
                         | STAGE 2: CLINICAL NUTRITION ENGINE |
                         | - Authentic Clinical DB (KB)      |
                         | - Glycemic Index (GI) & Load (GL) |
                         | - Macronutrients & Fiber Breakdown|
                         | - ADA-aligned Suitability Rules   |
                         +-----------------+-----------------+
                                           |
                                           v
                              +--------------------------+
                              | Standardized Response    |
                              | 5 Modular Result States  |
                              +--------------------------+
```

---

## 3. Stage 1: Visual Recognition & Precheck

### 3.1 Image Pre-screening & Integrity Validation
Incoming images undergo validation in `FoodAnalyzerService.analyze_food_image`:
- **Byte Stream Verification**: Enforces `len(image_bytes) >= 100` and validates MIME types (`image/jpeg`, `image/png`, `image/webp`).
- **EXIF Transposition & Normalization**: Automatically normalizes mobile device orientations via `PIL.ImageOps.exif_transpose`.
- **Statistical Variance Precheck**: Computes pixel channel standard deviation over downsampled \(64 \times 64\) frames:
  $$\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (x_i - \mu)^2}$$
  - If $\sigma < 15.0$: The image is uniform, blank, or completely dark. The engine sets `status = "unrecognized"` with informative user guidance.
  - If $\sigma \ge 15.0$: The image possesses sufficient texture and contrast to proceed to vision analysis.

### 3.2 Cloud Vision AI (Google Gemini Vision)
When `GEMINI_API_KEY` is present, the image is compressed to a 512x512 JPEG and sent to Google Gemini Vision (`gemini-2.5-flash` / `gemini-2.0-flash` / `gemini-1.5-flash`) using an unforced prompt:
- Prompts for accurate dish identification, distinct component detection, and an honest confidence score ($0.0$ to $1.0$).
- If multiple food components are detected on a composite plate, `status = "multiple_foods_detected"` is assigned.
- If confidence score $\ge 0.70$ on a single item, `status = "identified"` is assigned.
- If confidence score $< 0.70$, `status = "needs_confirmation"` is assigned with candidate alternatives.

### 3.3 Privacy-Preserving Offline Engine
When cloud vision APIs are unconfigured or unavailable:
- **Eradication of Flawed Color Heuristics**: The engine strictly prohibits mapping raw RGB color channels (e.g. mean red, green, blue values) to specific dishes.
- **Honest Confirmation Contract**: Returns `status = "needs_confirmation"` with `confidence_score = None`, `total_calories_kcal = None`, and a curated list of candidate alternatives (`candidate_alternatives = ["Burger", "Chicken Meal", "Chapati", "Moong Dal Khichdi", "Masala Dosa", "Palak Paneer", "Green Salad", "Idli"]`).

---

## 4. Stage 2: Clinical Nutrition & Glycemic Index Engine

Once a dish is recognized or confirmed by the user, Stage 2 retrieves deterministic, clinically verified data:

### 4.1 Authentic Clinical Knowledge Base (`FOOD_KNOWLEDGE_BASE`)
The knowledge base maps canonical dishes and common aliases to exact nutritional metrics:
- **Energy & Macronutrients**: Total calories (kcal), carbohydrates (g), net carbohydrates (g), protein (g), dietary fiber (g), and healthy fats (g).
- **Glycemic Metrics**:
  - Glycemic Index (GI): Standardized scale referenced against glucose ($= 100$).
  - Glycemic Load (GL): Calculated as:
    $$\text{GL} = \frac{\text{Carbohydrates (g)} \times \text{GI}}{100}$$
- **Diabetic Suitability Standards**:
  - **Low GI ($\text{GI} < 55$)**: "Diabetic Friendly" (Emerald). Slower carbohydrate digestion prevents postprandial glucose surges.
  - **Moderate GI ($55 \le \text{GI} \le 69$)**: "Moderate / Control Portion" (Amber). Portion control advised; recommended to pair with soluble fiber.
  - **High GI ($\text{GI} \ge 70$)**: "High Risk / Limit Intake" (Red). High acute glycemic excursion risk; recommended to substitute or limit strictly.

### 4.2 Dynamic AI Nutrition Fallback
If an entered dish is not cataloged in the local clinical database:
- If `GEMINI_API_KEY` is present, the service queries Gemini with clinical nutritionist constraints.
- If offline, the service provides an honest, cautious estimate with `nutrition_source = "unverified_estimation"`, `overall_suitability = "Moderate / Control Portion"` (Amber), and clear disclaimers advising the user to enter individual ingredients. It **never** fabricates a "Diabetic Friendly" badge.

---

## 5. Formal Result Status Contracts

The API and frontend adhere to 5 formal result states:

| Status State | Trigger Condition | Visual UI Representation | Confidence Metric |
| :--- | :--- | :--- | :--- |
| `identified` | Vision AI confidence $\ge 0.70$ OR user confirms dish | Full verified nutrition grid, macronutrient cards, glycemic suitability badge | $\ge 0.85$ or "User Confirmed" |
| `multiple_foods_detected` | Plate with multiple items (e.g. chicken + sides + salad) | Component pill tags, composite nutritional totals, itemized breakdown | Reported per component |
| `needs_confirmation` | Vision offline OR recognition confidence $< 0.70$ | "Meal Confirmation Required" banner, interactive candidate buttons, search bar | `None` (Withheld) |
| `unrecognized` | Solid color, blank image, or non-food photograph | "Could Not Recognize Food" alert, photo tips, link to text search | `None` / Ambiguous |
| `invalid_image` | Corrupted byte stream, zero bytes, non-image format | 400 Bad Request error toast, prompt to upload JPEG/PNG/WebP | N/A |

---

## 6. API Route Contracts

### 6.1 `POST /api/food/analyze-text`
- **Request**: `{"query": "2 Masala Dosa with sambar"}`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Standardized `FoodAnalysisResponse` with verified nutrition.

### 6.2 `POST /api/food/analyze-image`
- **Request**: `multipart/form-data` with `file: UploadFile`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Standardized `FoodAnalysisResponse` with appropriate `status` (`needs_confirmation`, `identified`, `multiple_foods_detected`, or `unrecognized`).

### 6.3 `POST /api/food/confirm`
- **Request**: `{"dish_name": "Burger"}`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Verified `FoodAnalysisResponse` with `status = "identified"`, `is_user_confirmed = true`, `detection_source = "user_confirmed"`.
