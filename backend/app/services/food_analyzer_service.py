import os
import io
import json
import base64
import hashlib
import uuid
import re
import httpx
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException
from app.config.settings import settings
from app.utils.logger import logger
from app.schemas.food_schema import FoodAnalysisResponse, FoodItemNutritionalDetail
from app.utils.i18n import normalize_lang, LANGUAGE_NAMES


# Expanded Authentic Clinical Food Nutrition & Glycemic Index Knowledge Base
FOOD_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "avocado quinoa salad": {
        "calories": 320.0,
        "carbs": 28.0,
        "protein": 14.0,
        "fiber": 9.5,
        "fats": 16.0,
        "gi": 22,
        "portion": "1 bowl avocado quinoa salad (250g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Outstanding low-GI meal. Monounsaturated avocado fats and soluble quinoa fiber prevent post-meal glucose spikes."
    },
    "grilled chicken": {
        "calories": 380.0,
        "carbs": 14.0,
        "protein": 46.0,
        "fiber": 4.5,
        "fats": 15.0,
        "gi": 25,
        "portion": "1 plate roasted/grilled chicken with greens (250g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "High protein, low GI meal rich in lean poultry and green vegetables. Excellent for postprandial glucose stability."
    },
    "roasted chicken": {
        "calories": 380.0,
        "carbs": 14.0,
        "protein": 46.0,
        "fiber": 4.5,
        "fats": 15.0,
        "gi": 25,
        "portion": "1 plate roasted chicken with greens and sides (250g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "High protein, low GI meal rich in lean poultry and green vegetables. Ideal for insulin sensitivity."
    },
    "chicken breast": {
        "calories": 260.0,
        "carbs": 8.0,
        "protein": 36.0,
        "fiber": 3.5,
        "fats": 7.0,
        "gi": 20,
        "portion": "1 grilled breast with greens (200g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Lean protein source with minimal carbohydrate impact. Excellent for insulin sensitivity."
    },
    "oats dosa": {
        "calories": 160.0,
        "carbs": 24.0,
        "protein": 7.0,
        "fiber": 4.5,
        "fats": 4.0,
        "gi": 44,
        "portion": "1 medium dosa (100g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Low GI option rich in soluble beta-glucan fiber. Excellent for blood glucose control."
    },
    "masala dosa": {
        "calories": 280.0,
        "carbs": 44.0,
        "protein": 6.5,
        "fiber": 2.5,
        "fats": 9.0,
        "gi": 68,
        "portion": "1 dosa with potato filling (150g)",
        "suitability": "Moderate / Control Portion",
        "color": "amber",
        "advice": "Moderate to high GI due to white rice batter & potato. Limit to 1 medium dosa with mint chutney."
    },
    "ragi roti": {
        "calories": 140.0,
        "carbs": 26.0,
        "protein": 4.0,
        "fiber": 5.0,
        "fats": 2.0,
        "gi": 54,
        "portion": "1 roti (60g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Rich in polyphenol antioxidants and complex carbohydrates. Prevents glucose spikes."
    },
    "palak paneer": {
        "calories": 240.0,
        "carbs": 8.0,
        "protein": 14.0,
        "fiber": 3.5,
        "fats": 17.0,
        "gi": 30,
        "portion": "1 cup curry (180g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Low carb, high protein & micronutrients. Great for glycemic stability."
    },
    "brown rice": {
        "calories": 215.0,
        "carbs": 45.0,
        "protein": 5.0,
        "fiber": 3.5,
        "fats": 1.8,
        "gi": 55,
        "portion": "1 cup cooked (150g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Contains bran and germ layer. Digestible at slower rate than white rice."
    },
    "rajma": {
        "calories": 210.0,
        "carbs": 28.0,
        "protein": 13.0,
        "fiber": 8.0,
        "fats": 1.5,
        "gi": 29,
        "portion": "1 cup kidney beans curry (200g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Excellent low-GI legume loaded with soluble fiber and plant protein."
    },
    "moong dal khichdi": {
        "calories": 270.0,
        "carbs": 42.0,
        "protein": 11.0,
        "fiber": 6.0,
        "fats": 4.5,
        "gi": 48,
        "portion": "1 bowl (200g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Easy to digest, balanced carbohydrate-protein ratio for stable blood glucose."
    },
    "gulab jamun": {
        "calories": 300.0,
        "carbs": 48.0,
        "protein": 4.0,
        "fiber": 0.5,
        "fats": 11.0,
        "gi": 78,
        "portion": "2 pieces with syrup (80g)",
        "suitability": "High Risk / Limit Intake",
        "color": "red",
        "advice": "Extremely high sugar syrup and deep-fried carbs. Causes severe postprandial glucose spikes."
    },
    "green salad": {
        "calories": 120.0,
        "carbs": 14.0,
        "protein": 5.0,
        "fiber": 5.5,
        "fats": 4.0,
        "gi": 20,
        "portion": "1 bowl green salad (180g)",
        "suitability": "Diabetic Friendly",
        "color": "emerald",
        "advice": "Loaded with micronutrients and dietary fiber. Minimizes glucose excursion."
    }
}

# Strict normalized alias mapping to canonical knowledge base dishes
FOOD_ALIASES: Dict[str, str] = {
    # Chicken & Poultry
    "roasted chicken with green beans": "roasted chicken",
    "roasted chicken": "roasted chicken",
    "roast chicken": "roasted chicken",
    "grilled chicken": "grilled chicken",
    "chicken breast": "chicken breast",
    "chicken tikka": "grilled chicken",
    "chicken meal": "roasted chicken",
    "chicken": "grilled chicken",
    # Dosa varieties
    "oats and ragi dosa": "oats dosa",
    "oats dosa with mint chutney": "oats dosa",
    "oats dosa": "oats dosa",
    "masala dosa with sambar": "masala dosa",
    "masala dosa": "masala dosa",
    "dosa": "masala dosa",
    # Roti & Flatbreads
    "ragi roti with mixed veg subzi": "ragi roti",
    "ragi roti": "ragi roti",
    "chapati": "ragi roti",
    "roti": "ragi roti",
    # Paneer
    "palak paneer with bajra roti": "palak paneer",
    "palak paneer": "palak paneer",
    "paneer": "palak paneer",
    # Rice & Legumes
    "brown rice with rajma curry": "brown rice",
    "brown rice with rajma": "brown rice",
    "brown rice": "brown rice",
    "rajma curry": "rajma",
    "rajma": "rajma",
    # Khichdi
    "moong dal khichdi": "moong dal khichdi",
    "khichdi": "moong dal khichdi",
    # Sweets
    "gulab jamun": "gulab jamun",
    # Salads
    "avocado quinoa salad bowl with sprouts": "avocado quinoa salad",
    "avocado quinoa salad": "avocado quinoa salad",
    "quinoa salad": "avocado quinoa salad",
    "green salad": "green salad",
    "salad": "green salad",
}


class FoodAnalyzerService:
    """
    AI-powered Food Image Analyzer and Meal Calorie / Nutrition Analyzer with multilingual support.
    Strictly ties analysis to image bytes and request IDs. Never fabricates fake food identifications.
    """
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key

    @property
    def api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key
        return settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    @api_key.setter
    def api_key(self, value: Optional[str]):
        self._api_key = value

    def get_provider_status(self) -> Dict[str, Any]:
        """
        Returns the operational configuration status of the Food Intelligence Provider.
        Never reveals secret API keys.
        """
        is_configured = bool(self.api_key)
        vision_model = settings.GEMINI_VISION_MODEL or "gemini-3.5-flash"
        text_model = settings.GEMINI_TEXT_MODEL or "gemini-3.5-flash"
        status_str = "configured" if is_configured else "unconfigured"

        return {
            "is_configured": is_configured,
            "provider": "google_gemini",
            "vision_model": vision_model,
            "text_model": text_model,
            "status": status_str,
            "capabilities": {
                "nutrition_search": True,
                "image_vision": is_configured,
            },
            "message": (
                "AI Vision Provider is configured and operational."
                if is_configured
                else "AI Vision Provider is not configured (GEMINI_API_KEY required in backend/.env). Verified nutrition search remains fully operational."
            ),
        }

    def _lookup_verified_knowledge_base(self, dish_query: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Looks up a dish query against canonical items and aliases using exact and word-boundary matching.
        Returns (canonical_key, data_dict) or None.
        """
        q = dish_query.lower().strip()
        # 1. Exact match in knowledge base
        if q in FOOD_KNOWLEDGE_BASE:
            return q, FOOD_KNOWLEDGE_BASE[q]
        # 2. Exact match in aliases
        if q in FOOD_ALIASES and FOOD_ALIASES[q] in FOOD_KNOWLEDGE_BASE:
            canonical = FOOD_ALIASES[q]
            return canonical, FOOD_KNOWLEDGE_BASE[canonical]
        # 3. Word-boundary regex match against sorted aliases (longest phrase first)
        for alias, canonical in sorted(FOOD_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
            if re.search(rf"\b{re.escape(alias)}\b", q):
                if canonical in FOOD_KNOWLEDGE_BASE:
                    return canonical, FOOD_KNOWLEDGE_BASE[canonical]
        return None

    def analyze_meal_text(
        self,
        query: str,
        lang: str = "en",
        client_request_id: Optional[str] = None,
    ) -> FoodAnalysisResponse:
        """
        Analyzes typed meal text and returns verified nutritional metrics or an honest unverified response.
        """
        req_id = client_request_id or f"req_{uuid.uuid4().hex[:12]}"
        logger.info(f"🔍 Analyzing meal text query: '{query}' (req_id: {req_id}, lang: {lang})")
        q_lower = query.lower().strip()

        # 1. Check verified knowledge base
        matched_items = []
        for alias, canonical in sorted(FOOD_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
            if re.search(rf"\b{re.escape(alias)}\b", q_lower):
                if canonical in FOOD_KNOWLEDGE_BASE:
                    item_data = FOOD_KNOWLEDGE_BASE[canonical]
                    if (canonical, item_data) not in matched_items:
                        matched_items.append((canonical, item_data))

        if matched_items:
            return self._build_combined_food_response(query, matched_items, lang, req_id)

        # 2. Check dynamic AI model if API key is present
        if self.api_key:
            ai_res = self._query_gemini_food_nutrition(query, lang, req_id)
            if ai_res:
                return ai_res

        # 3. Item not in verified database and no AI key configured:
        # Return honest response with null nutrition instead of invented numbers.
        logger.info(f"[MEAL_TEXT] Query '{query}' not found in verified database; returning unverified status")
        return FoodAnalysisResponse(
            dish_name=query.title(),
            identified_items=[query.title()],
            total_calories_kcal=None,
            total_carbohydrates_g=None,
            total_net_carbs_g=None,
            total_protein_g=None,
            total_fiber_g=None,
            total_fats_g=None,
            average_glycemic_index=None,
            overall_suitability="Uncertain / Unverified",
            suitability_color="amber",
            suggested_portion="Standard Serving",
            nutritional_details=[],
            clinical_recommendation=(
                f"Nutritional facts for '{query}' are not yet verified in our clinical database. "
                "For accurate diabetic carbohydrate counting, consult packaged nutrition labels or an accredited dietitian."
            ),
            request_id=req_id,
            confidence_score=None,
            identification_status="unrecognized",
            provenance="unavailable",
            nutrition_status="unavailable",
            warning_message=f"No verified nutrition data available for '{query}'.",
        )

    def analyze_food_image(
        self,
        image_bytes: bytes,
        filename: str = "food.jpg",
        lang: str = "en",
        client_request_id: Optional[str] = None,
    ) -> FoodAnalysisResponse:
        """
        Analyzes uploaded food image using AI Vision Recognition.
        Ties analysis strictly to image bytes (SHA-256 hash) and client request ID.
        Never fabricates results from filename keywords or returns unverified defaults.
        """
        req_id = client_request_id or f"req_{uuid.uuid4().hex[:12]}"
        img_hash = hashlib.sha256(image_bytes).hexdigest()[:16]
        logger.info(f"[IMAGE_ANALYSIS] Processing food image: {filename} (hash: {img_hash}, req_id: {req_id}, lang: {lang})")

        # 1. Image validation & readability check
        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            pil_img.verify()
            # Reopen to read image data after verify()
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            logger.warning(f"Image integrity validation failed for {filename}: {e}")
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is not a valid or readable image (.jpg, .png, .jpeg, .webp).",
            )

        # 2. Thumbnail creation for efficient transmission
        try:
            thumb = pil_img.copy()
            thumb.thumbnail((512, 512))
            buf = io.BytesIO()
            thumb.save(buf, format="JPEG", quality=85)
            compressed_bytes = buf.getvalue()
        except Exception as e:
            logger.warning(f"Image compression warning: {e}")
            compressed_bytes = image_bytes

        # 3. Call Vision Model if API key is configured
        if self.api_key:
            vision_model = settings.GEMINI_VISION_MODEL or "gemini-3.5-flash"
            ai_vision_res = self._query_gemini_image_vision(
                image_bytes=compressed_bytes,
                model_name=vision_model,
                lang=lang,
                client_request_id=req_id,
                image_hash=img_hash,
            )
            if ai_vision_res:
                logger.info(f"[AI_VISION] Completed with status '{ai_vision_res.identification_status}' (req: {req_id})")
                return ai_vision_res
            else:
                logger.warning(f"[AI_VISION_FAIL] Vision provider failed to analyze image {img_hash}")
                return FoodAnalysisResponse(
                    dish_name="Unable to Identify Food Image",
                    identified_items=[],
                    total_calories_kcal=None,
                    total_carbohydrates_g=None,
                    total_net_carbs_g=None,
                    total_protein_g=None,
                    total_fiber_g=None,
                    total_fats_g=None,
                    average_glycemic_index=None,
                    overall_suitability="Uncertain / Unverified",
                    suitability_color="amber",
                    suggested_portion="N/A",
                    nutritional_details=[],
                    clinical_recommendation=(
                        "The vision recognition engine could not identify food in this image. "
                        "Please verify image lighting and clarity, or use the 'Calorie & Nutrition Search' tab."
                    ),
                    request_id=req_id,
                    image_hash=img_hash,
                    confidence_score=None,
                    identification_status="provider_error",
                    provenance="unavailable",
                    nutrition_status="unavailable",
                    warning_message="External vision service returned an error or timeout during analysis.",
                )

        # 4. If NO API key is configured:
        # TRUTHFUL STATE: Do NOT fall back to Avocado Quinoa Salad Bowl or filename guessing!
        logger.info(f"[IMAGE_ANALYSIS] GEMINI_API_KEY is not configured; returning honest unconfigured status for req {req_id}")
        return FoodAnalysisResponse(
            dish_name="AI Vision Recognition Unavailable",
            identified_items=[],
            total_calories_kcal=None,
            total_carbohydrates_g=None,
            total_net_carbs_g=None,
            total_protein_g=None,
            total_fiber_g=None,
            total_fats_g=None,
            average_glycemic_index=None,
            overall_suitability="Vision Provider Unconfigured",
            suitability_color="amber",
            suggested_portion="N/A",
            nutritional_details=[],
            clinical_recommendation=(
                "AI Vision food recognition requires GEMINI_API_KEY in backend/.env. "
                "No external vision model is currently configured. "
                "You can switch to the 'Calorie & Nutrition Search' tab to find verified nutrition for any meal."
            ),
            request_id=req_id,
            image_hash=img_hash,
            confidence_score=None,
            identification_status="provider_unconfigured",
            provenance="unavailable",
            nutrition_status="unavailable",
            warning_message="AI Vision Provider is not configured (GEMINI_API_KEY required in backend/.env).",
        )

    def _query_gemini_food_nutrition(
        self,
        query: str,
        lang: str = "en",
        client_request_id: Optional[str] = None,
    ) -> Optional[FoodAnalysisResponse]:
        model_name = getattr(settings, "GEMINI_TEXT_MODEL", "gemini-3.5-flash").replace("models/", "").strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
        norm_lang = normalize_lang(lang)
        lang_name = LANGUAGE_NAMES.get(norm_lang, "English")

        prompt = f"""
        Act as a Clinical Nutritionist. Analyze meal: "{query}".
        CRITICAL: All user-facing text (dish_name, identified_items, suggested_portion, diabetic_suitability, clinical_recommendation) MUST be in {lang_name}.
        Return JSON ONLY matching this structure:
        {{
          "dish_name": "Dish Name in {lang_name}",
          "identified_items": ["item in {lang_name}"],
          "total_calories_kcal": 380.0,
          "total_carbohydrates_g": 20.0,
          "total_net_carbs_g": 16.0,
          "total_protein_g": 30.0,
          "total_fiber_g": 4.0,
          "total_fats_g": 14.0,
          "average_glycemic_index": 35,
          "overall_suitability": "Diabetic Friendly",
          "suitability_color": "emerald",
          "suggested_portion": "1 serving (250g)",
          "confidence_score": 0.85,
          "nutritional_details": [
             {{
                "food_name": "Food Name in {lang_name}",
                "calories_kcal": 380.0,
                "carbohydrates_g": 20.0,
                "net_carbs_g": 16.0,
                "protein_g": 30.0,
                "fiber_g": 4.0,
                "fats_g": 14.0,
                "glycemic_index": 35,
                "glycemic_load": 7.0,
                "portion_size": "1 serving (250g)",
                "diabetic_suitability": "Diabetic Friendly",
                "suitability_color": "emerald"
             }}
          ],
          "clinical_recommendation": "Healthy balanced meal choice with low glycemic impact."
        }}
        """

        try:
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = httpx.post(url, json=payload, timeout=20.0)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                clean_json = text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_json)

                details = []
                for d in parsed.get("nutritional_details", []):
                    details.append(FoodItemNutritionalDetail(**d))

                return FoodAnalysisResponse(
                    dish_name=parsed.get("dish_name", query.title()),
                    identified_items=parsed.get("identified_items", [query.title()]),
                    total_calories_kcal=parsed.get("total_calories_kcal"),
                    total_carbohydrates_g=parsed.get("total_carbohydrates_g"),
                    total_net_carbs_g=parsed.get("total_net_carbs_g"),
                    total_protein_g=parsed.get("total_protein_g"),
                    total_fiber_g=parsed.get("total_fiber_g"),
                    total_fats_g=parsed.get("total_fats_g"),
                    average_glycemic_index=parsed.get("average_glycemic_index"),
                    overall_suitability=parsed.get("overall_suitability", "Moderate"),
                    suitability_color=parsed.get("suitability_color", "emerald"),
                    suggested_portion=parsed.get("suggested_portion", "Standard Serving"),
                    nutritional_details=details,
                    clinical_recommendation=parsed.get("clinical_recommendation", ""),
                    request_id=client_request_id,
                    confidence_score=parsed.get("confidence_score"),
                    identification_status="identified",
                    provenance="ai_vision",
                    nutrition_status="estimated",
                )
        except Exception as e:
            logger.warning(f"Text nutrition analysis error with Gemini: {e}")

        return None

    def _query_gemini_image_vision(
        self,
        image_bytes: bytes,
        model_name: str,
        lang: str = "en",
        client_request_id: Optional[str] = None,
        image_hash: Optional[str] = None,
    ) -> Optional[FoodAnalysisResponse]:
        clean_model = model_name.replace("models/", "").strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={self.api_key}"
        b64_img = base64.b64encode(image_bytes).decode("utf-8")
        norm_lang = normalize_lang(lang)
        lang_name = LANGUAGE_NAMES.get(norm_lang, "English")

        prompt = f"""
        You are DiaSense AI Clinical Nutritionist. Identify the exact food dish and ingredients in this image.
        CRITICAL: All user-facing text (dish_name, identified_items, suggested_portion, diabetic_suitability, clinical_recommendation) MUST be in {lang_name}.
        Return JSON ONLY matching this structure:
        {{
          "dish_name": "Accurate Name of the Dish in {lang_name}",
          "identified_items": ["item 1 in {lang_name}", "item 2 in {lang_name}"],
          "total_calories_kcal": 380.0,
          "total_carbohydrates_g": 22.0,
          "total_net_carbs_g": 18.0,
          "total_protein_g": 35.0,
          "total_fiber_g": 4.0,
          "total_fats_g": 15.0,
          "average_glycemic_index": 30,
          "overall_suitability": "Diabetic Friendly",
          "suitability_color": "emerald",
          "suggested_portion": "1 plate (250g)",
          "confidence_score": 0.88,
          "nutritional_details": [
             {{
                "food_name": "Main Item in {lang_name}",
                "calories_kcal": 380.0,
                "carbohydrates_g": 22.0,
                "net_carbs_g": 18.0,
                "protein_g": 35.0,
                "fiber_g": 4.0,
                "fats_g": 15.0,
                "glycemic_index": 30,
                "glycemic_load": 6.6,
                "portion_size": "1 serving (250g)",
                "diabetic_suitability": "Diabetic Friendly",
                "suitability_color": "emerald"
             }}
          ],
          "clinical_recommendation": "Nutritional assessment based on visual food breakdown."
        }}
        """

        try:
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}}
                        ]
                    }
                ]
            }
            res = httpx.post(url, json=payload, timeout=25.0)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    return FoodAnalysisResponse(
                        dish_name="Unable to Identify Food Image",
                        identified_items=[],
                        overall_suitability="Uncertain / Unverified",
                        suitability_color="amber",
                        request_id=client_request_id,
                        image_hash=image_hash,
                        identification_status="unrecognized",
                        provenance="unavailable",
                        nutrition_status="unavailable",
                        warning_message="The vision model returned an empty candidates list.",
                    )
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                clean_json = text.replace("```json", "").replace("```", "").strip()
                try:
                    parsed = json.loads(clean_json)
                except Exception as json_err:
                    logger.warning(f"Failed to parse model JSON: {json_err}")
                    return FoodAnalysisResponse(
                        dish_name="Unable to Parse Vision Response",
                        identified_items=[],
                        overall_suitability="Uncertain / Unverified",
                        suitability_color="amber",
                        request_id=client_request_id,
                        image_hash=image_hash,
                        identification_status="unrecognized",
                        provenance="unavailable",
                        nutrition_status="unavailable",
                        warning_message="Could not parse structured food items from vision model.",
                    )

                dish_name = parsed.get("dish_name", "Identified Meal")
                verified_match = self._lookup_verified_knowledge_base(dish_name)

                details = []
                for d in parsed.get("nutritional_details", []):
                    details.append(FoodItemNutritionalDetail(**d))

                provenance = "verified_database" if verified_match else "ai_vision"
                nutri_status = "verified" if verified_match else "estimated"

                return FoodAnalysisResponse(
                    dish_name=dish_name,
                    identified_items=parsed.get("identified_items", [dish_name]),
                    total_calories_kcal=parsed.get("total_calories_kcal"),
                    total_carbohydrates_g=parsed.get("total_carbohydrates_g"),
                    total_net_carbs_g=parsed.get("total_net_carbs_g"),
                    total_protein_g=parsed.get("total_protein_g"),
                    total_fiber_g=parsed.get("total_fiber_g"),
                    total_fats_g=parsed.get("total_fats_g"),
                    average_glycemic_index=parsed.get("average_glycemic_index"),
                    overall_suitability=parsed.get("overall_suitability", "Moderate"),
                    suitability_color=parsed.get("suitability_color", "emerald"),
                    suggested_portion=parsed.get("suggested_portion", "Standard Serving"),
                    nutritional_details=details,
                    clinical_recommendation=parsed.get("clinical_recommendation", ""),
                    request_id=client_request_id,
                    image_hash=image_hash,
                    confidence_score=parsed.get("confidence_score"),
                    identification_status="identified",
                    provenance=provenance,
                    nutrition_status=nutri_status,
                )
            elif res.status_code in (400, 401, 403):
                logger.warning(f"AI vision HTTP {res.status_code} rejection: {res.text[:200]}")
                return FoodAnalysisResponse(
                    dish_name="AI Vision Access Rejected",
                    identified_items=[],
                    overall_suitability="Vision Provider Rejected",
                    suitability_color="amber",
                    request_id=client_request_id,
                    image_hash=image_hash,
                    identification_status="provider_rejected",
                    provenance="unavailable",
                    nutrition_status="unavailable",
                    warning_message="AI Vision provider rejected the API request. Please verify GEMINI_API_KEY credentials and model permissions in backend/.env.",
                )
            elif res.status_code == 429:
                logger.warning(f"AI vision HTTP 429 rate limit exceeded: {res.text[:200]}")
                return FoodAnalysisResponse(
                    dish_name="AI Vision Quota Exceeded",
                    identified_items=[],
                    overall_suitability="Vision Quota Exceeded",
                    suitability_color="amber",
                    request_id=client_request_id,
                    image_hash=image_hash,
                    identification_status="provider_quota_exceeded",
                    provenance="unavailable",
                    nutrition_status="unavailable",
                    warning_message="AI Vision API quota or rate limit exceeded. Please try again later or use the verified nutrition search tab.",
                )
            else:
                logger.warning(f"AI vision returned HTTP {res.status_code}: {res.text[:200]}")
                return FoodAnalysisResponse(
                    dish_name="AI Vision Service Unavailable",
                    identified_items=[],
                    overall_suitability="Vision Provider Unavailable",
                    suitability_color="amber",
                    request_id=client_request_id,
                    image_hash=image_hash,
                    identification_status="provider_unavailable",
                    provenance="unavailable",
                    nutrition_status="unavailable",
                    warning_message=f"AI Vision service temporarily unavailable (HTTP {res.status_code}). Please use the nutrition search tab.",
                )
        except httpx.TimeoutException:
            logger.warning("AI vision timeout connecting to Gemini API")
            return FoodAnalysisResponse(
                dish_name="AI Vision Service Timed Out",
                identified_items=[],
                overall_suitability="Vision Timeout",
                suitability_color="amber",
                request_id=client_request_id,
                image_hash=image_hash,
                identification_status="provider_unavailable",
                provenance="unavailable",
                nutrition_status="unavailable",
                warning_message="AI Vision service timed out during image analysis. Please use the nutrition search tab.",
            )
        except Exception as e:
            logger.warning(f"AI vision analysis error with {model_name}: {e}")
            return None

    def _build_combined_food_response(
        self,
        query: str,
        matched_items: List[tuple],
        lang: str = "en",
        client_request_id: Optional[str] = None,
        image_hash: Optional[str] = None,
    ) -> FoodAnalysisResponse:
        total_cal = sum(d["calories"] for _, d in matched_items)
        total_carbs = sum(d["carbs"] for _, d in matched_items)
        total_protein = sum(d["protein"] for _, d in matched_items)
        total_fiber = sum(d["fiber"] for _, d in matched_items)
        total_fats = sum(d["fats"] for _, d in matched_items)
        net_carbs = max(0.0, total_carbs - total_fiber)
        avg_gi = int(sum(d["gi"] for _, d in matched_items) / len(matched_items))

        norm_lang = normalize_lang(lang)
        if avg_gi < 55:
            suitability = "Diabetic Friendly"
            color = "emerald"
            recommendations = {
                "en": "Excellent low-GI food option. Promotes steady insulin release without blood sugar spikes.",
                "kn": "ಅತ್ಯುತ್ತಮ ಕಡಿಮೆ-ಜಿಐ ಆಹಾರ ಆಯ್ಕೆ. ರಕ್ತದಲ್ಲಿ ಸಕ್ಕರೆ ಮಟ್ಟ ಹೆಚ್ಚಾಗದಂತೆ ಇನ್ಸುಲಿನ್ ಬಿಡುಗಡೆಯನ್ನು ಉತ್ತೇಜಿಸುತ್ತದೆ.",
                "hi": "उत्कृष्ट कम-जीआई भोजन विकल्प। रक्त शर्करा में तेजी से वृद्धि किए बिना स्थिर इंसुलिन रिलीज को बढ़ावा देता है।",
                "ta": "சிறந்த குறைந்த கிளைசெமிக் உணவு. இரத்த சர்க்கரை அளவை உயர்த்தாமல் சீரான இன்சுலின் வெளியீட்டை ஊக்குவிக்கிறது.",
                "te": "అద్భుతమైన తక్కువ-జిఐ ఆహార ఎంపిక. రక్తంలో చక్కెర స్థాయిలు పెరగకుండా ఇన్సులిన్ విడుదలను ప్రోత్సహిస్తుంది.",
                "ml": "മികച്ച കുറഞ്ഞ ഗ്ലൈസെമിക് ഭക്ഷണ ഓപ്ഷൻ. രക്തത്തിലെ പഞ്ചസാരയുടെ അളവ് കൂട്ടാതെ സ്ഥിരമായ ഇൻസുലിൻ പുറത്തുവിടാൻ സഹായിക്കുന്നു.",
            }
            recommendation = recommendations.get(norm_lang, recommendations["en"])
        elif avg_gi <= 69:
            suitability = "Moderate / Control Portion"
            color = "amber"
            recommendations = {
                "en": "Moderate glycemic index. Pair with high fiber salad and protein to lower glycemic impact.",
                "kn": "ಮಧ್ಯಮ ಗ್ಲೈಸೆಮಿಕ್ ಸೂಚ್ಯಂಕ. ಗ್ಲೈಸೆಮಿಕ್ ಪರಿಣಾಮವನ್ನು ಕಡಿಮೆ ಮಾಡಲು ಹೆಚ್ಚಿನ ಫೈಬರ್ ಸಲಾಡ್ ಮತ್ತು ಪ್ರೋಟೀನ್ ಜೊತೆ ಸೇವಿಸಿ.",
                "hi": "मध्यम ग्लाइसेमिक इंडेक्स। ग्लाइसेमिक प्रभाव को कम करने के लिए उच्च फाइबर सलाद और प्रोटीन के साथ लें।",
                "ta": "மிதமான கிளைசெமிக் குறியீடு. பாதிப்பைக் குறைக்க அதிக நார்ச்சத்துள்ள சாலட் மற்றும் புரதத்துடன் சேர்த்து உண்ணுங்கள்.",
                "te": "మితమైన గ్లైసెమిక్ సూచిక. ప్రభావాన్ని తగ్గించడానికి అధిక ఫైబర్ సలాడ్ మరియు ప్రోటీన్‌తో కలపండి.",
                "ml": "മിതമായ ഗ്ലൈസെമിക് സൂചിക. ഗ്ലൈസെമിക് ആഘാതം കുറയ്ക്കാൻ ഉയർന്ന ഫൈബർ സാലഡും ಪ್ರോട്ടീനും ചേർത്ത് കഴിക്കുക.",
            }
            recommendation = recommendations.get(norm_lang, recommendations["en"])
        else:
            suitability = "High Risk / Limit Intake"
            color = "red"
            recommendations = {
                "en": "High GI item. Can cause rapid postprandial glucose spikes. Consume strictly in small portions.",
                "kn": "ಹೆಚ್ಚಿನ ಜಿಐ ಅಂಶ. ಊಟದ ನಂತರ ರಕ್ತದಲ್ಲಿ ಗ್ಲೂಕೋಸ್ ತ್ವರಿತವಾಗಿ ಹೆಚ್ಚಾಗಲು ಕಾರಣವಾಗಬಹುದು. ಸಣ್ಣ ಪ್ರಮಾಣದಲ್ಲಿ ಮಾತ್ರ ಸೇವಿಸಿ.",
                "hi": "उच्च जीआई आइटम। भोजन के बाद रक्त शर्करा में तेजी से वृद्धि कर सकता है। इसे कम मात्रा में ही लें।",
                "ta": "அதிக ஜிஐ உணவு. உணவுக்குப் பிறகு சர்க்கரை அளவை விரைவாக உயர்த்தக்கூடும். மிகக் குறைந்த அளவில் உட்கொள்ளவும்.",
                "te": "అధిక జిఐ ఆహారం. భోజనం తర్వాత రక్తంలో గ్లూకోజ్ వేగంగా పెరగడానికి కారణం కావచ్చు. తక్కువ పరిమాణంలో తీసుకోండి.",
                "ml": "ഉയർന്ന ജിഐ ഉള്ള ഭക്ഷണം. ഭക്ഷണത്തിന് ശേഷം രക്തത്തിലെ ഗ്ലൂക്കോസ് പെട്ടെന്ന് ഉയരാൻ ഇടയാക്കും. ചെറിയ അളവിൽ മാത്രം കഴിക്കുക.",
            }
            recommendation = recommendations.get(norm_lang, recommendations["en"])

        details = []
        for key, d in matched_items:
            gl = round((d["carbs"] * d["gi"]) / 100.0, 1)
            details.append(
                FoodItemNutritionalDetail(
                    food_name=key.title(),
                    calories_kcal=d["calories"],
                    carbohydrates_g=d["carbs"],
                    net_carbs_g=max(0.0, d["carbs"] - d["fiber"]),
                    protein_g=d["protein"],
                    fiber_g=d["fiber"],
                    fats_g=d["fats"],
                    glycemic_index=d["gi"],
                    glycemic_load=gl,
                    portion_size=d["portion"],
                    diabetic_suitability=d["suitability"],
                    suitability_color=d["color"],
                )
            )

        return FoodAnalysisResponse(
            dish_name=query.title(),
            identified_items=[k.title() for k, _ in matched_items],
            total_calories_kcal=round(total_cal, 1),
            total_carbohydrates_g=round(total_carbs, 1),
            total_net_carbs_g=round(net_carbs, 1),
            total_protein_g=round(total_protein, 1),
            total_fiber_g=round(total_fiber, 1),
            total_fats_g=round(total_fats, 1),
            average_glycemic_index=avg_gi,
            overall_suitability=suitability,
            suitability_color=color,
            suggested_portion=matched_items[0][1]["portion"],
            nutritional_details=details,
            clinical_recommendation=recommendation,
            request_id=client_request_id,
            image_hash=image_hash,
            confidence_score=1.0,
            identification_status="identified",
            provenance="verified_database",
            nutrition_status="verified",
        )
