"""
Medical Report Extractor Service — DiaSense AI (Production Grade)
Extracts diabetes-relevant health data from PDF and image medical reports.

Features:
- Dual-engine PDF extraction: pdfplumber (structured) + PyMuPDF (fallback)
- High-resolution OCR with pytesseract for scanned documents and images
- OCR Quality Control Check: detects unreadable, noisy, or garbled scans
- Context-aware synonym dictionary matching clinical laboratory standards
- Explicit medical unit normalization (e.g. mmol/L -> mg/dL, lbs -> kg, m/ft -> cm)
- Physiological boundary validation & Confidence scoring (HIGH, MEDIUM, LOW)
- Hard rule: NEVER INVENT patient data. Missing values remain missing.
"""
import io
import re
import os
import logging
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# ── Physiological Validation Ranges (matching PredictionRequest schema) ───────
FIELD_RANGES = {
    "age":                    (1.0,   110.0),
    "height":                 (100.0, 250.0),
    "weight":                 (20.0,  250.0),
    "bmi":                    (10.0,  70.0),
    "blood_pressure":         (60.0,  220.0),
    "physical_activity_hours":(0.0,   20.0),
    "daily_sugar_intake":     (0.0,   200.0),
    "fast_food_frequency":    (0.0,   15.0),
    "sleep_hours":            (2.0,   14.0),
    "hba1c":                  (3.0,   20.0),
    "fasting_glucose":        (50.0,  450.0),
    "family_history":         (0.0,   1.0),
    "monthly_income":         (0.0,   200000.0),
}

GENDER_MAP = {
    "male": "Male", "m": "Male", "man": "Male", "boy": "Male",
    "female": "Female", "f": "Female", "woman": "Female", "girl": "Female"
}
PATIENT_GROUP_MAP = {
    "urban": "Urban", "rural": "Rural", "semi-urban": "Semi-Urban",
    "semiurban": "Semi-Urban", "suburban": "Semi-Urban"
}
FAMILY_HISTORY_YES = {"yes", "positive", "present", "1", "true", "detected", "यस", "हाँ"}
FAMILY_HISTORY_NO  = {"no", "negative", "absent", "0", "false", "none", "nil", "नहीं", "नहि"}


# ─────────────────────────────────────────────────────────────────────────────
# 1. TEXT EXTRACTION & OCR
# ─────────────────────────────────────────────────────────────────────────────

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract native text from digital PDF using pypdf, pdfplumber, and PyMuPDF."""
    text = ""
    # 1. pypdf (pure Python, zero OS dependencies, fast & reliable)
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        if text.strip():
            logger.info("PDF text extracted via pypdf (%d characters)", len(text))
            return text
    except Exception as exc:
        logger.warning("pypdf extraction failed: %s", exc)

    # 2. pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        if text.strip():
            logger.info("PDF text extracted via pdfplumber (%d characters)", len(text))
            return text
    except Exception as exc:
        logger.warning("pdfplumber extraction failed: %s", exc)

    # 3. PyMuPDF fallback
    try:
        try:
            import pymupdf as fitz
        except ImportError:
            import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        if text.strip():
            logger.info("PDF text extracted via PyMuPDF (%d characters)", len(text))
            return text
    except Exception as exc:
        logger.warning("PyMuPDF fallback failed: %s", exc)

    return text



def _extract_text_from_image(file_bytes: bytes) -> str:
    """OCR an image using pytesseract with PIL image preprocessing."""
    try:
        import pytesseract
        from PIL import Image, ImageEnhance, ImageFilter

        img = Image.open(io.BytesIO(file_bytes))
        # Convert to grayscale and enhance contrast for better medical OCR accuracy
        if img.mode != "L":
            img = img.convert("L")
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.8)

        text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
        logger.info("Image OCR completed (%d characters)", len(text))
        return text
    except Exception as exc:
        logger.warning("pytesseract image OCR failed: %s", exc)
        return ""


def _ocr_pdf_scanned_pages(file_bytes: bytes) -> str:
    """Rasterize PDF pages to high-resolution images and run OCR."""
    text = ""
    try:
        import fitz
        import pytesseract
        from PIL import Image

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for i, page in enumerate(doc):
            if i >= 5:  # Limit to first 5 pages for responsiveness
                break
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
            page_text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
            text += page_text + "\n"
        doc.close()
        logger.info("Scanned PDF OCR completed (%d characters)", len(text))
    except Exception as exc:
        logger.warning("Scanned PDF OCR failed: %s", exc)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# 2. OCR QUALITY CONTROL CHECK
# ─────────────────────────────────────────────────────────────────────────────

def assess_ocr_quality(text: str) -> Tuple[bool, Optional[str]]:
    """
    Checks if extracted text is legible or degraded/garbled.
    Returns (is_acceptable, warning_message).
    """
    cleaned = text.strip()
    if len(cleaned) < 25:
        return False, "The document text is very short or could not be read clearly. Please verify the highlighted fields."

    # Ratio of alphanumeric characters to total characters
    alphanumeric_count = sum(1 for c in cleaned if c.isalnum())
    ratio = alphanumeric_count / max(len(cleaned), 1)

    if ratio < 0.45:
        return False, "Some information in this report could not be read clearly due to image quality or scan noise. Please verify the highlighted fields."

    return True, None


# ─────────────────────────────────────────────────────────────────────────────
# 3. CONTEXT-AWARE MEDICAL FIELD PARSER
# ─────────────────────────────────────────────────────────────────────────────

def _confidence(value: Optional[float], field: str, has_explicit_unit: bool = False) -> str:
    """Evaluate confidence level based on physiological bounds and unit evidence."""
    if value is None:
        return "LOW"
    lo, hi = FIELD_RANGES.get(field, (None, None))
    if lo is None:
        return "HIGH" if has_explicit_unit else "MEDIUM"

    if lo <= value <= hi:
        return "HIGH" if has_explicit_unit else "MEDIUM"
    elif (lo * 0.9) <= value <= (hi * 1.1):
        return "MEDIUM"
    return "LOW"


def _extract_glucose(text: str) -> Optional[Dict[str, Any]]:
    """Extract Fasting Blood Glucose, handling mg/dL and mmol/L."""
    patterns = [
        r"(?:fasting\s*(?:blood\s*)?(?:glucose|sugar)|fbg|fbs|fasting\s*plasma\s*glucose|plasma\s*glucose\s*[-:]?\s*fasting)[\s:=-]+(\d+(?:\.\d+)?)\s*(mg\s*/?\s*dl|mmol\s*/?\s*l)?",
        r"\b(?:glucose|sugar)\s*[-:]?\s*fasting[\s:=-]+(\d+(?:\.\d+)?)\s*(mg\s*/?\s*dl|mmol\s*/?\s*l)?",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = float(m.group(1))
            unit = (m.group(2) or "").lower().replace(" ", "")
            has_unit = bool(unit)

            # Convert mmol/L to mg/dL if unit is mmol/l or value looks like mmol/L (< 25)
            if "mmol" in unit or (val < 25.0 and val > 2.0 and not "mg" in unit):
                val = round(val * 18.0182, 1)
                unit = "mg/dL (converted from mmol/L)"
                has_unit = True

            conf = _confidence(val, "fasting_glucose", has_unit)
            if conf != "LOW":
                return {
                    "value": val,
                    "unit": "mg/dL",
                    "confidence": conf,
                    "raw": m.group(0).strip(),
                }
    return None


def _extract_hba1c(text: str) -> Optional[Dict[str, Any]]:
    """Extract HbA1c (Glycated Hemoglobin), handling %, Level label, and IFCC mmol/mol."""
    patterns = [
        r"(?:hba1c(?:\s*level)?|glycated\s*h[ae]moglobin|glycosylated\s*h[ae]moglobin|h[ae]moglobin\s*a1c|a1c)[\s:=-]+(\d+(?:\.\d+)?)\s*(%|percent|mmol\s*/?\s*mol)?",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = float(m.group(1))
            unit = (m.group(2) or "").lower().replace(" ", "")
            has_unit = bool(unit)

            # Convert IFCC mmol/mol if value > 25 (e.g. 48 mmol/mol -> ~6.5%)
            if "mmol" in unit or (val > 20.0 and val < 150.0):
                val = round((val * 0.09148) + 2.152, 1)
                unit = "% (converted from IFCC mmol/mol)"
                has_unit = True

            conf = _confidence(val, "hba1c", has_unit)
            if conf != "LOW":
                return {
                    "value": val,
                    "unit": "%",
                    "confidence": conf,
                    "raw": m.group(0).strip(),
                }
    return None


def _extract_blood_pressure(text: str) -> Optional[Dict[str, Any]]:
    """Extract Systolic Blood Pressure from pair (e.g. 120/80 mmHg) or standalone systolic."""
    pair_pattern = r"(?:blood\s*pressure|b\.?p\.?|bp|systolic\s*bp)[\s:=-]+(\d{2,3})\s*(?:/|over)\s*(\d{2,3})\s*(mm\s*hg)?"
    m = re.search(pair_pattern, text, re.IGNORECASE)
    if m:
        systolic = float(m.group(1))
        diastolic = float(m.group(2))
        has_unit = bool(m.group(3))
        conf = _confidence(systolic, "blood_pressure", has_unit)
        if conf != "LOW":
            return {
                "value": systolic,
                "unit": "mmHg",
                "confidence": conf,
                "raw": m.group(0).strip(),
                "details": f"{int(systolic)}/{int(diastolic)} mmHg",
            }

    # Standalone systolic or general single-value Blood Pressure (e.g. Blood Pressure 120 mmHg)
    single_pattern = r"(?:blood\s*pressure|b\.?p\.?|systolic(?:\s*(?:blood\s*pressure|bp))?|systolic)[\s:=-]+(\d{2,3})\s*(mm\s*hg)?"
    sm = re.search(single_pattern, text, re.IGNORECASE)
    if sm:
        systolic = float(sm.group(1))
        has_unit = bool(sm.group(2))
        conf = _confidence(systolic, "blood_pressure", has_unit)
        if conf != "LOW":
            return {
                "value": systolic,
                "unit": "mmHg",
                "confidence": conf,
                "raw": sm.group(0).strip(),
            }
    return None


def _extract_bmi(text: str) -> Optional[Dict[str, Any]]:
    """Extract BMI (Body Mass Index)."""
    pattern = r"(?:bmi\s*(?:\([^)]*\))?|body\s*mass\s*index|b\.?m\.?i\.?)[\s:=-]+(\d+(?:\.\d+)?)\s*(kg\s*/?\s*m[\u00b2²2]?)?"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        val = float(m.group(1))
        has_unit = bool(m.group(2))
        conf = _confidence(val, "bmi", has_unit)
        if conf != "LOW":
            return {
                "value": val,
                "unit": "kg/m²",
                "confidence": conf,
                "raw": m.group(0).strip(),
            }
    return None



def _extract_height_weight(text: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Extract Height (cm) and Weight (kg)."""
    h_result = None
    w_result = None

    # Height: "Height: 170 cm" or "Height: 5 ft 8 in"
    h_cm = re.search(r"(?:height|ht|stature)[\s:=-]+(\d+(?:\.\d+)?)\s*(cm|centimeters?|m|meters?)?", text, re.IGNORECASE)
    if h_cm:
        val = float(h_cm.group(1))
        unit = (h_cm.group(2) or "").lower()
        if "m" in unit and val < 3.0:
            val = round(val * 100, 1)
        if 100 <= val <= 250:
            h_result = {"value": val, "unit": "cm", "confidence": "HIGH" if unit else "MEDIUM", "raw": h_cm.group(0).strip()}

    # Height feet/inches
    h_ft = re.search(r"(?:height|ht)[\s:=-]+(\d+)\s*(?:ft|feet|')\s*(?:and\s*)?(\d+)?\s*(?:in|inches|\")?", text, re.IGNORECASE)
    if h_ft and not h_result:
        ft = float(h_ft.group(1))
        inch = float(h_ft.group(2)) if h_ft.group(2) else 0.0
        cm = round((ft * 30.48 + inch * 2.54), 1)
        if 100 <= cm <= 250:
            h_result = {"value": cm, "unit": "cm", "confidence": "HIGH", "raw": h_ft.group(0).strip()}

    # Weight: "Weight: 75 kg" or "Weight: 165 lbs"
    w_match = re.search(r"(?:weight|wt|body\s*weight)[\s:=-]+(\d+(?:\.\d+)?)\s*(kg|kilos?|kilograms?|lbs?|pounds?)?", text, re.IGNORECASE)
    if w_match:
        val = float(w_match.group(1))
        unit = (w_match.group(2) or "").lower()
        if "lb" in unit or "pound" in unit:
            val = round(val * 0.45359237, 1)
        if 20 <= val <= 250:
            w_result = {"value": val, "unit": "kg", "confidence": "HIGH" if unit else "MEDIUM", "raw": w_match.group(0).strip()}

    return h_result, w_result


def _extract_demographics_and_lifestyle(text: str) -> Dict[str, Dict[str, Any]]:
    """Extract Age, Gender, Full Name, Patient Group, Family History, Lifestyle habits."""
    results = {}

    # Combined Age / Gender: "Age / Gender: 21 yrs / Male" or "Age: 45 / Female"
    combo = re.search(r"age\s*(?:/\s*gender)?[\s:=-]+(\d{1,3})\s*(?:years?|yrs?)?\s*/?\s*(male|female)", text, re.IGNORECASE)
    if combo:
        age_val = float(combo.group(1))
        if 1 <= age_val <= 110:
            results["age"] = {"value": age_val, "unit": "years", "confidence": "HIGH", "raw": combo.group(0).strip()}
        g_val = combo.group(2).lower()
        if g_val in GENDER_MAP:
            results["gender"] = {"value": GENDER_MAP[g_val], "unit": "", "confidence": "HIGH", "raw": combo.group(0).strip()}

    # Standalone Age if not captured by combo
    if "age" not in results:
        age_match = re.search(r"\b(?:age|years\s*old)[\s:=-]+(\d{1,3})\s*(?:years?|yrs?)?\b", text, re.IGNORECASE)
        if age_match:
            age_val = float(age_match.group(1))
            if 1 <= age_val <= 110:
                results["age"] = {"value": age_val, "unit": "years", "confidence": "HIGH", "raw": age_match.group(0).strip()}

    # Standalone Gender if not captured by combo
    if "gender" not in results:
        gender_match = re.search(r"\b(?:gender|sex)[\s:=-]+(\w+)\b", text, re.IGNORECASE)
        if gender_match:
            g = gender_match.group(1).lower()
            if g in GENDER_MAP:
                results["gender"] = {"value": GENDER_MAP[g], "unit": "", "confidence": "HIGH", "raw": gender_match.group(0).strip()}

    # Full Name: "Patient Name: Gagan"
    name_match = re.search(r"(?:patient\s*name|name\s*of\s*patient)[\s:=-]+([a-zA-Z\s]{2,40})", text, re.IGNORECASE)
    if name_match:
        name_val = name_match.group(1).strip()
        # Ensure it doesn't grab trailing keywords
        name_val = re.sub(r"(report\s*id|id|age|date).*", "", name_val, flags=re.IGNORECASE).strip()
        if len(name_val) >= 2:
            results["fullName"] = {"value": name_val, "unit": "", "confidence": "HIGH", "raw": name_match.group(0).strip()}

    # Family History: "Family History Negative (No)" or "Family History: Yes"
    fh_match = re.search(r"(?:family\s*history(?:\s*of\s*diabetes)?|diabetic\s*heredity)[\s:=-]+([a-zA-Z0-9\(\)\s]+)", text, re.IGNORECASE)
    if fh_match:
        ans = fh_match.group(1).strip().lower()
        if any(w in ans for w in FAMILY_HISTORY_YES):
            results["family_history"] = {"value": 1.0, "unit": "boolean", "confidence": "HIGH", "raw": fh_match.group(0).strip()}
        elif any(w in ans for w in FAMILY_HISTORY_NO):
            results["family_history"] = {"value": 0.0, "unit": "boolean", "confidence": "HIGH", "raw": fh_match.group(0).strip()}

    # Location / Patient Group
    loc_match = re.search(r"\b(urban|rural|semi[\s-]?urban|suburban)\b", text, re.IGNORECASE)
    if loc_match:
        norm = loc_match.group(1).lower().replace(" ", "").replace("-", "")
        if "semi" in norm or "sub" in norm:
            val = "Semi-Urban"
        elif "rural" in norm:
            val = "Rural"
        else:
            val = "Urban"
        results["patient_group"] = {"value": val, "unit": "", "confidence": "MEDIUM", "raw": loc_match.group(0).strip()}

    # Sleep Hours: "Daily Sleep 7.0 hrs/night" or "Sleep: 8 hours"
    sleep_match = re.search(r"(?:daily\s*sleep|sleep\s*duration|sleep\s*hours|sleep)[\s:=-]+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", text, re.IGNORECASE)
    if sleep_match:
        s_val = float(sleep_match.group(1))
        if 2 <= s_val <= 14:
            results["sleep_hours"] = {"value": s_val, "unit": "hours", "confidence": "HIGH", "raw": sleep_match.group(0).strip()}

    # Physical Activity: "Physical Activity 1.0 hrs/week"
    act_match = re.search(r"(?:physical\s*activity|exercise|workout)[\s:=-]+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", text, re.IGNORECASE)
    if act_match:
        act_val = float(act_match.group(1))
        if 0 <= act_val <= 20:
            results["physical_activity_hours"] = {"value": act_val, "unit": "hours/day", "confidence": "HIGH", "raw": act_match.group(0).strip()}

    # Daily Sugar Intake: "Daily Sugar Intake 30 g/day"
    sugar_match = re.search(r"(?:daily\s*sugar(?:\s*intake)?|sugar\s*intake)[\s:=-]+(\d+(?:\.\d+)?)\s*(?:grams?|g)?", text, re.IGNORECASE)
    if sugar_match:
        sug_val = float(sugar_match.group(1))
        if 0 <= sug_val <= 200:
            results["daily_sugar_intake"] = {"value": sug_val, "unit": "grams", "confidence": "HIGH", "raw": sugar_match.group(0).strip()}

    # Fast food frequency: "Fast Food Frequency 2 meals/week"
    ff_match = re.search(r"(?:fast\s*food(?:\s*frequency)?|junk\s*food)[\s:=-]+(\d+(?:\.\d+)?)\s*(?:meals?|times?)?", text, re.IGNORECASE)
    if ff_match:
        ff_val = float(ff_match.group(1))
        if 0 <= ff_val <= 15:
            results["fast_food_frequency"] = {"value": ff_val, "unit": "meals/week", "confidence": "HIGH", "raw": ff_match.group(0).strip()}

    # Monthly income
    inc_match = re.search(r"(?:monthly\s*income|household\s*income|salary)[\s:=-]+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if inc_match:
        inc_val = float(inc_match.group(1))
        if 0 <= inc_val <= 200000:
            results["monthly_income"] = {"value": inc_val, "unit": "₹", "confidence": "HIGH", "raw": inc_match.group(0).strip()}

    return results



# ─────────────────────────────────────────────────────────────────────────────
# 4. MAIN EXTRACTION ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def extract_from_report(file_bytes: bytes, filename: str, content_type: str) -> Dict[str, Any]:
    """
    Main extraction pipeline.
    Returns:
    {
        "success": bool,
        "source_type": "pdf_text" | "pdf_ocr" | "image_ocr",
        "ocr_quality_ok": bool,
        "ocr_quality_warning": str | None,
        "raw_text_preview": str,
        "extracted_fields": {
            field_name: { "value": Any, "unit": str, "confidence": "HIGH"|"MEDIUM"|"LOW", "raw": str }
        },
        "fields_found": int,
        "error": str | None
    }
    """
    fn_lower = filename.lower()
    ct_lower = (content_type or "").lower()

    try:
        # Determine extraction strategy
        if fn_lower.endswith(".pdf") or "pdf" in ct_lower:
            text = _extract_text_from_pdf(file_bytes)
            source_type = "pdf_text"
            if len(text.strip()) < 50:
                text = _ocr_pdf_scanned_pages(file_bytes)
                source_type = "pdf_ocr"
        else:
            text = _extract_text_from_image(file_bytes)
            source_type = "image_ocr"

        # Quality check
        quality_ok, quality_warning = assess_ocr_quality(text)
        if not text.strip():
            return {
                "success": False,
                "source_type": source_type,
                "ocr_quality_ok": False,
                "ocr_quality_warning": "No readable text could be extracted from this document. Please enter values manually.",
                "raw_text_preview": "",
                "extracted_fields": {},
                "fields_found": 0,
                "error": "Could not read text from this file. Please enter values manually.",
            }

        # Context-aware extraction
        extracted_fields: Dict[str, Dict[str, Any]] = {}

        # 1. Glucose
        gl = _extract_glucose(text)
        if gl:
            extracted_fields["fasting_glucose"] = gl

        # 2. HbA1c
        hb = _extract_hba1c(text)
        if hb:
            extracted_fields["hba1c"] = hb

        # 3. Blood Pressure
        bp = _extract_blood_pressure(text)
        if bp:
            extracted_fields["blood_pressure"] = bp

        # 4. BMI
        bmi = _extract_bmi(text)
        if bmi:
            extracted_fields["bmi"] = bmi

        # 5. Height & Weight
        ht, wt = _extract_height_weight(text)
        if ht:
            extracted_fields["height"] = ht
        if wt:
            extracted_fields["weight"] = wt

        # 6. Demographics & Lifestyle
        demo_life = _extract_demographics_and_lifestyle(text)
        extracted_fields.update(demo_life)

        logger.info(
            "Extraction completed for %s: %d fields found (source=%s, quality_ok=%s)",
            filename, len(extracted_fields), source_type, quality_ok
        )

        return {
            "success": True,
            "source_type": source_type,
            "ocr_quality_ok": quality_ok,
            "ocr_quality_warning": quality_warning,
            "raw_text_preview": text[:500],
            "extracted_fields": extracted_fields,
            "fields_found": len(extracted_fields),
            "error": None,
        }

    except Exception as exc:
        logger.error("Medical report extraction error on %s: %s", filename, exc, exc_info=True)
        return {
            "success": False,
            "source_type": "unknown",
            "ocr_quality_ok": False,
            "ocr_quality_warning": None,
            "raw_text_preview": "",
            "extracted_fields": {},
            "fields_found": 0,
            "error": "An error occurred while processing the document. Please enter your health values manually.",
        }
