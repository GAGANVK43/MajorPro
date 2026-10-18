import pytest
from app.utils.i18n import (
    localize_contributing_factors,
    localize_recommendation,
    normalize_lang,
    SUPPORTED_LANGUAGES,
    FACTOR_NAMES,
    IMPACT_LABELS,
)


def test_normalize_lang():
    assert normalize_lang("en-US,en;q=0.9") == "en"
    assert normalize_lang("kn-IN") == "kn"
    assert normalize_lang("Kannada") == "kn"
    assert normalize_lang("hi-IN") == "hi"
    assert normalize_lang("Hindi") == "hi"
    assert normalize_lang("ta-IN") == "ta"
    assert normalize_lang("te-IN") == "te"
    assert normalize_lang("ml-IN") == "ml"
    assert normalize_lang("fr-FR") == "en"


def test_contributing_factors_localization_all_languages():
    raw_factors = [
        {
            "factor": "Fasting Glucose",
            "value": "130 mg/dL",
            "impact": "High Risk",
            "description": "Fasting glucose >= 126 mg/dL indicates elevated fasting blood sugar. A confirmatory laboratory test and medical evaluation are strongly recommended.",
        },
        {
            "factor": "HbA1c",
            "value": "6.8%",
            "impact": "High Risk",
            "description": "HbA1c >= 6.5% is consistent with elevated long-term blood sugar levels. This warrants prompt medical consultation.",
        },
        {
            "factor": "Physical Activity",
            "value": "5.0 hrs/day",
            "impact": "Good",
            "description": "Good physical activity level. Keep it up!",
        },
    ]

    for lang in SUPPORTED_LANGUAGES:
        loc = localize_contributing_factors(raw_factors, lang=lang)
        assert len(loc) == 3
        for item in loc:
            assert item["factor"]
            assert item["impact"]
            assert item["description"]
            assert item["value"]

        if lang != "en":
            # Verify translation happened
            assert loc[0]["factor"] != "Fasting Glucose"
            assert loc[2]["impact"] != "Good"


def test_recommendation_localization_all_languages():
    for lang in SUPPORTED_LANGUAGES:
        rec_diabetic = localize_recommendation("Diabetic", lang=lang)
        rec_non = localize_recommendation("Non-Diabetic", lang=lang)
        assert len(rec_diabetic) > 20
        assert len(rec_non) > 20
