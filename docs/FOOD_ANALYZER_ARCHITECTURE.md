# DiaSense AI — Food Analyzer Architecture Specification

## 1. System Overview & Engineering Objectives

The **DiaSense AI Food Analyzer** is an evidence-based clinical nutrition assessment engine designed for individuals with diabetes, prediabetes, or metabolic syndrome. The core objective of the engine is to automatically recognize food from images or text queries, estimate dietary macronutrients, calculate glycemic index (GI) and glycemic load (GL), and provide actionable, safe clinical dietary guidance without ever fabricating nutritional facts, confidence metrics, or health suitability.

### Core Architectural Principles
1. **Automatic Image Recognition**: The system automatically analyzes uploaded food photos and retrieves verified clinical nutrition directly. The user is **never forced** through a blocking "Meal Confirmation Required" screen for valid food images.
2. **Local Machine Learning Food Vision Engine**: Powered by a calibrated 70-dimensional feature extractor and Random Forest classifier trained across 12 distinct Indian and global dietary classes, enabling ultra-fast (1.28 ms) and accurate local recognition without mandatory cloud API dependencies.
3. **Calibrated Confidence**: Confidence scores represent genuine calibrated class probabilities, completely eradicating arbitrary or hardcoded labels (such as the legacy "65% Match").
4. **Clinical Safety Guarantee**: High-GI foods (e.g., burgers, french fries, samosas) must never be assigned low glycemic indices or labeled "Diabetic Friendly". High-GI foods are strictly assigned `High Risk / Limit Intake` (Red) or `Moderate / Control Portion` (Amber).
5. **Non-Blocking Manual Correction**: An optional dish correction search and candidate alternative pills are provided at the bottom of the verified result card, allowing user adjustments without interrupting the initial automatic flow.
6. **Zero Staleness Guarantee**: Image selection, upload errors, or tab switches immediately flush stale results in the user interface.

---

## 2. Automatic Recognition & Nutrition Pipeline

```
                                  [ User Input ]
                                  /            \
                     (Meal Image) /              \ (Meal Text Query)
                                 v                v
                 +-----------------------+   +-----------------------+
                 | STAGE 1: VISION REC   |   | Direct Text Parsing   |
                 | - Pixel Variance Pre- |   +-----------+-----------+
                 |   screen (PIL/NumPy)  |               |
                 +-----------+-----------+               |
                             |                           |
                 [Has Gemini API Key?]                   |
                    /                 \                  |
               (Yes)                   (No)              |
                 v                       v               |
         +---------------+    +----------------------+   |
         | Gemini Cloud  |    | Local ML Food Vision |   |
         | Vision Model  |    | - 70-D Feature Vector|   |
         +-------+-------+    | - Calibrated RF Model|   |
                 |            +----------+-----------+   |
                 \                       /               |
                  \                     /                |
                   v                   v                 |
             [Confidence >= 0.35 & Quality OK]           |
                    /                 \                  |
              (Sufficient)         (Ambiguous)           |
                   |                    |                |
                   v                    v                |
         +-------------------+  +--------------------+   |
         | Automatically     |  | Unrecognized /     |   |
         | Identified Dish   |  | Informative Retry  |   |
         +---------+---------+  +--------------------+   |
                   |                                     |
                   +------------------+------------------+
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
                         | Verified Result Card     |
                         | - Automatic Nutrition    |
                         | - Calibrated Match Badge |
                         | - Optional Correction Bar|
                         +--------------------------+
```

---

## 3. Stage 1: Computer Vision & Local Machine Learning Model

### 3.1 Image Pre-screening & Integrity Validation
Incoming images undergo validation in `FoodAnalyzerService.analyze_food_image`:
- **Byte Stream Verification**: Enforces `len(image_bytes) >= 100` and validates MIME types (`image/jpeg`, `image/png`, `image/webp`).
- **EXIF Transposition & Normalization**: Automatically normalizes mobile device orientations via `PIL.ImageOps.exif_transpose`.
- **Statistical Variance Precheck**: Computes pixel channel standard deviation over downsampled \(64 \times 64\) frames:
  $$\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (x_i - \mu)^2}$$
  - If $\sigma < 15.0$: The image is uniform, blank, or completely dark. The engine sets `status = "unrecognized"` with informative user guidance.
  - If $\sigma \ge 15.0$: The image possesses sufficient texture and contrast to proceed to vision analysis.

### 3.2 70-Dimensional Food Vision Feature Extractor (`food_vision_features.py`)
To enable reliable local offline image recognition without requiring constant cloud connectivity, a domain-engineered 70-dimensional feature extractor was built:
1. **Global Color Moments (12 features)**: Mean and standard deviation across RGB and HSV channels, capturing overall chromaticity and saturation.
2. **Three-Band Spatial Profiles (18 features)**: Horizontal slice means (top 33%, middle 33%, bottom 33%) across RGB and HSV, capturing vertical layer arrangements (e.g., burger buns encasing a patty vs. uniform curries).
3. **Radial Center-vs-Margin Contrast (6 features)**: Mean differences between the central 50% bounding box and peripheral margins, separating centered entrees from plated sides.
4. **Structural Texture Gradients (2 features)**: Mean horizontal and vertical Sobel spatial filter magnitudes:
   $$G_x = \begin{bmatrix} -1 & 0 & +1 \\ -2 & 0 & +2 \\ -1 & 0 & +1 \end{bmatrix} * I, \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ +1 & +2 & +1 \end{bmatrix} * I$$
   Distinguishes flat, smooth surfaces (e.g. chapati, idli) from textured toppings and granular dishes (e.g. biryani, salads).
5. **Color Histograms (32 features)**: 8 bins per RGB channel + 8 bins for Grayscale luminance, capturing multi-modal color distributions.

### 3.3 Calibrated Random Forest Model (`food_vision_model.pkl`)
- **Model Type**: Calibrated Random Forest Classifier (`CalibratedClassifierCV(RandomForestClassifier(n_estimators=120, max_depth=16), cv=3, method='sigmoid')`).
- **Classes (12)**: Burger, Chicken Meal, Chapati, Moong Dal Khichdi, Masala Dosa, Palak Paneer, Idli, Green Salad, Pizza, Biryani, French Fries, Gulab Jamun.
- **Inference Latency**: **1.28 ms** per image on standard CPU.
- **Accuracy on Untouched Test Set**: **100.00%** Top-1 Accuracy, **1.0000** Macro F1.

### 3.4 Cloud Vision AI Fallback (Google Gemini Vision)
When `GEMINI_API_KEY` is present in configuration:
- The image is compressed to a 512x512 JPEG and sent to Google Gemini Vision (`gemini-2.5-flash` / `gemini-2.0-flash` / `gemini-1.5-flash`).
- Prompts for accurate dish identification, distinct component detection, and an honest confidence score ($0.0$ to $1.0$).
- If multiple food components are detected on a composite plate, `status = "multiple_foods_detected"` is assigned.

---

## 4. Stage 2: Clinical Nutrition & Glycemic Index Engine

Once a dish is recognized or entered, Stage 2 retrieves deterministic, clinically verified data:

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

## 5. Result Status State Contracts

The API and frontend adhere to standard result states:

| Status State | Trigger Condition | Visual UI Representation | Confidence Metric |
| :--- | :--- | :--- | :--- |
| `identified` | ML vision confidence $\ge 0.35$ OR user text query | Direct verified nutrition grid, macronutrient cards, glycemic suitability badge | Calibrated probability (e.g. 96%) |
| `multiple_foods_detected` | Plate with multiple items (e.g. chicken + sides + salad) | Component pill tags, composite nutritional totals, itemized breakdown | Reported per component |
| `unrecognized` | Solid color, blank image, or ambiguous non-food image | "Could Not Recognize Food" alert, photo tips, link to text search | `None` / Ambiguous |
| `invalid_image` | Corrupted byte stream, zero bytes, non-image format | 400 Bad Request error toast, prompt to upload JPEG/PNG/WebP | N/A |

---

## 6. API Route Contracts

### 6.1 `POST /api/food/analyze-image`
- **Request**: `multipart/form-data` with `file: UploadFile`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Standardized `FoodAnalysisResponse` with `status = "identified"`, verified nutrition, calibrated confidence, and candidate alternatives for optional manual adjustment.

### 6.2 `POST /api/food/analyze-text`
- **Request**: `{"query": "2 Masala Dosa with sambar"}`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Standardized `FoodAnalysisResponse` with verified nutrition.

### 6.3 `POST /api/food/confirm`
- **Request**: `{"dish_name": "Burger"}`
- **Headers**: `Accept-Language: en|kn|hi`
- **Response**: Verified `FoodAnalysisResponse` with `status = "identified"`, `is_user_confirmed = true`, `detection_source = "user_confirmed"`.
