"""
Medical Report Extractor Service — DiaSense AI
Extracts diabetes-relevant health data from PDF and image medical reports.
"""
import io
import re
import os
import tempfile
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# ── Field validation ranges (matching prediction_schema.py) ──────────────────
FIELD_RANGES = {
    "age":                    (1.0,   110.0),
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

GENDER_MAP = {"male": "Male", "female": "Female", "m": "Male", "f": "Female"}
PATIENT_GROUP_MAP = {"urban": "Urban", "rural": "Rural", "semi-urban": "Semi-Urban", "semiurban": "Semi-Urban"}
FAMILY_HISTORY_YES = {"yes", "positive", "present", "1", "true", "यस", "हाँ"}
FAMILY_HISTORY_NO  = {"no", "negative", "absent", "0", "false", "none", "नहीं", "नहि"}


# ─────────────────────────────────────────────────────────────────────────────
# TEXT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Try pdfplumber first, fall back to PyMuPDF."""
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        if text.strip():
            logger.info("PDF text extracted via pdfplumber (%d chars)", len(text))
            return text
    except Exception as exc:
        logger.warning("pdfplumber failed: %s", exc)

    # PyMuPDF fallback
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        if text.strip():
            logger.info("PDF text extracted via PyMuPDF (%d chars)", len(text))
            return text
    except Exception as exc:
        logger.warning("PyMuPDF fallback also failed: %s", exc)

    return text


def _extract_text_from_image_bytes(file_bytes: bytes, content_type: str) -> str:
    """OCR an image using pytesseract."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(img, lang="eng")
        logger.info("Image OCR completed (%d chars)", len(text))
        return text
    except Exception as exc:
        logger.warning("pytesseract OCR failed: %s", exc)
        return ""


def _pdf_needs_ocr(text: str) -> bool:
    """Returns True if extracted text looks like a scanned/empty PDF."""
    return len(text.strip()) < 50


def _ocr_pdf_pages(file_bytes: bytes) -> str:
    """Rasterise PDF pages and OCR them."""
    text = ""
    try:
        import fitz
        import pytesseract
        from PIL import Image
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text += pytesseract.image_to_string(img, lang="eng") + "\n"
        doc.close()
        logger.info("PDF OCR completed (%d chars)", len(text))
    except Exception as exc:
        logger.warning("PDF OCR failed: %s", exc)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# MEDICAL FIELD EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _parse_float(s: str) -> Optional[float]:
    try:
        return float(re.sub(r"[^\d.]", "", s))
    except (ValueError, TypeError):
        return None


def _confidence(value: Optional[float], field: str) -> str:
    if value is None:
        return "LOW"
    lo, hi = FIELD_RANGES.get(field, (None, None))
    if lo is None:
        return "HIGH"
    if lo <= value <= hi:
        return "HIGH"
    # Allow ±10% outside range → MEDIUM
    if (lo * 0.9) <= value <= (hi * 1.1):
        return "MEDIUM"
    return "LOW"


# Pattern registry: each entry → (field_key, regex, transform)
# We prefer patterns with explicit labels (HIGH confidence).
_PATTERNS = [
    # Fasting Glucose
    ("fasting_glucose",  r"fasting\s*(?:blood\s*)?(?:glucose|sugar)[:\s]+(\d+(?:\.\d+)?)\s*(?:mg[/\s]?dl)?", None),
    ("fasting_glucose",  r"fbg[:\s]+(\d+(?:\.\d+)?)\s*(?:mg[/\s]?dl)?", None),
    ("fasting_glucose",  r"fbs[:\s]+(\d+(?:\.\d+)?)\s*(?:mg[/\s]?dl)?", None),
    ("fasting_glucose",  r"glucose[:\s]+(\d+(?:\.\d+)?)\s*(?:mg[/\s]?dl)?", None),
    # HbA1c
    ("hba1c",  r"hba1c[:\s]+(\d+(?:\.\d+)?)\s*%?", None),
    ("hba1c",  r"glycated\s+haemoglobin[:\s]+(\d+(?:\.\d+)?)\s*%?", None),
    ("hba1c",  r"glycosylated\s+hemoglobin[:\s]+(\d+(?:\.\d+)?)\s*%?", None),
    ("hba1c",  r"a1c[:\s]+(\d+(?:\.\d+)?)\s*%?", None),
    # Blood Pressure (systolic only)
    ("blood_pressure",   r"blood\s*pressure[:\s]+(\d+)\s*/\s*\d+\s*(?:mmhg)?", None),
    ("blood_pressure",   r"bp[:\s]+(\d+)\s*/\s*\d+\s*(?:mmhg)?", None),
    ("blood_pressure",   r"systolic[:\s]+(\d+)\s*(?:mmhg)?", None),
    # BMI
    ("bmi",  r"bmi[:\s]+(\d+(?:\.\d+)?)\s*(?:kg[/\s]?m[\u00b2²2]?)?", None),
    ("bmi",  r"body\s+mass\s+index[:\s]+(\d+(?:\.\d+)?)", None),
    # Age
    ("age",  r"\bage[:\s]+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)?", None),
    # Sleep
    ("sleep_hours",  r"sleep[:\s]+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", None),
    ("sleep_hours",  r"sleep\s+duration[:\s]+(\d+(?:\.\d+)?)", None),
    # Physical Activity
    ("physical_activity_hours",  r"physical\s*activity[:\s]+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", None),
    ("physical_activity_hours",  r"exercise[:\s]+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", None),
    # Sugar intake
    ("daily_sugar_intake",  r"sugar\s*intake[:\s]+(\d+(?:\.\d+)?)\s*(?:g(?:rams?)?)?", None),
    # Fast food frequency
    ("fast_food_frequency",  r"fast\s*food[:\s]+(\d+(?:\.\d+)?)\s*(?:times?|meals?)?(?:\s*per\s*week)?", None),
    # Monthly Income
    ("monthly_income",  r"monthly\s*income[:\s]+(\d+(?:\.\d+)?)", None),
    ("monthly_income",  r"income[:\s]+(?:rs\.?|inr\.?|₹)?\s*(\d+(?:\.\d+)?)", None),
]

_GENDER_PATTERN   = re.compile(r"\bgender[:\s]+(\w+)", re.IGNORECASE)
_GENDER_PATTERN2  = re.compile(r"\bsex[:\s]+(\w+)", re.IGNORECASE)
_FH_PATTERN       = re.compile(
    r"family\s*history(?:\s*of\s*diabetes)?[:\s]+(\w[\w\s-]*?)(?:\n|$)",
    re.IGNORECASE
)
_PG_PATTERN       = re.compile(r"\b(urban|rural|semi-urban|semiurban)\b", re.IGNORECASE)


def _extract_fields(text: str) -> Dict[str, Dict[str, Any]]:
    """
    Returns dict of { field_name: { value, confidence, raw } }
    Only fields actually found in the text are returned.
    """
    lower = text.lower()
    results: Dict[str, Dict[str, Any]] = {}

    for field, pattern, transform in _PATTERNS:
        if field in results:          # already captured with higher-priority pattern
            continue
        m = re.search(pattern, lower, re.IGNORECASE)
        if m:
            raw = m.group(1)
            value = _parse_float(raw) if transform is None else transform(raw)
            if value is not None:
                conf = _confidence(value, field)
                if conf != "LOW":
                    results[field] = {"value": value, "confidence": conf, "raw": m.group(0)}

    # Gender
    for pat in (_GENDER_PATTERN, _GENDER_PATTERN2):
        gm = pat.search(text)
        if gm:
            gval = GENDER_MAP.get(gm.group(1).strip().lower())
            if gval:
                results["gender"] = {"value": gval, "confidence": "HIGH", "raw": gm.group(0)}
            break

    # Family History
    fhm = _FH_PATTERN.search(text)
    if fhm:
        answer = fhm.group(1).strip().lower()
        if any(k in answer for k in FAMILY_HISTORY_YES):
            results["family_history"] = {"value": 1.0, "confidence": "HIGH", "raw": fhm.group(0)}
        elif any(k in answer for k in FAMILY_HISTORY_NO):
            results["family_history"] = {"value": 0.0, "confidence": "HIGH", "raw": fhm.group(0)}

    # Patient Group
    pgm = _PG_PATTERN.search(text)
    if pgm:
        pgval = PATIENT_GROUP_MAP.get(pgm.group(1).strip().lower(), "Urban")
        results["patient_group"] = {"value": pgval, "confidence": "MEDIUM", "raw": pgm.group(0)}

    return results


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def extract_from_report(file_bytes: bytes, filename: str, content_type: str) -> Dict[str, Any]:
    """
    Main entry point. Returns:
    {
        "success": bool,
        "source_type": "pdf_text" | "pdf_ocr" | "image_ocr",
        "raw_text_preview": str,          # first 500 chars of extracted text
        "extracted_fields": {
            field_name: { "value": ..., "confidence": "HIGH"|"MEDIUM", "raw": "..." }
        },
        "error": str | None
    }
    """
    fn_lower = filename.lower()
    ct_lower = (content_type or "").lower()

    try:
        if fn_lower.endswith(".pdf") or "pdf" in ct_lower:
            text = _extract_text_from_pdf(file_bytes)
            source_type = "pdf_text"
            if _pdf_needs_ocr(text):
                text = _ocr_pdf_pages(file_bytes)
                source_type = "pdf_ocr"
        else:
            # image
            text = _extract_text_from_image_bytes(file_bytes, content_type)
            source_type = "image_ocr"

        if not text.strip():
            return {
                "success": False,
                "source_type": source_type,
                "raw_text_preview": "",
                "extracted_fields": {},
                "error": "Could not read any text from this document. Please enter values manually.",
            }

        fields = _extract_fields(text)
        return {
            "success": True,
            "source_type": source_type,
            "raw_text_preview": text[:500],
            "extracted_fields": fields,
            "error": None,
        }

    except Exception as exc:
        logger.error("Report extraction error: %s", exc, exc_info=True)
        return {
            "success": False,
            "source_type": "unknown",
            "raw_text_preview": "",
            "extracted_fields": {},
            "error": "An unexpected error occurred while processing your report. Please try again.",
        }
