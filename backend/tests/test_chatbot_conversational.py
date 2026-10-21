import pytest
from app.services.chatbot_service import ChatbotService


@pytest.fixture
def chatbot():
    return ChatbotService()


def test_assistance_intent_i_need_one_help(chatbot):
    resp = chatbot.process_message("i need one help", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "Of course" in reply or "here to help" in reply
    assert "Risk Assessment" in reply or "Diet" in reply or "Biomarkers" in reply
    # Must NOT return the generic oats/ragi clinical fallback
    assert "To maintain optimal metabolic health, prioritize low-GI complex carbohydrates" not in reply


def test_assistance_intent_with_diet_plan_page_context(chatbot):
    resp = chatbot.process_message(
        "i need one help",
        context={"language": "en", "current_path": "/diet-plan"}
    )
    reply = resp.get("reply", "")
    assert "Diet Plan" in reply
    assert "meal schedule" in reply or "low-GI" in reply


def test_gratitude_intent_thank_you(chatbot):
    resp = chatbot.process_message("Thank you.", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "welcome" in reply.lower()
    assert "To maintain optimal metabolic health, prioritize low-GI complex carbohydrates" not in reply


def test_name_statement_and_recall(chatbot):
    history = []
    # 1. State name
    resp1 = chatbot.process_message("My name is Gagan.", context={"language": "en"}, history=history)
    history.append({"role": "user", "text": "My name is Gagan."})
    history.append({"role": "assistant", "text": resp1["reply"]})
    assert "Gagan" in resp1["reply"]

    # 2. Ask for name
    resp2 = chatbot.process_message("What is my name?", context={"language": "en"}, history=history)
    assert "Gagan" in resp2["reply"]


def test_concept_explanation_bmi(chatbot):
    resp = chatbot.process_message("What is BMI?", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "Body Mass Index" in reply
    assert "kg/m²" in reply
    assert "23" in reply  # Asian-Indian cutoff


def test_concept_explanation_hba1c(chatbot):
    resp = chatbot.process_message("What is HbA1c?", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "Glycated Hemoglobin" in reply or "HbA1c" in reply
    assert "5.7" in reply or "6.5" in reply


def test_risk_explanation_percentage(chatbot):
    resp = chatbot.process_message("Why is my risk 71.5%?", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "71.5%" in reply
    assert "Elevated" in reply or "High" in reply
    assert "Blood Glucose" in reply
    assert "BMI" in reply


def test_diet_guidance_what_should_i_eat_today(chatbot):
    resp = chatbot.process_message("What should I eat today?", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "Breakfast" in reply
    assert "Lunch" in reply
    assert "Dinner" in reply
    assert "Low-GI" in reply or "Ragi" in reply or "Oats" in reply


def test_emergency_safeguards(chatbot):
    resp = chatbot.process_message("I have severe chest pain and breathlessness", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "🚨" in reply or "Emergency" in reply or "Urgent" in reply
    assert "108" in reply or "112" in reply


def test_out_of_scope_redirection(chatbot):
    resp = chatbot.process_message("What is the capital of France?", context={"language": "en"})
    reply = resp.get("reply", "")
    assert "Scope" in reply or "specialized exclusively in diabetes" in reply
    assert "Paris" not in reply


def test_multilingual_kannada_help(chatbot):
    resp = chatbot.process_message("ನನಗೆ ಒಂದು ಸಹಾಯ ಬೇಕು", context={"language": "kn"})
    reply = resp.get("reply", "")
    assert "ಸಹಾಯ" in reply
    assert "ಮೌಲ್ಯಮಾಪನ" in reply or "ಆಹಾರ" in reply
