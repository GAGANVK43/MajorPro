from fastapi import APIRouter, File, UploadFile, Header, HTTPException, status
from app.schemas.food_schema import FoodAnalysisRequest, FoodConfirmationRequest, FoodAnalysisResponse
from app.services.food_analyzer_service import FoodAnalyzerService
from app.utils.response import success_response

router = APIRouter(prefix="/api/food", tags=["Food Analyzer"])
food_service = FoodAnalyzerService()


@router.post("/analyze-text", status_code=status.HTTP_200_OK)
def analyze_meal_text(
    request: FoodAnalysisRequest,
    accept_language: str = Header(default="en", alias="Accept-Language"),
):
    """
    Analyzes entered meal description and returns exact nutritional facts in requested language.
    """
    analysis = food_service.analyze_meal_text(request.query, lang=accept_language)
    return success_response(
        data=analysis.model_dump(),
        message="Meal nutritional analysis completed successfully.",
    )


@router.post("/analyze-image", status_code=status.HTTP_200_OK)
async def analyze_food_image(
    file: UploadFile = File(...),
    accept_language: str = Header(default="en", alias="Accept-Language"),
):
    """
    Upload a food image -> AI Vision identifies the food item or provides candidate options.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid image (.jpg, .png, .jpeg, .webp)",
        )

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty",
        )

    try:
        analysis = food_service.analyze_food_image(contents, file.filename or "food.jpg", lang=accept_language)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return success_response(
        data=analysis.model_dump(),
        message="Food image analysis completed successfully.",
    )


@router.post("/confirm", status_code=status.HTTP_200_OK)
def confirm_food_selection(
    request: FoodConfirmationRequest,
    accept_language: str = Header(default="en", alias="Accept-Language"),
):
    """
    Confirm candidate dish selection or specify exact dish name to retrieve verified clinical nutrition.
    """
    analysis = food_service.confirm_food_selection(request.dish_name, lang=accept_language)
    return success_response(
        data=analysis.model_dump(),
        message="Food item confirmed and verified nutritional data retrieved successfully.",
    )
