from typing import Optional
from fastapi import APIRouter, File, UploadFile, Header, Form, HTTPException, status
from app.schemas.food_schema import FoodAnalysisRequest, FoodAnalysisResponse
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
    client_request_id: Optional[str] = Form(None),
    accept_language: str = Header(default="en", alias="Accept-Language"),
):
    """
    Upload a food image -> AI Vision identifies the food item in requested language.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
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

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image exceeds maximum allowable size of 10MB.",
        )

    analysis = food_service.analyze_food_image(
        image_bytes=contents,
        filename=file.filename or "food.jpg",
        lang=accept_language,
        client_request_id=client_request_id,
    )
    return success_response(
        data=analysis.model_dump(),
        message="AI Food Image Recognition analysis completed successfully.",
    )
