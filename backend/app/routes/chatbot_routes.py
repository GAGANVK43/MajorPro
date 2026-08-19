from typing import Optional, Dict, Any
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.services.chatbot_service import ChatbotService
from app.utils.response import success_response

router = APIRouter(prefix="/api/chatbot", tags=["AI Chatbot Assistant"])


class ChatbotQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, example="Why is my risk high?")
    context: Optional[Dict[str, Any]] = None


@router.post("/query", status_code=status.HTTP_200_OK)
def query_chatbot(request: ChatbotQueryRequest):
    """
    Query DiaSense AI Assistant for real-time medical, diet, report, and health guidance.
    """
    service = ChatbotService()
    result = service.process_message(request.message, request.context)
    return success_response(
        data=result,
        message="AI Chatbot query processed successfully",
    )
