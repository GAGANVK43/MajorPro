from typing import List, Optional
from pydantic import BaseModel, Field


class FoodAnalysisRequest(BaseModel):
    query: str = Field(..., min_length=2, example="2 Masala Dosa with sambar")


class FoodConfirmationRequest(BaseModel):
    dish_name: str = Field(..., min_length=2, example="Burger")


class FoodItemNutritionalDetail(BaseModel):
    food_name: str
    calories_kcal: float
    carbohydrates_g: float
    net_carbs_g: float
    protein_g: float
    fiber_g: float
    fats_g: float
    glycemic_index: int
    glycemic_load: float
    portion_size: str
    diabetic_suitability: str  # "Diabetic Friendly", "Moderate / Control Portion", "High Risk / Limit Intake"
    suitability_color: str    # "emerald", "amber", "red"


class FoodAnalysisResponse(BaseModel):
    status: str = "identified"  # "identified", "multiple_foods_detected", "needs_confirmation", "unrecognized", "invalid_image"
    dish_name: str
    identified_items: List[str] = Field(default_factory=list)
    total_calories_kcal: Optional[float] = None
    total_carbohydrates_g: Optional[float] = None
    total_net_carbs_g: Optional[float] = None
    total_protein_g: Optional[float] = None
    total_fiber_g: Optional[float] = None
    total_fats_g: Optional[float] = None
    average_glycemic_index: Optional[int] = None
    overall_suitability: str = "Moderate / Control Portion"
    suitability_color: str = "amber"  # "emerald", "amber", "red", "neutral"
    suggested_portion: Optional[str] = None
    nutritional_details: List[FoodItemNutritionalDetail] = Field(default_factory=list)
    clinical_recommendation: str
    confidence_score: Optional[float] = None
    confidence_level: Optional[str] = None  # "High", "Moderate", "Low", "Uncertain"
    detection_source: Optional[str] = "knowledge_base"  # "gemini_vision", "openai_vision", "deep_local_vision", "knowledge_base", "user_confirmed"
    candidate_alternatives: List[str] = Field(default_factory=list)
    is_ambiguous: Optional[bool] = False
    is_user_confirmed: Optional[bool] = False
    nutrition_source: Optional[str] = "verified_database"
    client_request_id: Optional[str] = None
    image_id: Optional[str] = None
    visual_evidence: Optional[str] = None
    portion_assumptions: Optional[str] = None
    unseen_limitations: Optional[str] = None
    model_version: Optional[str] = None
    detected_components: List[dict] = Field(default_factory=list)
    disclaimer: Optional[str] = (
        "Clinical nutrition metrics and glycemic index values are provided for dietary screening and educational diabetes self-management. "
        "Consult your healthcare provider or certified diabetes educator for personalized meal therapy."
    )
