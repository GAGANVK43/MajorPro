from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Header, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.security import get_optional_current_user
from app.models.user import User
from app.services.chatbot_service import ChatbotService
from app.utils.response import success_response

router = APIRouter(prefix="/api/chatbot", tags=["AI Chatbot Assistant"])


class ChatbotQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, example="Why is my risk high?")
    context: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None


@router.post("/query", status_code=status.HTTP_200_OK)
def query_chatbot(
    request: ChatbotQueryRequest,
    accept_language: str = Header(default="en", alias="Accept-Language"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Query DiaSense AI Assistant for real-time medical, diet, report, and health guidance with multilingual context.
    """
    service = ChatbotService(db=db)
    ctx = request.context or {}
    if "language" not in ctx and "lang" not in ctx:
        ctx["language"] = accept_language

    result = service.process_message(
        message=request.message,
        context=ctx,
        user=current_user,
        history=request.history or [],
    )
    return success_response(
        data=result,
        message="AI Chatbot query processed successfully",
    )
