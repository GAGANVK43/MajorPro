import os
import re
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.utils.logger import logger
from app.utils.i18n import normalize_lang, LANGUAGE_NAMES
from app.models.user import User


class ChatbotService:
    """
    Intelligent Healthcare AI Assistant Service with comprehensive multilingual capabilities.
    Integrates with Google Gemini API when GEMINI_API_KEY is configured in .env,
    backed by an advanced NLP intent & conversational intelligence engine covering clinical diagnostics,
    symptoms, biomarkers, nutrition, emergency safeguards, name memory, and personalized health context.
    """
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        # Active generative model names in priority order
        self.models_to_try = [
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemma-4-26b-a4b-it",
            "gemini-3.1-flash-lite",
        ]

    def _extract_name_from_text(self, text: str) -> Optional[str]:
        """Extract a person's name from introductory phrases."""
        patterns = [
            r"(?:my name is|i am|i'm|call me|this is)\s+([A-Za-z\u0C80-\u0CFF\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F]+)",
            r"(?:ನನ್ನ ಹೆಸರು|ನನ್ನ ಹೆಸರು)\s+([A-Za-z\u0C80-\u0CFF]+)",
            r"(?:मेरा नाम|मैं हूँ|मैं)\s+([A-Za-z\u0900-\u097F]+)",
            r"(?:என் பெயர்|நான்)\s+([A-Za-z\u0B80-\u0BFF]+)",
            r"(?:నా పేరు|నేను)\s+([A-Za-z\u0C00-\u0C7F]+)",
            r"(?:എന്റെ പേര്|ഞാൻ)\s+([A-Za-z\u0D00-\u0D7F]+)",
        ]
        stop_words = {
            "a", "an", "the", "diabetic", "patient", "user", "fine", "good", "well", "sick",
            "tired", "hungry", "here", "ready", "asking", "doctor", "nurse", "human", "bot"
        }
        for pat in patterns:
            match = re.search(pat, text, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                if candidate.lower() not in stop_words and len(candidate) >= 2:
                    return candidate.capitalize()
        return None

    def _find_remembered_name(
        self,
        current_msg: str,
        user: Optional[User],
        context: Optional[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]],
    ) -> Optional[str]:
        """Find the user's name from current message, history, context, or user profile."""
        # 1. From current message
        name = self._extract_name_from_text(current_msg)
        if name:
            return name

        # 2. From history turns (newest to oldest)
        if history:
            for turn in reversed(history):
                text = turn.get("text") or turn.get("content") or ""
                role = turn.get("role") or turn.get("sender") or ""
                if role in ("user", "human"):
                    extracted = self._extract_name_from_text(text)
                    if extracted:
                        return extracted

        # 3. From user profile or context
        if user and getattr(user, "full_name", None):
            return user.full_name.strip()
        if context and context.get("user_name"):
            return str(context.get("user_name")).strip()

        return None

    def process_message(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        user: Optional[User] = None,
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        user_msg = message.strip()
        lower_msg = user_msg.lower()

        # Detect requested language
        req_lang = "en"
        if context and isinstance(context, dict):
            req_lang = context.get("language") or context.get("lang") or "en"
        norm_lang = normalize_lang(req_lang)
        lang_name = LANGUAGE_NAMES.get(norm_lang, "English")

        known_name = self._find_remembered_name(user_msg, user, context, history)

        # 1. Check if Gemini API is configured
        if self.api_key:
            import httpx
            system_prompt = (
                f"You are DiaSense AI Assistant, an empathetic, highly knowledgeable medical AI assistant "
                f"specializing in diabetes risk screening, blood glucose management, Indian low-GI nutrition, "
                f"BMI explainability, and preventive healthcare. Provide clear, direct, well-formatted answers without meta-thinking. "
                f"If the user mentions their name or asks who they are, address them warmly"
                + (f" by their name ({known_name}). " if known_name else ". ")
                + f"CRITICAL REQUIREMENT: Respond completely in {lang_name} using natural, authentic, and polite vocabulary."
            )

            # Build Gemini contents including conversation history
            contents = []
            if history:
                for h in history[-6:]:
                    h_role = "user" if h.get("role") in ("user", "human") or h.get("sender") == "user" else "model"
                    h_text = h.get("text") or h.get("content") or ""
                    if h_text:
                        contents.append({"role": h_role, "parts": [{"text": h_text}]})

            contents.append({"role": "user", "parts": [{"text": f"{system_prompt}\nUser Message: {user_msg}"}]})

            for model_name in self.models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                    payload = {"contents": contents}
                    res = httpx.post(url, json=payload, timeout=12.0)
                    if res.status_code == 200:
                        json_data = res.json()
                        candidates = json_data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text = parts[-1].get("text", "").strip()
                                text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL).strip()
                                if text:
                                    return {
                                        "reply": text,
                                        "source": "DiaSense AI Assistant (Gemini)",
                                    }
                except Exception as e:
                    logger.warning(f"Model {model_name} request error: {e}. Trying next fallback...")

        # 2. Comprehensive Multilingual Clinical & Conversational Intelligence Engine
        reply = self._generate_intelligent_reply(
            msg=lower_msg,
            raw_msg=user_msg,
            lang=norm_lang,
            user_name=known_name,
            user=user,
            history=history,
            context=context,
        )
        return {
            "reply": reply,
            "source": "DiaSense AI Assistant",
        }

    def _generate_intelligent_reply(
        self,
        msg: str,
        raw_msg: str,
        lang: str,
        user_name: Optional[str],
        user: Optional[User],
        history: Optional[List[Dict[str, Any]]],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        name_prefix = f"**{user_name}**, " if user_name else ""
        current_path = (context.get("current_path") if context else "") or ""
        is_on_diet_plan = "diet" in current_path.lower() or "diet" in msg

        # ── 1. EMERGENCY SAFEGUARD ───────────────────────────────────────────
        emergency_triggers = [
            "chest pain", "passed out", "unconscious", "heart attack", "shortness of breath",
            "severe breathlessness", "sugar 400", "glucose 400", "sugar 450", "glucose 450",
            "sugar 500", "glucose 500", "severe hypoglycemia", "dizziness and fainting",
            "ketoacidosis", "can't breathe", "cannot breathe", "fainted"
        ]
        if any(trig in msg for trig in emergency_triggers):
            if lang == "kn":
                return (
                    "🚨 **ತುರ್ತು ವೈದ್ಯಕೀಯ ಎಚ್ಚರಿಕೆ:**\n\n"
                    "ನೀವು ತಿಳಿಸಿರುವ ಲಕ್ಷಣಗಳು ಗಂಭೀರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯನ್ನು ಸೂಚಿಸುತ್ತವೆ. "
                    "ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಯ ತುರ್ತು ನಿಗಾ ಘಟಕಕ್ಕೆ (Emergency Room) ಭೇಟಿ ನೀಡಿ ಅಥವಾ ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್ ಸಂಖ್ಯೆ **108 / 112** ಗೆ ಕರೆ ಮಾಡಿ.\n\n"
                    "⚠️ *ಡಿಯಾಸೆನ್ಸ್ ಎಐ ಮಾಹಿತಿ ಮತ್ತು ಜಾಗೃತಿಯ ಸಾಧನವಾಗಿದ್ದು, ತುರ್ತು ಚಿಕಿತ್ಸೆಗೆ ಪರ್ಯಾಯವಲ್ಲ.*"
                )
            elif lang == "hi":
                return (
                    "🚨 **आपातकालीन चिकित्सा चेतावनी:**\n\n"
                    "आपके द्वारा बताए गए लक्षण एक गंभीर आपातकालीन स्थिति का संकेत देते हैं। "
                    "कृपया तुरंत नजदीकी अस्पताल के आपातकालीन कक्ष (Emergency Room) में जाएं या आपातकालीन एम्बुलेंस सेवा **108 / 112** पर कॉल करें।\n\n"
                    "⚠️ *डायसेंस एआई केवल स्वास्थ्य जागरूकता के लिए है और आपातकालीन चिकित्सा का विकल्प नहीं है।*"
                )
            elif lang == "ta":
                return (
                    "🚨 **அவசர மருத்துவ எச்சரிக்கை:**\n\n"
                    "நீங்கள் குறிப்பிட்டுள்ள அறிகுறிகள் உடனடி மருத்துவ அவசரத்தைக் குறிக்கின்றன. "
                    "தயவுசெய்து உடனடியாக அருகிலுள்ள மருத்துவமனைக்குச் செல்லவும் அல்லது **108 / 112** ஐ அழைக்கவும்."
                )
            elif lang == "te":
                return (
                    "🚨 **అత్యవసర వైద్య హెచ్చరిక:**\n\n"
                    "మీరు పేర్కొన్న లక్షణాలు తీవ్రమైన వైద్య అత్యవసర పరిస్థితిని సూచిస్తున్నాయి. "
                    "దయచేసి వెంటనే సమీపంలోని ఆసుపత్రి ఎమర్జెన్సీ విభాగానికి వెళ్ళండి లేదా **108 / 112** కు కాల్ చేయండి."
                )
            elif lang == "ml":
                return (
                    "🚨 **അടിയന്തിര മെഡിക്കൽ മുന്നറിയിപ്പ്:**\n\n"
                    "നിങ്ങൾ വിവരിച്ച ലക്ഷണങ്ങൾ അടിയന്തിര വൈദ്യസഹായം ആവശ്യമുള്ളവയാണ്. "
                    "ദയവായി ഉടൻ തന്നെ അടുത്തുള്ള ആശുപത്രിയിലെ എമർജൻസി വിഭാഗത്തിലേക്ക് പോകുകയോ **108 / 112** ൽ വിളിക്കുകയോ ചെയ്യുക."
                )
            return (
                "🚨 **Urgent Clinical Alert:**\n\n"
                "The symptoms or values you described suggest a potential medical emergency. "
                "Please seek immediate emergency medical evaluation at your nearest hospital or call your emergency helpline (**108 / 112** in India, **911** in the US).\n\n"
                "⚠️ *DiaSense AI is an educational screening platform and cannot provide emergency treatment.*"
            )

        # ── 2. NAME INTRODUCTION ("My name is Gagan", "I am Rahul") ─────────
        intro_name = self._extract_name_from_text(raw_msg)
        if intro_name:
            if lang == "kn":
                return (
                    f"👋 **ನಮಸ್ಕಾರ, {intro_name}!** ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿದ್ದಕ್ಕೆ ಸಂತೋಷ.\n\n"
                    f"ನಾನು ಡಿಯಾಸೆನ್ಸ್ ಎಐ (DiaSense AI) ಸಹಾಯಕ. ನಿಮ್ಮ ಮಧುಮೇಹ ಅಪಾಯದ ವಿಶ್ಲೇಷಣೆ, ಭಾರತೀಯ ಕಡಿಮೆ-ಜಿಐ ಆಹಾರ ಪದ್ಧತಿ, "
                    f"ವ್ಯಾಯಾಮ ಯೋಜನೆ ಅಥವಾ ಆರೋಗ್ಯ ವರದಿಗಳ ಬಗ್ಗೆ ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?"
                )
            elif lang == "hi":
                return (
                    f"👋 **नमस्ते, {intro_name}!** आपसे मिलकर बहुत खुशी हुई।\n\n"
                    f"मैं डायसेंस एआई (DiaSense AI) सहायक हूँ। आपके मधुमेह जोखिम विश्लेषण, भारतीय लो-जीआई आहार योजना, "
                    f"व्यायाम दिनचर्या या स्वास्थ्य रिपोर्ट के बारे में मैं आपकी क्या मदद कर सकता हूँ?"
                )
            elif lang == "ta":
                return (
                    f"👋 **வணக்கம், {intro_name}!** உங்களைச் சந்தித்ததில் மகிழ்ச்சி.\n\n"
                    f"நான் டயாசெನ್ಸ್ ஏஐ (DiaSense AI) உதவியாளர். உங்கள் நீரிழிவு அபாய மதிப்பீடு, உணவு முறை அல்லது "
                    f"உடற்பயிற்சி குறித்து நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
                )
            elif lang == "te":
                return (
                    f"👋 **నమస్కారం, {intro_name}!** మిమ్మల్ని కలవడం చాలా సంతోషంగా ఉంది.\n\n"
                    f"నేను డయాసెన్స్ AI (DiaSense AI) సహాయకుడిని. మీ డయాబెటిస్ ప్రమాద విశ్లేషణ, ఆహార ప్రణాళిక లేదా "
                    f"ఆరోగ్య నివేదికల గురించి నేను మీకు ఎలా సహాయపడగలను?"
                )
            elif lang == "ml":
                return (
                    f"👋 **നമസ്കാരം, {intro_name}!** താങ്കളെ പരിചയപ്പെട്ടതിൽ സന്തോഷം.\n\n"
                    f"ഞാൻ ഡയാസെൻസ് AI (DiaSense AI) അസിസ്റ്റന്റാണ്. പ്രമേഹ സാധ്യത വിശകലനം, ഭക്ഷണക്രമം, "
                    f"വ്യായാമം എന്നിവയെക്കുറിച്ച് ഞാൻ എങ്ങനെ സഹായിക്കണം?"
                )
            return (
                f"👋 **Hello, {intro_name}! Nice to meet you.**\n\n"
                f"I am the DiaSense AI Assistant. How can I help you today with your diabetes risk assessment, "
                f"tailored Indian low-GI diet plan, exercise routine, or clinical biomarker reports?"
            )

        # ── 3. NAME RECALL ("What is my name?", "Who am I?") ─────────────────
        name_queries = [
            "what is my name", "who am i", "do you know my name", "do you remember my name",
            "tell me my name", "what's my name", "my name?", "who i am",
            "ನನ್ನ ಹೆಸರೇನು", "ನನ್ನ ಹೆಸರು ಏನು", "ನನ್ನ ಹೆಸರು ನೆನಪಿದೆಯೇ",
            "मेरा नाम क्या है", "क्या आपको मेरा नाम याद है", "मैं कौन हूँ",
            "என் பெயர் என்ன", "నా పేరు ఏమిటి", "എന്റെ പേരെന്താണ്"
        ]
        if any(nq in msg for nq in name_queries):
            if user_name:
                if lang == "kn":
                    return f"👤 ನಿಮ್ಮ ಹೆಸರು **{user_name}**! ಇಂದು ನಿಮ್ಮ ಆರೋಗ್ಯ ಅಥವಾ ಆಹಾರ ಯೋಜನೆಯ ಬಗ್ಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?"
                elif lang == "hi":
                    return f"👤 आपका नाम **{user_name}** है! आज आपके स्वास्थ्य या आहार योजना के बारे में मैं आपकी क्या मदद कर सकता हूँ?"
                elif lang == "ta":
                    return f"👤 உங்கள் பெயர் **{user_name}**! இன்று உங்கள் உடல்நலம் குறித்து நான் எவ்வாறு உதவ முடியும்?"
                elif lang == "te":
                    return f"👤 మీ పేరు **{user_name}**! ఈరోజు మీ ఆరోగ్యం లేదా ఆహార ప్రణాళిక గురించి నేను ఎలా సహాయపడగలను?"
                elif lang == "ml":
                    return f"👤 താങ്കളുടെ പേര് **{user_name}** എന്നാണ്! ഇന്ന് താങ്കളുടെ ആരോഗ്യകാര്യങ്ങളിൽ ഞാൻ എങ്ങനെ സഹായിക്കണം?"
                return f"👤 Your name is **{user_name}**! How can I assist you with your health, diet, or assessment today?"
            else:
                if lang == "kn":
                    return "👤 ನೀವು ಇನ್ನೂ ನಿಮ್ಮ ಹೆಸರನ್ನು ನನಗೆ ತಿಳಿಸಿಲ್ಲ! ನಾನು ನಿಮ್ಮನ್ನು ಏನೆಂದು ಕರೆಯಲಿ?"
                elif lang == "hi":
                    return "👤 आपने अभी तक मुझे अपना नाम नहीं बताया है! मैं आपको किस नाम से संबोधित करूँ?"
                elif lang == "ta":
                    return "👤 உங்கள் பெயரை நீங்கள் இன்னும் என்னிடம் சொல்லவில்லை! உங்களை நான் என்னவென்று அழைக்கலாம்?"
                elif lang == "te":
                    return "👤 మీరు ఇంకా మీ పేరు నాకు చెప్పలేదు! మిమ్మల్ని నేను ఎలా పిలవాలి?"
                elif lang == "ml":
                    return "👤 താങ്കൾ ഇതുവരെ പേര് പറഞ്ഞിട്ടില്ല! താങ്കളെ എന്ത് പേര് വിളിക്കണം?"
                return "👤 You haven't told me your name yet! What should I call you?"

        # ── 4. GRATITUDE & THANKS ("Thank you", "Thanks", "Dhanyavad") ───────
        gratitude_triggers = [
            "thank you", "thanks", "thank u", "thx", "thank you so much", "thanks a lot",
            "ಧನ್ಯವಾದ", "ಧನ್ಯವಾದಗಳು", "ಧನ್ಯವಾದಗಳು!", "ಧನ್ಯವಾದ!",
            "धन्यवाद", "बहुत धन्यवाद", "शुक्रिया",
            "நன்றி", "மிக்க நன்றி",
            "ధన్యవాదాలు", "చాలా ధన్యవాదాలు",
            "നന്ദി", "വളരെ നന്ദി"
        ]
        if any(gt == msg.strip("!., ") or msg.strip("!., ").startswith(gt) for gt in gratitude_triggers):
            if lang == "kn":
                return (
                    f"🙏 {name_prefix}ನಿಮಗೆ ಸ್ವಾಗತ! ನಿಮ್ಮ ಆರೋಗ್ಯ ಮತ್ತು ಆಹಾರದ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳಿದ್ದರೂ ನಾನು ಸದಾ ಸಹಾಯಕ್ಕೆ ಸಿದ್ಧನಿದ್ದೇನೆ. "
                    f"ನಿಮಗೆ ಇನ್ನೇನಾದರೂ ಸಹಾಯ ಬೇಕೇ?"
                )
            elif lang == "hi":
                return (
                    f"🙏 {name_prefix}आपका बहुत-बहुत स्वागत है! आपके स्वास्थ्य, खान-पान और मधुमेह जागरूकता के लिए मैं हमेशा यहाँ हूँ। "
                    f"क्या आप कुछ और जानना चाहते हैं?"
                )
            elif lang == "ta":
                return f"🙏 {name_prefix}உங்களுக்கு நல்வரவு! உங்கள் உடல்நலம் மற்றும் உணவு முறை குறித்த சந்தேகங்களை எப்போது வேண்டுமானாலும் கேட்கலாம்."
            elif lang == "te":
                return f"🙏 {name_prefix}మీకు స్వాగతం! మీ ఆరోగ్యం మరియు ఆహార ప్రణాళిక గురించి ఏవైనా ప్రశ్నలు ఉంటే ఎప్పుడైనా అడగవచ్చు."
            elif lang == "ml":
                return f"🙏 {name_prefix}സ്വാഗതം! ആരോഗ്യ സംബന്ധമായ സംശയങ്ങൾ എപ്പോഴും ചോദിക്കാവുന്നതാണ്."
            return (
                f"🙏 {name_prefix}You're very welcome! 😊 I am always here to assist you with your metabolic health, "
                f"nutrition planning, and risk screening. Is there anything else you would like help with today?"
            )

        # ── 5. GENERAL ASSISTANCE ("i need one help", "can you help me") ─────
        help_request_triggers = [
            "i need one help", "need one help", "i need a help", "i need help", "need help",
            "can you help me", "could you help me", "can you help", "please help me", "help me",
            "assist me", "i need assistance", "have a question", "one question", "i have a doubt",
            "ಸಹಾಯ ಬೇಕು", "ನನಗೆ ಒಂದು ಸಹಾಯ ಬೇಕು", "ನನಗೆ ಸಹಾಯ ಬೇಕು", "ಸಹಾಯ ಮಾಡಬಹುದೇ",
            "मदद चाहिए", "मुझे एक मदद चाहिए", "मेरी मदद करो", "क्या आप मेरी मदद कर सकते हैं",
            "உதவி வேண்டும்", "எனக்கு ஒரு உதவி வேண்டும்",
            "సహాయం కావాలి", "నాకు ఒక సహాయం కావాలి",
            "സഹായം വേണം", "എനിക്ക് ഒരു സഹായം വേണം"
        ]
        if any(ht in msg for ht in help_request_triggers) or msg in ["help", "help!"]:
            context_note = ""
            if is_on_diet_plan:
                if lang == "kn":
                    context_note = " (ನೀವು ಪ್ರಸ್ತುತ ನಿಮ್ಮ ಡಯಟ್ ಪ್ಲಾನ್ ಪುಟದಲ್ಲಿದ್ದೀರಿ - ಇಂದಿನ ಊಟದ ಯೋಜನೆ ಅಥವಾ ಕಡಿಮೆ-ಜಿಐ ಆಹಾರಗಳ ಬಗ್ಗೆ ಕೇಳಬಹುದು)"
                elif lang == "hi":
                    context_note = " (आप वर्तमान में अपने डाइट प्लान पेज पर हैं - आप आज के भोजन या कम-जीआई विकल्पों के बारे में पूछ सकते हैं)"
                else:
                    context_note = " (I see you're currently viewing your Diet Plan — I can help you with today's meal schedule, low-GI swaps, or daily habits!)"

            if lang == "kn":
                return (
                    f"🤝 **ಖಂಡಿತ{', ' + user_name if user_name else ''}! ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ.**{context_note}\n\n"
                    f"ನಿಮಗೆ ಯಾವ ವಿಷಯದಲ್ಲಿ ಸಹಾಯ ಬೇಕು?\n"
                    f"• **ಮೌಲ್ಯಮಾಪನ:** ನಿಮ್ಮ ಮಧುಮೇಹ ಅಪಾಯದ ಸ್ಕೋರ್ ಮತ್ತು ವರದಿ ವಿವರಣೆ\n"
                    f"• **ಆಹಾರ ಪದ್ಧತಿ:** ಇಂದಿನ ಊಟ, ಕಡಿಮೆ-ಜಿಐ ಪಾಕವಿಧಾನಗಳು ಮತ್ತು ತಿಂಡಿಗಳು\n"
                    f"• **ಜೈವಿಕ ಗುರುತುಗಳು:** BMI, HbA1c ಅಥವಾ ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮಿತಿಗಳು\n"
                    f"• **ವೈದ್ಯಕೀಯ ವರದಿ:** ನಿಮ್ಮ ಲ್ಯಾಬ್ ವರದಿಯ ಮೌಲ್ಯಗಳನ್ನು ಅರ್ಥೈಸಿಕೊಳ್ಳುವುದು\n\n"
                    f"ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ತಿಳಿಸಿ!"
                )
            elif lang == "hi":
                return (
                    f"🤝 **ज़रूर{', ' + user_name if user_name else ''}! मैं आपकी मदद के लिए यहाँ हूँ।**{context_note}\n\n"
                    f"आपको किस विषय में सहायता चाहिए?\n"
                    f"• **जोखिम मूल्यांकन:** अपने डायबिटीज रिस्क स्कोर और रिपोर्ट को समझना\n"
                    f"• **डाइट प्लान:** आज का भोजन, कम-जीआई आहार और स्वस्थ स्नैक्स\n"
                    f"• **बायोमार्कर:** BMI, HbA1c या ब्लड शुगर के सामान्य स्तर\n"
                    f"• **मेडिकल रिपोर्ट:** लैब रिपोर्ट के परिणामों को समझना\n\n"
                    f"कृपया अपना प्रश्न पूछें!"
                )
            elif lang == "ta":
                return (
                    f"🤝 **நிச்சயமாக{', ' + user_name if user_name else ''}! நான் உங்களுக்கு உதவத் தயாராக இருக்கிறேன்.**\n\n"
                    f"உங்களுக்கு எதைப் பற்றிய உதவி தேவை? உங்கள் நீரிழிவு அபாய மதிப்பீடு, 7-நாள் உணவு திட்டம், "
                    f"அல்லது ரத்தப் பரிசோதனை அறிக்கைகள் பற்றி நீங்கள் கேட்கலாம்."
                )
            elif lang == "te":
                return (
                    f"🤝 **తప్పకుండా{', ' + user_name if user_name else ''}! నేను మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను.**\n\n"
                    f"మీకు దేని గురించి సహాయం కావాలి? మీ డయాబెటిస్ ప్రమాద స్కోరు, ఆహార ప్రణాళిక లేదా రక్త పరీక్ష నివేదికల గురించి అడగవచ్చు."
                )
            elif lang == "ml":
                return (
                    f"🤝 **തീർച്ചയായും{', ' + user_name if user_name else ''}! ഞാൻ സഹായിക്കാം.**\n\n"
                    f"എന്ത് കാര്യത്തിലാണ് സഹായം വേണ്ടത്? പ്രമേഹ സാധ്യത സ്കോർ, ഡയറ്റ് പ്ലാൻ, അല്ലെങ്കിൽ രക്തപരിശോധനാ ഫലങ്ങളെക്കുറിച്ച് ചോദിക്കാവുന്നതാണ്."
                )
            return (
                f"🤝 **Of course{', ' + user_name if user_name else ''}! I'm here to help.**{context_note}\n\n"
                f"What would you like assistance with?\n"
                f"• **Risk Assessment:** Understanding your diabetes risk score and contributing factors\n"
                f"• **Diet & Nutrition:** What to eat today, tailored Indian low-GI meals, and snack ideas\n"
                f"• **Biomarkers:** Explaining BMI, HbA1c, or fasting blood glucose targets\n"
                f"• **Medical Reports:** Interpreting lab values or upload results\n\n"
                f"Feel free to ask your specific question!"
            )

        # ── 6. GREETINGS & PLEASANTRIES ("Hi", "Hello", "Good morning") ──────
        greetings = [
            "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
            "namaste", "namaskar", "namaskara", "vanakkam", "how are you", "who are you"
        ]
        if msg in greetings or any(msg.startswith(g + " ") for g in greetings):
            greeting_name = f", {user_name}" if user_name else ""
            if lang == "kn":
                return (
                    f"🩺 **ನಮಸ್ಕಾರ{greeting_name}!** ನಾನು ಡಿಯಾಸೆನ್ಸ್ ಎಐ (DiaSense AI) ಆರೋಗ್ಯ ಸಹಾಯಕ.\n\n"
                    f"ನಾನು ಮಧುಮೇಹ ಅಪಾಯದ ಮುನ್ಸೂಚನೆ, ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮಟ್ಟ ನಿಯಂತ್ರಣ, ಕಡಿಮೆ-ಜಿಐ ಆಹಾರ ಯೋಜನೆ ಮತ್ತು ಜೀವನಶೈಲಿ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತೇನೆ. "
                    f"ನಿಮ್ಮ ಯಾವುದೇ ಆರೋಗ್ಯ ಪ್ರಶ್ನೆಗಳನ್ನು ಮುಕ್ತವಾಗಿ ಕೇಳಿ!"
                )
            elif lang == "hi":
                return (
                    f"🩺 **नमस्ते{greeting_name}!** मैं डायसेंस एआई (DiaSense AI) स्वास्थ्य सहायक हूँ।\n\n"
                    f"मैं मधुमेह जोखिम पूर्वानुमान, रक्त शर्करा प्रबंधन, कम-जीआई भारतीय आहार और जीवनशैली सुधार में आपकी सहायता करता हूँ। "
                    f"आप मुझसे स्वास्थ्य से जुड़ा कोई भी प्रश्न पूछ सकते हैं!"
                )
            elif lang == "ta":
                return (
                    f"🩺 **வணக்கம்{greeting_name}!** நான் டயாசென்ஸ் ஏஐ (DiaSense AI) மருத்துவ உதவியாளர்.\n\n"
                    f"இரத்த சர்க்கரை அளவை பராமரிப்பது, உணவு முறை மற்றும் உடற்பயிற்சி பற்றி ஏதேனும் கேள்விகள் இருந்தால் கேளுங்கள்!"
                )
            elif lang == "te":
                return (
                    f"🩺 **నమస్కారం{greeting_name}!** నేను డయాసెన్స్ AI (DiaSense AI) ఆరోగ్య సహాయకుడిని.\n\n"
                    f"రక్తంలో చక్కెర స్థాయిలు, ఆరోగ్యకరమైన ఆహార ప్రణాళిక మరియు జీవనశైలి మార్గదర్శకత్వం గురించి ఏవైనా సందేహాలుంటే అడగండి!"
                )
            elif lang == "ml":
                return (
                    f"🩺 **നമസ്കാരം{greeting_name}!** ഞാൻ ഡയാസെൻസ് AI (DiaSense AI) ഹെൽത്ത് അസിസ്റ്റന്റാണ്.\n\n"
                    f"രക്തത്തിലെ പഞ്ചസാരയുടെ അളവ്, പ്രമേഹ സാധ്യത, സമീകൃതാഹാരം എന്നിവയെക്കുറിച്ചുള്ള സംശയങ്ങൾ ചോദിക്കാവുന്നതാണ്!"
                )
            return (
                f"🩺 **Hello{greeting_name}! I am DiaSense AI Assistant.**\n\n"
                f"I am here to guide you with diabetes risk screening, blood glucose management, Indian low-GI diet planning, "
                f"and healthy lifestyle habits. Feel free to ask any question about your risk, diet, exercise, or health reports!"
            )

        # ── 7. RISK BREAKDOWN & PERCENTAGE EXPLANATION ("Why is my risk 71.5%?", "Explain my risk") ───
        pct_match = re.search(r"(\d+(?:\.\d+)?)\s*%", msg)
        pct_in_msg = float(pct_match.group(1)) if pct_match else None

        risk_inquiry_triggers = [
            "why is my risk", "why is risk", "explain my risk", "what is my risk",
            "what was my risk", "what was my last", "my assessment", "my result", "am i diabetic",
            "what is my score", "my health score", "show my result", "last assessment",
            "risk mean", "risk percentage",
            "ನನ್ನ ಅಪಾಯ", "ನನ್ನ ವರದಿ", "ನನ್ನ ಸ್ಕೋರ್", "ಅಪಾಯ ಏಕೆ", "ಅಪಾಯದ ವಿವರಣೆ",
            "मेरा जोखिम", "मेरी रिपोर्ट", "मेरा स्कोर", "जोखिम क्यों"
        ]
        is_risk_query = any(rq in msg for rq in risk_inquiry_triggers) or (pct_in_msg is not None and "risk" in msg)

        if is_risk_query:
            # 1. Check if user is authenticated and has DB prediction records
            latest_pred = None
            latest_assess = None
            if self.db and user:
                from app.repositories.prediction_repository import PredictionRepository
                from app.repositories.assessment_repository import AssessmentRepository
                latest_pred = PredictionRepository(self.db).get_latest_by_user_id(user.id)
                if latest_pred:
                    latest_assess = AssessmentRepository(self.db).get_by_id(latest_pred.assessment_id)

            target_pct = pct_in_msg if pct_in_msg is not None else (latest_pred.risk_percentage if latest_pred else None)

            if latest_pred and latest_assess:
                pred_label = latest_pred.prediction
                risk_pct = latest_pred.risk_percentage
                conf = latest_pred.confidence
                date_str = latest_pred.created_at.strftime("%B %d, %Y") if latest_pred.created_at else "recent assessment"
                h_score = max(20, round(100 - risk_pct))

                gluc = latest_assess.glucose
                bmi_val = latest_assess.bmi
                bp = latest_assess.blood_pressure
                age_val = latest_assess.age

                if lang == "kn":
                    return (
                        f"📊 **ನಿಮ್ಮ ಮಧುಮೇಹ ಅಪಾಯದ ವಿವರಣೆ ({risk_pct}% - {pred_label}):**\n\n"
                        f"ಡಿಯಾಸೆನ್ಸ್ ಎಐ ಮೆಷಿನ್ ಲರ್ನಿಂಗ್ ಮಾದರಿಯು ನಿಮ್ಮ ಈ ಕೆಳಗಿನ ಕ್ಲಿನಿಕಲ್ ಅಂಶಗಳನ್ನು ಆಧರಿಸಿ ಈ ಅಪಾಯವನ್ನು ಲೆಕ್ಕಹಾಕಿದೆ:\n"
                        f"1. **ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮಟ್ಟ ({gluc} mg/dL):** ಉಪವಾಸದ ಸಾಮಾನ್ಯ ಮಿತಿ 70-99 mg/dL ಆಗಿದೆ. ಈ ಮೌಲ್ಯವು ಅಪಾಯದ ಪ್ರಮುಖ ಚಾಲಕವಾಗಿದೆ.\n"
                        f"2. **ದೇಹ ದ್ರವ್ಯರಾಶಿ ಸೂಚ್ಯಂಕ - BMI ({bmi_val} kg/m²):** ಭಾರತೀಯ ಮಾನದಂಡಗಳ ಪ್ರಕಾರ 23 ಕ್ಕಿಂತ ಹೆಚ್ಚಿನ BMI ಇನ್ಸುಲಿನ್ ಪ್ರತಿರೋಧಕ್ಕೆ ಕಾರಣವಾಗಬಹುದು.\n"
                        f"3. **ರಕ್ತದೊತ್ತಡ ({bp} mmHg) ಮತ್ತು ವಯಸ್ಸು ({age_val} ವರ್ಷ):** ನಾಳೀಯ ಮತ್ತು ಚಯಾಪಚಯ ದಕ್ಷತೆಯನ್ನು ಸೂಚಿಸುತ್ತದೆ.\n\n"
                        f"• **ಮಾದರಿ ವಿಶ್ವಾಸಾರ್ಹತೆ:** {conf}%\n"
                        f"• **ಮೆಟಾಬಾಲಿಕ್ ಆರೋಗ್ಯ ಸ್ಕೋರ್:** {h_score} / 100\n\n"
                        f"💡 *ಹೆಚ್ಚಿನ ವಿವರಣೆ ಮತ್ತು ಶಿಫಾರಸುಗಳಿಗಾಗಿ **Result** ಪುಟವನ್ನು ಹಾಗೂ ಸೂಕ್ತ ಆಹಾರಕ್ಕಾಗಿ **Diet Plan** ಪುಟವನ್ನು ವೀಕ್ಷಿಸಿ.*"
                    )
                elif lang == "hi":
                    return (
                        f"📊 **आपके मधुमेह जोखिम का विवरण ({risk_pct}% - {pred_label}):**\n\n"
                        f"डायसेंस एआई मॉडल ने आपके निम्नलिखित क्लिनिकल मापदंडों के आधार पर यह जोखिम निकाला है:\n"
                        f"1. **रक्त शर्करा स्तर ({gluc} mg/dL):** सामान्य सीमा 70-99 mg/dL होती है। बढ़ा हुआ ग्लूकोज इंसुलिन संवेदनशीलता में कमी को दर्शाता है।\n"
                        f"2. **बॉडी मास इंडेक्स - BMI ({bmi_val} kg/m²):** 23 से अधिक बीएमआई इंसुलिन प्रतिरोध को बढ़ावा देता है।\n"
                        f"3. **रक्तचाप ({bp} mmHg) और आयु ({age_val} वर्ष):** हृदय और मेटाबॉलिक स्वास्थ्य पर प्रभाव।\n\n"
                        f"• **मॉडल सटीकता:** {conf}%\n"
                        f"• **हेल्थ स्कोर:** {h_score} / 100\n\n"
                        f"💡 *पूरी व्याख्या देखने के लिए **Result** पेज और 7-दिवसीय डाइट के लिए **Diet Plan** पेज पर जाएं।*"
                    )
                return (
                    f"📊 **Why Your Clinical Risk Score is {risk_pct}% ({pred_label}):**\n\n"
                    f"Our trained clinical screening model evaluated your physiological markers against validated epidemiological patterns:\n\n"
                    f"1. **Blood Glucose ({gluc} mg/dL):** Normal euglycemia is 70–99 mg/dL. Elevated readings directly amplify diabetes probability.\n"
                    f"2. **Body Mass Index ({bmi_val} kg/m²):** Asian-Indian consensus guidelines recommend BMI < 23 kg/m². Elevated BMI increases visceral adiposity and insulin resistance.\n"
                    f"3. **Blood Pressure ({bp} mmHg) & Age ({age_val} yrs):** Vascular resistance and age-related metabolic slowdown.\n\n"
                    f"• **Model Confidence:** **{conf}%** | **Health Score:** **{h_score} / 100**\n\n"
                    f"💡 *You can view your detailed factor importance on the **Result** page and your tailored 7-day nutritional schedule on the **Diet Plan** page.*"
                )

            # If user mentioned a specific percentage or has no stored record
            display_pct = target_pct if target_pct is not None else 71.5
            tier = "High / Elevated Risk" if display_pct >= 50 else ("Moderate Risk" if display_pct >= 25 else "Low Risk")

            if lang == "kn":
                return (
                    f"📊 **{display_pct}% ಮಧುಮೇಹ ಅಪಾಯದ ಅರ್ಥವೇನು?**\n\n"
                    f"**{display_pct}%** ಅಪಾಯದ ಸ್ಕೋರ್ ನಿಮ್ಮನ್ನು **{tier}** ಶ್ರೇಣಿಯಲ್ಲಿರಿಸುತ್ತದೆ. ಡಿಯಾಸೆನ್ಸ್ ಎಐ ಈ ಕೆಳಗಿನ ಪ್ರಮುಖ ಅಂಶಗಳ ಆಧಾರದ ಮೇಲೆ ಈ ಅಪಾಯವನ್ನು ನಿರ್ಣಯಿಸುತ್ತದೆ:\n"
                    f"1. **ಉಪವಾಸದ ರಕ್ತದ ಗ್ಲೂಕೋಸ್:** ಸಾಮಾನ್ಯ ಮಿತಿ 70-99 mg/dL ಗಿಂತ ಹೆಚ್ಚಿರುವ ಮೌಲ್ಯಗಳು ನೇರವಾಗಿ ಅಪಾಯವನ್ನು ಹೆಚ್ಚಿಸುತ್ತವೆ.\n"
                    f"2. **ಹೆಚ್ಚಿನ BMI (ದೇಹ ದ್ರವ್ಯರಾಶಿ ಸೂಚ್ಯಂಕ):** 23 kg/m² ಗಿಂತ ಹೆಚ್ಚಿನ BMI ಹೊಟ್ಟೆಯ ಕೊಬ್ಬು ಮತ್ತು ಇನ್ಸುಲಿನ್ ಪ್ರತಿರೋಧಕ್ಕೆ ಕಾರಣವಾಗುತ್ತದೆ.\n"
                    f"3. **ಕುಟುಂಬದ ಇತಿಹಾಸ ಮತ್ತು ವಯಸ್ಸು:** ಆನುವಂಶಿಕ ಅಂಶಗಳು ಚಯಾಪಚಯದ ಮೇಲೆ ಪರಿಣಾಮ ಬೀರುತ್ತವೆ.\n"
                    f"4. **ದೈಹಿಕ ಚಟುವಟಿಕೆಯ ಕೊರತೆ:** ಕಡಿಮೆ ವ್ಯಾಯಾಮ ಗ್ಲೂಕೋಸ್ ಬಳಕೆಯನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತದೆ.\n\n"
                    f"⚠️ *ಡಿಯಾಸೆನ್ಸ್ ಎಐ ಸಾಂಖ್ಯಿಕ ಜಾಗೃತಿ ಸಾಧನವಾಗಿದೆ, ವೈದ್ಯಕೀಯ ರೋಗನಿರ್ಣಯವಲ್ಲ. ಅಧಿಕೃತ ಸಲಹೆಗಾಗಿ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.*"
                )
            elif lang == "hi":
                return (
                    f"📊 **{display_pct}% मधुमेह जोखिम का क्या अर्थ है?**\n\n"
                    f"**{display_pct}%** का जोखिम स्कोर आपको **{tier}** श्रेणी में रखता है। डायसेंस एआई इन प्रमुख कारकों के आधार पर इस जोखिम की गणना करता है:\n"
                    f"1. **फास्टिंग ब्लड ग्लूकोज:** 100 mg/dL से अधिक का स्तर इंसुलिन प्रतिरोध का मुख्य संकेत है।\n"
                    f"2. **बीएमआई (BMI):** भारतीय कट-ऑफ (23 kg/m²) से अधिक बीएमआई विसरल फैट को बढ़ाता है।\n"
                    f"3. **पारिवारिक इतिहास और आयु:** आनुवंशिक संवेदनशीलता जोखिम को बढ़ाती है।\n"
                    f"4. **गतिहीन दिनचर्या:** कम शारीरिक गतिविधि ग्लूकोज संतुलन को प्रभावित करती है।\n\n"
                    f"⚠️ *यह एक एआई स्क्रीनिंग टूल है, क्लिनिकल निदान नहीं। कृपया चिकित्सकीय सलाह लें।*"
                )
            return (
                f"📊 **Why a Risk Score of {display_pct}% Indicates an {tier} Pattern:**\n\n"
                f"In the DiaSense AI clinical intelligence engine, a probability score of **{display_pct}%** reflects a statistical alignment with diabetes onset patterns based on four core pillars:\n\n"
                f"1. **Elevated Blood Glucose:** Fasting readings above 100 mg/dL or post-meal spikes are the strongest drivers of insulin resistance.\n"
                f"2. **Elevated BMI (Body Mass Index):** In Asian-Indian guidelines, a BMI >= 23 kg/m² indicates excess visceral adiposity, which secretes inflammatory cytokines that block insulin receptors.\n"
                f"3. **Family History (Pedigree):** Genetic predisposition significantly increases baseline risk.\n"
                f"4. **Sedentary Lifestyle & Glycemic Load:** High-GI refined carbohydrates without regular exercise impair muscular glucose clearance.\n\n"
                f"💡 *DiaSense AI provides risk screening patterns for educational awareness, not a definitive diagnosis. Review your full report on the **Result** page and tailored low-GI meals on the **Diet Plan** page.*"
            )

        # ── 8. SPECIFIC DIET GUIDANCE: "What should I eat today?" ─────────────
        today_food_triggers = [
            "what should i eat today", "what to eat today", "what should i eat",
            "today's meal", "today meal", "breakfast today", "dinner today", "lunch today",
            "ಇಂದು ಏನು ತಿನ್ನಬೇಕು", "ಇಂದಿನ ಊಟ", "ಇಂದು ತಿನ್ನಬೇಕಾದ ಆಹಾರ",
            "आज क्या खाएं", "आज का भोजन", "आज का खाना"
        ]
        if any(tft in msg for tft in today_food_triggers):
            if lang == "kn":
                return (
                    "🥗 **ಇಂದಿನ ಸಮತೋಲಿತ ಕಡಿಮೆ-ಜಿಐ (Low-GI) ಭಾರತೀಯ ಆಹಾರ ಯೋಜನೆ:**\n\n"
                    "• **ಬೆಳಗಿನ ಉಪಹಾರ (Breakfast):** 2 ರಾಗಿ ದೋಸೆ ಅಥವಾ ಓಟ್ಸ್ ಉಪ್ಮಾ ಜೊತೆಗೆ ಪುದೀನಾ ಚಟ್ನಿ ಮತ್ತು ಬೇಯಿಸಿದ ಮೊಟ್ಟೆ / ಪನೀರ್ ತುಂಡುಗಳು.\n"
                    "• **ಮಧ್ಯಾಹ್ನದ ಊಟ (Lunch):** 1 ಕಪ್ ಕಂದು ಅಕ್ಕಿ (Brown Rice) ಅಥವಾ 2 ಮಲ್ಟಿಗ್ರೇನ್ ರೊಟ್ಟಿ, ಮೊಳಕೆ ಕಾಳುಗಳ ಸಾಂಬಾರ್, ಪಾಲಕ್ ಪಲ್ಯ ಮತ್ತು ಸೌತೆಕಾಯಿ ಸಲಾಡ್.\n"
                    "• **ಸಂಜೆಯ ಲಘು ಉಪಹಾರ (Snack):** ಹುರಿದ ಮಖಾನಾ ಅಥವಾ ಹುರಿದ ಕಡಲೆ ಜೊತೆಗೆ ಸಕ್ಕರೆ ರಹಿತ ಹಸಿರು ಚಹಾ (Green Tea).\n"
                    "• **ರಾತ್ರಿಯ ಊಟ (Dinner):** ತರಕಾರಿ ಸೂಪ್, ಗ್ರಿಲ್ಡ್ ಪನೀರ್/ಟೋಫು ಅಥವಾ ಬೇಯಿಸಿದ ಚಿಕನ್ ಜೊತೆಗೆ ಬೇಯಿಸಿದ ಹಸಿರು ತರಕಾರಿಗಳು.\n\n"
                    "💡 *ಸಂಪೂರ್ಣ 7 ದಿನಗಳ ವೈಯಕ್ತಿಕ ವೇಳಾಪಟ್ಟಿಗಾಗಿ **Diet Plan** ಪುಟಕ್ಕೆ ಭೇಟಿ ನೀಡಿ!*"
                )
            elif lang == "hi":
                return (
                    "🥗 **आज का संतुलित लो-ग्लाइसेमिक (Low-GI) भारतीय आहार:**\n\n"
                    "• **सुबह का नाश्ता (Breakfast):** 2 रागी डोसा या ओट्स उपमा, पुदीना चटनी और उबला अंडा या 50g पनीर।\n"
                    "• **दोपहर का भोजन (Lunch):** 2 मल्टीग्रेन रोटी या 1 कटोरी ब्राउन राइस, मूंग दाल, पालक-मेथी की सब्जी और खीरा-टमाटर सलाद।\n"
                    "• **शाम का स्नैक (Snack):** भुना हुआ मखाना या भुने चने के साथ बिना चीनी की ग्रीन टी।\n"
                    "• **रात का भोजन (Dinner):** लौकी/टमाटर का सूप, पनीर भुर्जी या ग्रिल्ड फिश और उबली हुई सब्जियां।\n\n"
                    "💡 *विस्तृत 7-दिवसीय योजना देखने के लिए **Diet Plan** पेज पर जाएं!*"
                )
            return (
                "🥗 **Recommended Low-GI Indian Meal Schedule for Today:**\n\n"
                "• **Breakfast (Morning):**\n"
                "  - 2 Ragi dosas with coriander-mint chutney OR 1 bowl vegetable steel-cut oats, accompanied by 1 boiled egg or 50g paneer.\n\n"
                "• **Lunch (Afternoon):**\n"
                "  - 2 Multigrain / Bajra rotis OR 1 small cup Brown Rice, 1 bowl sprouted moong dal, palak-methi sabzi, and a large cucumber salad.\n\n"
                "• **Evening Snack (4–5 PM):**\n"
                "  - Handful of roasted makhana (foxnuts) or roasted chana with unsweetened green tea or cinnamon infusion.\n\n"
                "• **Dinner (Light, before 8 PM):**\n"
                "  - Stir-fried vegetables with grilled tofu/paneer or baked fish, paired with clear vegetable broth.\n\n"
                "💡 *Explore your full personalized 7-day regimen and daily hydration/step trackers on the **Diet Plan** page.*"
            )

        # ── 9. BIOMARKERS: BMI ───────────────────────────────────────────────
        if "bmi" in msg or "body mass index" in msg or "ಬಿಎಂಐ" in msg or "बीएमआई" in msg:
            if lang == "kn":
                return (
                    "⚖️ **ದೇಹ ದ್ರವ್ಯರಾಶಿ ಸೂಚ್ಯಂಕ (BMI) ಎಂದರೇನು?**\n\n"
                    "BMI ಎನ್ನುವುದು ಎತ್ತರಕ್ಕೆ ಅನುಗುಣವಾಗಿ ದೇಹದ ತೂಕವನ್ನು ಅಳೆಯುವ ಒಂದು ಅನುಪಾತವಾಗಿದೆ (ತೂಕ kg / (ಎತ್ತರ m)²).\n\n"
                    "• **ಭಾರತೀಯ ಮಾನದಂಡಗಳ ಪ್ರಕಾರ:**\n"
                    "  - ಸಾಮಾನ್ಯ ತೂಕ: 18.5 – 22.9 kg/m²\n"
                    "  - ಅಧಿಕ ತೂಕ: 23.0 – 24.9 kg/m²\n"
                    "  - ಬೊಜ್ಜು (Obese): >= 25.0 kg/m²\n\n"
                    "💡 *ಹೆಚ್ಚಿನ BMI ಹೊಟ್ಟೆಯ ಕೊಬ್ಬನ್ನು (visceral fat) ಸೂಚಿಸುತ್ತದೆ, ಇದು ಇನ್ಸುಲಿನ್ ಪ್ರತಿರೋಧವನ್ನು ಹೆಚ್ಚಿಸಿ ಮಧುಮೇಹದ ಅಪಾಯವನ್ನು ತರುತ್ತದೆ.*"
                )
            elif lang == "hi":
                return (
                    "⚖️ **बॉडी मास इंडेक्स (BMI) क्या है?**\n\n"
                    "बीएमआई ऊंचाई के अनुपात में वजन को मापने का पैमाना है (वजन kg / (ऊंचाई m)²)।\n\n"
                    "• **भारतीय दिशानिर्देशों के अनुसार:**\n"
                    "  - सामान्य वजन: 18.5 – 22.9 kg/m²\n"
                    "  - अधिक वजन (Overweight): 23.0 – 24.9 kg/m²\n"
                    "  - मोटापा (Obese): >= 25.0 kg/m²\n\n"
                    "💡 *23 से अधिक बीएमआई इंसुलिन प्रतिरोध को बढ़ाता है, जिससे टाइप 2 मधुमेह का खतरा बढ़ जाता है।*"
                )
            return (
                "⚖️ **What is Body Mass Index (BMI)?**\n\n"
                "BMI is a physiological metric calculated by dividing weight in kilograms by height in meters squared (kg/m²).\n\n"
                "• **Asian-Indian Clinical Cut-offs (Consensus Guidelines):**\n"
                "  - **Normal / Healthy:** 18.5 – 22.9 kg/m²\n"
                "  - **Overweight:** 23.0 – 24.9 kg/m²\n"
                "  - **Obese:** >= 25.0 kg/m²\n\n"
                "💡 *In South Asian populations, visceral adiposity develops at lower BMI thresholds, directly driving hepatic and muscular insulin resistance.*"
            )

        # ── 10. BIOMARKERS: HbA1c ────────────────────────────────────────────
        if "hba1c" in msg or "glycated hemoglobin" in msg or "ಎಚ್‌ಬಿಎ1ಸಿ" in msg or "एचबीए1सी" in msg:
            if lang == "kn":
                return (
                    "🩸 **HbA1c (ಗ್ಲೈಕೇಟೆಡ್ ಹಿಮೋಗ್ಲೋಬಿನ್) ಎಂದರೇನು?**\n\n"
                    "HbA1c ಪರೀಕ್ಷೆಯು ಕಳೆದ 2 ರಿಂದ 3 ತಿಂಗಳುಗಳಲ್ಲಿ ನಿಮ್ಮ ಸರಾಸರಿ ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮಟ್ಟವನ್ನು ಅಳೆಯುತ್ತದೆ.\n\n"
                    "• **ಉಲ್ಲೇಖ ಮೌಲ್ಯಗಳು:**\n"
                    "  - ಸಾಮಾನ್ಯ (ಆರೋಗ್ಯಕರ): < 5.7%\n"
                    "  - ಪ್ರಿ-ಡಯಾಬಿಟಿಸ್ (ಪೂರ್ವ ಮಧುಮೇಹ): 5.7% – 6.4%\n"
                    "  - ಮಧುಮೇಹ (Diabetes): >= 6.5%\n\n"
                    "💡 *ಈ ಪರೀಕ್ಷೆಗೆ ಉಪವಾಸದ ಅಗತ್ಯವಿಲ್ಲ ಮತ್ತು ಇದು ಮಧುಮೇಹದ ನಿಯಂತ್ರಣವನ್ನು ತಿಳಿಯಲು ಗೋಲ್ಡ್ ಸ್ಟ್ಯಾಂಡರ್ಡ್ ಆಗಿದೆ.*"
                )
            elif lang == "hi":
                return (
                    "🩸 **HbA1c (ग्लाइकेटेड हीमोग्लोबिन) क्या है?**\n\n"
                    "HbA1c टेस्ट पिछले 2 से 3 महीनों में आपके औसत रक्त शर्करा स्तर को मापता है।\n\n"
                    "• **नैदानिक संदर्भ सीमाएँ:**\n"
                    "  - सामान्य (स्वस्थ): < 5.7%\n"
                    "  - प्रीडायबिटीज: 5.7% – 6.4%\n"
                    "  - डायबिटीज: >= 6.5%\n\n"
                    "💡 *इस टेस्ट के लिए उपवास की आवश्यकता नहीं होती है।*"
                )
            return (
                "🩸 **What is HbA1c (Glycated Hemoglobin)?**\n\n"
                "HbA1c measures the percentage of hemoglobin in red blood cells that is bound to glucose, reflecting mean glycemia over the past 8 to 12 weeks.\n\n"
                "• **Diagnostic Thresholds (ADA Guidelines):**\n"
                "  - **Normal / Non-Diabetic:** < 5.7%\n"
                "  - **Prediabetes (Impaired Glucose Tolerance):** 5.7% – 6.4%\n"
                "  - **Diabetes Mellitus:** >= 6.5% (confirmed on repeat testing)\n\n"
                "💡 *Because red blood cells circulate for ~120 days, HbA1c provides a longitudinal benchmark independent of day-to-day dietary fluctuations.*"
            )

        # ── 11. BIOMARKERS: FASTING GLUCOSE ──────────────────────────────────
        if "fasting" in msg or "blood sugar" in msg or "glucose level" in msg or "ರಕ್ತದ ಸಕ್ಕರೆ" in msg or "रक्त शर्करा" in msg:
            if lang == "kn":
                return (
                    "🧪 **ಉಪವಾಸದ ರಕ್ತದ ಗ್ಲೂಕೋಸ್ (Fasting Blood Glucose):**\n\n"
                    "ಕನಿಷ್ಠ 8 ಗಂಟೆಗಳ ಕಾಲ ಏನನ್ನೂ ಸೇವಿಸದೆ ರಕ್ತ ಪರೀಕ್ಷೆ ಮಾಡಲಾಗುತ್ತದೆ.\n\n"
                    "• **ಉಲ್ಲೇಖ ಶ್ರೇಣಿ:**\n"
                    "  - ಸಾಮಾನ್ಯ: 70 – 99 mg/dL\n"
                    "  - ಪ್ರಿ-ಡಯಾಬಿಟಿಸ್ (Impaired Fasting Glucose): 100 – 125 mg/dL\n"
                    "  - ಮಧುಮೇಹ: >= 126 mg/dL\n\n"
                    "💡 *ಆಹಾರ ಸೇವಿಸಿದ 2 ಗಂಟೆಗಳ ನಂತರದ ಗ್ಲೂಕೋಸ್ (Postprandial) 140 mg/dL ಗಿಂತ ಕಡಿಮೆಯಿರಬೇಕು.*"
                )
            elif lang == "hi":
                return (
                    "🧪 **फास्टिंग ब्लड ग्लूकोज (Fasting Blood Glucose):**\n\n"
                    "कम से कम 8 घंटे के उपवास के बाद यह टेस्ट किया जाता है।\n\n"
                    "• **संदर्भ सीमाएँ:**\n"
                    "  - सामान्य: 70 – 99 mg/dL\n"
                    "  - प्रीडायबिटीज: 100 – 125 mg/dL\n"
                    "  - डायबिटीज: >= 126 mg/dL\n\n"
                    "💡 *भोजन के 2 घंटे बाद (PPBS) ग्लूकोज 140 mg/dL से कम होना चाहिए।*"
                )
            return (
                "🧪 **Fasting Blood Glucose Reference Ranges:**\n\n"
                "Measured following an overnight fast of at least 8 to 10 hours:\n\n"
                "• **Normal Euglycemia:** 70 – 99 mg/dL\n"
                "• **Impaired Fasting Glucose (Prediabetes):** 100 – 125 mg/dL\n"
                "• **Diabetes Diagnosis:** >= 126 mg/dL on two independent occasions\n\n"
                "💡 *Postprandial (2 hours post-meal) glucose should ideally remain under 140 mg/dL for non-diabetic individuals.*"
            )

        # ── 12. DIET & NUTRITION GENERAL ─────────────────────────────────────
        diet_triggers = [
            "can i eat rice", "is fruit safe", "diet plan", "breakfast",
            "dinner", "lunch", "millet", "ragi", "oats", "sugar intake", "glycemic index", "food",
            "ಆಹಾರ", "ಊಟ", "ತಿಂಡಿ", "ರಾಗಿ", "ಅನ್ನ", "भोजन", "आहार", "चावल", "फल"
        ]
        if any(dt in msg for dt in diet_triggers):
            if lang == "kn":
                return (
                    "🥗 **ಮಧುಮೇಹ ಸ್ನೇಹಿ ಭಾರತೀಯ ಪೌಷ್ಟಿಕಾಂಶ ಮಾರ್ಗದರ್ಶಿ:**\n\n"
                    "• **ಸೇವಿಸಬೇಕಾದ ಆಹಾರಗಳು (ಕಡಿಮೆ ಗ್ಲೈಸೆಮಿಕ್ - Low GI):**\n"
                    "  - ರಾಗಿ ದೋಸೆ, ಓಟ್ಸ್ ಉಪ್ಮಾ, ಜೋಳ, ಮತ್ತು ಕಂದು ಅಕ್ಕಿ (Brown Rice).\n"
                    "  - ಮೊಳಕೆ ಬರಿಸಿದ ಹೆಸರುಕಾಳು, ತೊಗರಿ ಬೇಳೆ, ಮತ್ತು ಪನೀರ್.\n"
                    "  - ಹಸಿರು ತರಕಾರಿಗಳು (ಪಾಲಕ್, ಸೌತೆಕಾಯಿ, ಹಾಗಲಕಾಯಿ, ಸೋರೆಕಾಯಿ).\n\n"
                    "• **ಮಿತಿಗೊಳಿಸಬೇಕಾದ ಆಹಾರಗಳು:**\n"
                    "  - ಪಾಲಿಶ್ ಮಾಡಿದ ಬಿಳಿ ಅಕ್ಕಿ, ಮೈದಾ, ಸಿಹಿತಿಂಡಿಗಳು ಮತ್ತು ಸಕ್ಕರೆ ಚಹಾ.\n"
                    "  - ಎಣ್ಣೆಯಲ್ಲಿ ಕರಿದ ತಿಂಡಿಗಳು ಮತ್ತು ಸಕ್ಕರೆಭರಿತ ಪಾನೀಯಗಳು.\n\n"
                    "💡 *ಸಂಪೂರ್ಣ 7 ದಿನಗಳ ವೈಯಕ್ತಿಕ ಮೆನುವಿಗಾಗಿ Result ಅಥವಾ Diet Plan ಪುಟವನ್ನು ನೋಡಿ.*"
                )
            elif lang == "hi":
                return (
                    "🥗 **डायबिटीज फ्रेंडली भारतीय आहार मार्गदर्शन:**\n\n"
                    "• **क्या खाएं (लो-ग्लाइसेमिक - Low GI):**\n"
                    "  - रागी, ओट्स, बाजरा, मल्टीग्रेन रोटी और ब्राउन राइस।\n"
                    "  - मूंग दाल, चना स्प्राउट्स, पनीर और उबले अंडे।\n"
                    "  - हरी पत्तेदार सब्जियां (पालक, मेथी, लौकी, करेला)।\n\n"
                    "• **किन चीजों से परहेज करें:**\n"
                    "  - सफेद चावल, मैदा, मीठी चाय और तले हुए स्नैक्स।\n"
                    "  - शीतल पेय और पैक्ड फ्रूट जूस।\n\n"
                    "💡 *अपनी 7-दिवसीय वैयक्तिकृत आहार योजना देखने के लिए Diet Plan पेज पर जाएं।*"
                )
            return (
                "🥗 **DiaSense Tailored Indian Low-GI Nutrition Guidelines:**\n\n"
                "• **Prioritize Complex Low-GI Carbohydrates & Fiber:**\n"
                "  - Replace polished white rice with Steel-Cut Oats, Ragi Dosa, Bajra Rotis, or Quinoa.\n"
                "  - High soluble fiber slows carbohydrate absorption and prevents sharp postprandial glucose spikes.\n\n"
                "• **Lean Protein & Satiety:**\n"
                "  - Sprouted Moong Dal, Chana Salad, Paneer Bhurji, Tofu, Boiled Eggs, and Grilled Fish.\n\n"
                "• **Crucial Reductions:**\n"
                "  - Eliminate refined sugar in chai/coffee, packaged fruit juices, and maida-based pastries.\n\n"
                "💡 *Explore your full 7-day personalized breakfast, lunch, and dinner routine on the **Diet Plan** page.*"
            )

        # ── 13. EXERCISE & ACTIVITY ──────────────────────────────────────────
        if "exercise" in msg or "walk" in msg or "walking" in msg or "yoga" in msg or "ವ್ಯಾಯಾಮ" in msg or "ನಡಿಗೆ" in msg or "व्यायाम" in msg:
            if lang == "kn":
                return (
                    "🏃 **ದೈಹಿಕ ಚಟುವಟಿಕೆ ಮತ್ತು ವ್ಯಾಯಾಮ ಮಾರ್ಗದರ್ಶನ:**\n\n"
                    "• **ವಾರಕ್ಕೆ ಕನಿಷ್ಠ 150 ನಿಮಿಷಗಳ ಮಧ್ಯಮ ತೀವ್ರತೆಯ ವ್ಯಾಯಾಮ:**\n"
                    "  - ವಾರದಲ್ಲಿ 5 ದಿನ ದಿನಕ್ಕೆ 30 ರಿಂದ 45 ನಿಮಿಷಗಳ ಚುರುಕಾದ ನಡಿಗೆ (Brisk Walking).\n"
                    "  - ಸೂರ್ಯ ನಮಸ್ಕಾರ ಮತ್ತು ಪ್ರಾಣಾಯಾಮ (ಒತ್ತಡ ನಿಯಂತ್ರಣಕ್ಕಾಗಿ).\n"
                    "  - ವಾರಕ್ಕೆ 2 ದಿನ ಲಘು ತೂಕದ ವ್ಯಾಯಾಮ (ಸ್ನಾಯುಗಳ ಇನ್ಸುಲಿನ್ ಸೂಕ್ಷ್ಮತೆ ಹೆಚ್ಚಿಸಲು).\n\n"
                    "💡 *ಊಟದ ನಂತರ 10-15 ನಿಮಿಷಗಳ ಲಘು ನಡಿಗೆ ರಕ್ತದಲ್ಲಿನ ಸಕ್ಕರೆ ಏರಿಕೆಯನ್ನು ತಕ್ಷಣ ಕಡಿಮೆ ಮಾಡುತ್ತದೆ.*"
                )
            elif lang == "hi":
                return (
                    "🏃 **शारीरिक गतिविधि और व्यायाम मार्गदर्शन:**\n\n"
                    "• **सप्ताह में कम से कम 150 मिनट की मध्यम गतिविधि:**\n"
                    "  - रोजाना 30-45 मिनट तेज गति से टहलें (Brisk Walk)।\n"
                    "  - सूर्य नमस्कार और प्राणायाम तनाव कम करने में सहायक होते हैं।\n"
                    "  - भोजन के 15-20 मिनट बाद हल्की चहलकदमी पोस्ट-मील ग्लूकोज को नियंत्रित करती है।"
                )
            return (
                "🏃 **Clinical Physical Activity Prescription:**\n\n"
                "• **150 Minutes / Week Moderate Aerobic Exercise:**\n"
                "  - 30 to 45 minutes of daily brisk walking (100–120 steps/minute) 5 days per week.\n"
                "  - Muscle contraction stimulates non-insulin dependent glucose uptake via GLUT-4 transporters.\n\n"
                "• **Postprandial Movement Tip:**\n"
                "  - A light 10–15 minute walk 20 minutes after dinner substantially suppresses post-meal glucose spikes."
            )

        # ── 14. SYMPTOMS & WARNING SIGNS ─────────────────────────────────────
        if "symptom" in msg or "early signs" in msg or "urination" in msg or "thirst" in msg or "ಲಕ್ಷಣ" in msg or "लक्षण" in msg:
            if lang == "kn":
                return (
                    "⚠️ **ಮಧುಮೇಹದ ಪ್ರಮುಖ ಆರಂಭಿಕ ಲಕ್ಷಣಗಳು:**\n\n"
                    "1. **ಪದೇ ಪದೇ ಮೂತ್ರ ವಿಸರ್ಜನೆ (Polyuria):** ವಿಶೇಷವಾಗಿ ರಾತ್ರಿಯ ಸಮಯದಲ್ಲಿ.\n"
                    "2. **ವಿಪರೀತ ಬಾಯಾರಿಕೆ (Polydipsia):** ಸಾಕಷ್ಟು ನೀರು ಕುಡಿದರೂ ಬಾಯಾರಿಕೆ ಮುಂದುವರಿಯುವುದು.\n"
                    "3. **ವಿಪರೀತ ಹಸಿವು ಮತ್ತು ಆಯಾಸ:** ಜೀವಕೋಶಗಳಿಗೆ ಶಕ್ತಿ ಸಿಗದ ಕಾರಣ ಸದಾ ಸುಸ್ತು.\n"
                    "4. **ಮಬ್ಬಾದ ದೃಷ್ಟಿ (Blurry Vision) ಮತ್ತು ಗಾಯಗಳು ತಡವಾಗಿ ಗುಣವಾಗುವುದು.**\n\n"
                    "💡 *ಈ ಲಕ್ಷಣಗಳಿದ್ದರೆ ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮತ್ತು HbA1c ಪರೀಕ್ಷೆಯನ್ನು ಮಾಡಿಸಿಕೊಳ್ಳಿ.*"
                )
            elif lang == "hi":
                return (
                    "⚠️ **मधुमेह के मुख्य लक्षण:**\n\n"
                    "1. **बार-बार पेशाब आना (विशेषकर रात में)।**\n"
                    "2. **अत्यधिक प्यास और सूखा मुंह।**\n"
                    "3. **लगातार थकान और ऊर्जा की कमी।**\n"
                    "4. **धुंधली दृष्टि और घावों का देर से भरना।**\n\n"
                    "💡 *यदि आप इनमें से कई लक्षण अनुभव कर रहे हैं, तो तुरंत रक्त शर्करा की जांच करवाएं।*"
                )
            return (
                "⚠️ **Early Hallmark Symptoms of Diabetes Mellitus:**\n\n"
                "1. **Polyuria:** Frequent urination as kidneys filter excess blood glucose into urine.\n"
                "2. **Polydipsia:** Compelling thirst secondary to osmotic fluid loss.\n"
                "3. **Polyphagia & Chronic Fatigue:** Cellular energy starvation due to impaired glucose entry.\n"
                "4. **Blurred Vision & Delayed Wound Healing:** Microvascular osmotic changes and impaired white cell healing."
            )

        # ── 15. DIABETES DEFINITION ──────────────────────────────────────────
        if "what is diabetes" in msg or "define diabetes" in msg or "ಮಧುಮೇಹ ಎಂದರೇನು" in msg or "मधुमेह क्या है" in msg:
            if lang == "kn":
                return (
                    "🩺 **ಮಧುಮೇಹ (Diabetes Mellitus) ಎಂದರೇನು?**\n\n"
                    "ಮಧುಮೇಹವು ರಕ್ತದಲ್ಲಿನ ಗ್ಲೂಕೋಸ್ (ಸಕ್ಕರೆ) ಮಟ್ಟವು ದೀರ್ಘಕಾಲದವರೆಗೆ ಅಧಿಕವಾಗಿರುವ ಒಂದು ಚಯಾಪಚಯ ಕಾಯಿಲೆಯಾಗಿದೆ.\n\n"
                    "• **ಇದು ಹೇಗೆ ಸಂಭವಿಸುತ್ತದೆ:** ಆಹಾರ ಜೀರ್ಣವಾದಾಗ ಗ್ಲೂಕೋಸ್ ಉತ್ಪತ್ತಿಯಾಗುತ್ತದೆ. ಮೇದೋಜೀರಕ ಗ್ರಂಥಿಯು ಉತ್ಪಾದಿಸುವ **ಇನ್ಸುಲಿನ್** ಹಾರ್ಮೋನ್ ಈ ಗ್ಲೂಕೋಸ್ ಅನ್ನು ಜೀವಕೋಶಗಳಿಗೆ ಶಕ್ತಿಯಾಗಿ ಪರಿವರ್ತಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.\n"
                    "• **ಮುಖ್ಯ ವಿಧಗಳು:**\n"
                    "1. **ಟೈಪ್ 1 ಮಧುಮೇಹ:** ದೇಹದಲ್ಲಿ ಇನ್ಸುಲಿನ್ ಉತ್ಪಾದನೆಯೇ ನಿಂತುಹೋಗುತ್ತದೆ.\n"
                    "2. **ಟೈಪ್ 2 ಮಧುಮೇಹ:** ದೇಹದ ಜೀವಕೋಶಗಳು ಇನ್ಸುಲಿನ್‌ಗೆ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸುವುದಿಲ್ಲ (90% ಪ್ರಕರಣಗಳು).\n\n"
                    "💡 *ಉಪವಾಸದ ಸಾಮಾನ್ಯ ರಕ್ತದ ಗ್ಲೂಕೋಸ್ ಮಟ್ಟ 70 - 99 mg/dL ಆಗಿದೆ.*"
                )
            elif lang == "hi":
                return (
                    "🩺 **मधुमेह (Diabetes Mellitus) क्या है?**\n\n"
                    "मधुमेह एक चयापचय विकार है जिसमें रक्त में शर्करा का स्तर लगातार बढ़ा रहता है।\n\n"
                    "• **यह कैसे होता है:** अग्न्याशय (Pancreas) **इंसुलिन** बनाता है जो रक्त शर्करा को कोशिकाओं में ऊर्जा के रूप में पहुंचाने में मदद करता है।\n"
                    "• **मुख्य प्रकार:**\n"
                    "1. **टाइप 1 डायबिटीज:** इंसुलिन उत्पादन का पूर्ण अभाव।\n"
                    "2. **टाइप 2 डायबिटीज:** इंसुलिन प्रतिरोध और अपर्याप्त स्राव (90% मामले)।\n\n"
                    "💡 *उपवास में सामान्य रक्त शर्करा 70 - 99 mg/dL होती है।*"
                )
            return (
                "🩺 **What is Diabetes Mellitus?**\n\n"
                "Diabetes Mellitus is a chronic metabolic disorder marked by persistent hyperglycemia.\n\n"
                "• **Pathophysiology:** Food carbohydrates break down into glucose. The pancreas produces **insulin**, which enables cells to absorb glucose for metabolic fuel.\n"
                "• **Primary Forms:**\n"
                "1. **Type 1 Diabetes:** Autoimmune destruction of pancreatic beta cells.\n"
                "2. **Type 2 Diabetes:** Peripheral insulin resistance combined with progressive beta-cell dysfunction (accounts for ~90% of global cases).\n\n"
                "💡 *Normal Fasting Blood Glucose is 70 – 99 mg/dL. Fasting glucose >= 126 mg/dL indicates diabetes.*"
            )

        # ── 16. OUT-OF-SCOPE QUERIES (Coding, Trivia, Politics, General) ───────
        out_of_scope_patterns = [
            "capital of", "weather in", "write code", "python code", "javascript", "react code",
            "write a function", "prime minister", "president of", "who directed", "movie", "crypto",
            "bitcoin", "stock market", "tell me a joke", "tell a joke", "write a poem", "who won the match"
        ]
        if any(p in msg for p in out_of_scope_patterns):
            if lang == "kn":
                return (
                    "🤖 **ಡಿಯಾಸೆನ್ಸ್ ಎಐ ವ್ಯಾಪ್ತಿ:**\n\n"
                    "ನಾನು ಮಧುಮೇಹ ಜಾಗೃತಿ, ಪೌಷ್ಟಿಕಾಂಶ, ರಕ್ತದ ಸಕ್ಕರೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಮುನ್ನೆಚ್ಚರಿಕೆ ಆರೋಗ್ಯಕ್ಕೆ ಮಾತ್ರ ಮೀಸಲಾದ ವೈದ್ಯಕೀಯ ಎಐ ಸಹಾಯಕ. "
                    "ನಾನು ಸಾಮಾನ್ಯ ಪ್ರೋಗ್ರಾಮಿಂಗ್ ಅಥವಾ ಸಾಮಾನ್ಯ ಜ್ಞಾನದ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ, ಆದರೆ ನಿಮ್ಮ ಮಧುಮೇಹ ಅಪಾಯ, ಆಹಾರ ಮತ್ತು ವ್ಯಾಯಾಮದ ಬಗ್ಗೆ ಉತ್ತರಿಸಲು ಸದಾ ಸಿದ್ಧನಿದ್ದೇನೆ!"
                )
            elif lang == "hi":
                return (
                    "🤖 **डायसेंस एआई कार्यक्षेत्र:**\n\n"
                    "मैं विशेष रूप से मधुमेह जागरूकता, पोषण, रक्त शर्करा नियंत्रण और निवारक स्वास्थ्य के लिए डिज़ाइन किया गया एआई सहायक हूँ। "
                    "मैं सामान्य कोडिंग या सामान्य ज्ञान के प्रश्नों में सहायता नहीं कर सकता, लेकिन मधुमेह जोखिम, आहार और स्वास्थ्य पर आपके प्रश्नों का उत्तर देने के लिए हमेशा तैयार हूँ!"
                )
            return (
                "🤖 **DiaSense AI Assistant Scope:**\n\n"
                "I am specialized exclusively in diabetes risk screening, glycemic management, metabolic health, nutrition, and lifestyle intervention. "
                "I cannot assist with general programming, trivia, or non-health topics, but I would be glad to help answer any questions about your blood glucose, diet plan, or health reports!"
            )

        # ── 17. CONVERSATIONAL CLARIFICATION & FALLBACK ──────────────────────
        if lang == "kn":
            return (
                f"💡 {name_prefix}ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡೆ.\n\n"
                f"ನಿಮಗೆ ಇನ್ನಷ್ಟು ನಿಖರವಾದ ಉತ್ತರ ನೀಡಲು, ದಯವಿಟ್ಟು ಈ ಕೆಳಗಿನವುಗಳಲ್ಲಿ ಯಾವುದರ ಬಗ್ಗೆ ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ ಎಂದು ನಿರ್ದಿಷ್ಟಪಡಿಸಿ:\n"
                f"1. ನಿಮ್ಮ **ಮಧುಮೇಹ ಅಪಾಯದ ಸ್ಕೋರ್** ಮತ್ತು ವರದಿ ವಿವರಣೆ\n"
                f"2. ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ **ಆಹಾರ ಯೋಜನೆ (Diet Plan)** ಮತ್ತು ಕಡಿಮೆ-ಜಿಐ ಆಹಾರಗಳು\n"
                f"3. **ರಕ್ತದ ಸಕ್ಕರೆ, HbA1c ಅಥವಾ BMI** ಜೈವಿಕ ಗುರುತುಗಳು\n"
                f"4. ದೈನಂದಿನ **ವ್ಯಾಯಾಮ ಮತ್ತು ಮುನ್ನೆಚ್ಚರಿಕೆ ಸಲಹೆಗಳು**"
            )
        elif lang == "hi":
            return (
                f"💡 {name_prefix}मुझे आपका संदेश मिला।\n\n"
                f"आपको सबसे सटीक जानकारी देने के लिए, कृपया बताएं कि आप किस विषय पर चर्चा करना चाहते हैं:\n"
                f"1. आपका **डायबिटीज रिस्क स्कोर** और रिपोर्ट व्याख्या\n"
                f"2. आपका व्यक्तिगत **डाइट प्लान** और कम-ग्लाइसेमिक खाद्य पदार्थ\n"
                f"3. **ब्लड शुगर, HbA1c या बीएमआई** के सामान्य स्तर\n"
                f"4. दैनिक **व्यायाम और जीवनशैली सुझाव**"
            )
        elif lang == "ta":
            return (
                f"💡 {name_prefix}உங்கள் கேள்விக்கு நன்றி.\n\n"
                f"இரத்த சர்க்கரை அளவைக் கட்டுக்குள் வைக்க குறைந்த கிளைசெமிக் உணவை உண்ணுங்கள் மற்றும் தினமும் 30 நிமிடங்கள் நடைபயிற்ಸಿ செய்யுங்கள். "
                f"உங்கள் உணவு முறை அல்லது மருத்துவ அறிக்கை குறித்து குறிப்பிட்ட கேள்விகள் இருந்தால் கேளுங்கள்!"
            )
        elif lang == "te":
            return (
                f"💡 {name_prefix}మీ ప్రశ్నకు ధನ್ಯవాదాలు.\n\n"
                f"రక్తంలో చక్కెర స్థాయిలను నియంత్రణలో ఉంచడానికి తక్కువ గ్లైసెమిక్ ఆహారాన్ని తీసుకోండి మరియు రోజూ 30 నిమిషాలు నడవండి. "
                f"మీకు నిర్దిష్ట ఆరోగ్య ప్రశ్నలు ఉంటే దయచేసి అడగండి!"
            )
        elif lang == "ml":
            return (
                f"💡 {name_prefix}ചോദ്യത്തിന് നന്ദി.\n\n"
                f"രക്തത്തിലെ പഞ്ചസാരയുടെ അളവ് നിയന്ത്രിക്കുന്നതിന് കുറഞ്ഞ ഗ്ലൈസെമിക് ഭക്ഷണവും ദിവസേന 30 മിനിറ്റ് നടത്തവും ശീലമാക്കുക. "
                f"കൂടുതൽ വ്യക്തത ആവശ്യമുള്ള സംശയങ്ങൾ ചോദിക്കാവുന്നതാണ്!"
            )
        return (
            f"💡 {name_prefix}I want to make sure I give you the most helpful and accurate answer.\n\n"
            f"Could you specify what area you would like to explore?\n"
            f"1. Understanding your **diabetes risk score** or assessment factors\n"
            f"2. Your tailored **7-day Indian low-GI diet plan** and meal options\n"
            f"3. Clinical biomarkers such as **BMI, HbA1c, or fasting blood glucose**\n"
            f"4. Recommended **exercise routines or symptom checks**"
        )
