from typing import List, Optional
from pydantic import BaseModel, Field


class FoodAnalysisRequest(BaseModel):
    query: str = Field(..., min_length=2, example="2 Masala Dosa with sambar")


class FoodItemNutritionalDetail(BaseModel):
    food_name: str
    calories_kcal: Optional[float] = None
    carbohydrates_g: Optional[float] = None
    net_carbs_g: Optional[float] = None
    protein_g: Optional[float] = None
    fiber_g: Optional[float] = None
    fats_g: Optional[float] = None
    glycemic_index: Optional[int] = None
    glycemic_load: Optional[float] = None
    portion_size: Optional[str] = None
    diabetic_suitability: Optional[str] = None  # "Diabetic Friendly", "Moderate / Control Portion", "High Risk / Limit", "Uncertain / Unverified"
    suitability_color: Optional[str] = "emerald"  # "emerald", "amber", "red"


class FoodAnalysisResponse(BaseModel):
    dish_name: str
    identified_items: List[str] = []
    total_calories_kcal: Optional[float] = None
    total_carbohydrates_g: Optional[float] = None
    total_net_carbs_g: Optional[float] = None
    total_protein_g: Optional[float] = None
    total_fiber_g: Optional[float] = None
    total_fats_g: Optional[float] = None
    average_glycemic_index: Optional[int] = None
    overall_suitability: Optional[str] = None
    suitability_color: Optional[str] = "emerald"
    suggested_portion: Optional[str] = None
    nutritional_details: List[FoodItemNutritionalDetail] = []
    clinical_recommendation: Optional[str] = None

    # Provenance, Status & Concurrency
    request_id: Optional[str] = None
    image_hash: Optional[str] = None
    confidence_score: Optional[float] = None
    identification_status: str = "identified"  # "identified", "uncertain", "unrecognized", "provider_unconfigured", "error"
    provenance: str = "verified_database"      # "ai_vision", "verified_database", "unverified_estimate", "unavailable"
    nutrition_status: str = "verified"         # "verified", "estimated", "unavailable"
    warning_message: Optional[str] = None
    disclaimer: str = (
        "Nutritional values and glycemic metrics are estimates for dietary awareness. "
        "They do not replace clinical lab testing or individualized medical advice."
    )
