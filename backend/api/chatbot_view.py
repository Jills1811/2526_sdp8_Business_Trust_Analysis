"""
Business-specific chatbot endpoint.
Rule-based, deterministic, business-scoped.
NO hallucination. NO AI guessing.
"""

import os
import re

import requests
from langdetect import detect, LangDetectException
from bson import ObjectId
from dotenv import load_dotenv
from rest_framework.response import Response
from rest_framework.views import APIView
from deep_translator import GoogleTranslator


from .db_mongo import companies_collection

# ----------------------------------------------------
# ENV
# ----------------------------------------------------
load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")
OLLAMA_TRANSLATION_MODEL = os.getenv("OLLAMA_TRANSLATION_MODEL", "phi3:mini")


# ----------------------------------------------------
# HELPER – NORMALIZATION
# ----------------------------------------------------
def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", text.lower()).strip()


def normalize_list(value):
    if isinstance(value, list):
        return [v.strip() for v in value if isinstance(v, str) and v.strip()]
    if isinstance(value, str) and value.strip():
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def extract_weekday(msg):
    days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    for d in days:
        if d in msg:
            return d.capitalize()
    return None


def extract_city(msg, known_cities):
    for city in known_cities:
        if city.lower() in msg:
            return city.capitalize()
    return None


# ----------------------------------------------------
# MULTILINGUAL HELPERS (OLLAMA-BASED)
# ----------------------------------------------------
LANGUAGE_CODE_MAP = {
    "en": "English",
    "gu": "Gujarati",
    "hi": "Hindi",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ta": "Tamil",
    "mr": "Marathi",
}


def detect_language(text: str) -> str:
    if not text:
        return "en"
    try:
        return detect(text)
    except:
        return "en"


def translate_to_english(text: str) -> str:
    if not text:
        return text
    try:
        return GoogleTranslator(source='auto', target='en').translate(text)
    except Exception as e:
        print("Translation to English failed:", e)
        return text



def translate_from_english(text: str, target_lang: str) -> str:
    if not text or target_lang.lower() == "en":
        return text

    # Force ISO codes explicitly
    lang_map = {
        "gu": "gu",
        "hi": "hi",
        "mr": "mr",
        "ta": "ta",
        "fr": "fr",
        "de": "de",
        "es": "es",
    }

    target = lang_map.get(target_lang.lower())

    if not target:
        return text  # unsupported language → fallback to English

    try:
        translated = GoogleTranslator(source="en", target=target).translate(text)
        print("Translated Output:", translated)
        return translated
    except Exception as e:
        print("Translation from English failed:", e)
        return text






# ----------------------------------------------------
# API VIEW
# ----------------------------------------------------
class BusinessChatbotView(APIView):
    authentication_classes = []
    permission_classes = []

    # ------------------------------------------------
    # RULE-BASED RESPONSES (ORDER MATTERS!)
    # ------------------------------------------------
    def _rule_based_response(self, company, message):
        msg = normalize(message)

        name = company.get("name", "this business")
        services = normalize_list(company.get("services"))
        opening_time = company.get("opening_time", "")
        closing_time = company.get("closing_time", "")
        working_days = normalize_list(company.get("working_days"))
        description = company.get("description", "")
        phone = company.get("phone", "")
        email = company.get("email", "")
        address = company.get("address", "")
        city = company.get("city", "")
        country = company.get("country", "")

        main_city = city.capitalize() if city else ""
        main_location = ", ".join(p for p in [address, city, country] if p)

        # ------------------------------------------------
        # 1️⃣ QUALITY / OPINION
        # ------------------------------------------------
        if any(k in msg for k in ["better", "best", "good", "quality", "recommend"]):
            return (
                "I can help with services, hours, location, or contact details. For service quality, please refer to customer reviews.",
                "general",
                None,
            )

        # ------------------------------------------------
        # 2️⃣ BUSINESS NAME
        # ------------------------------------------------
        if any(k in msg for k in ["name", "called", "call"]):
            if any(k in msg for k in ["shop", "business", "company", "store"]):
                return f"Our business name is {name}.", "name", {"name": name}

        # ------------------------------------------------
        # 3️⃣ OPENING TIME ONLY
        # ------------------------------------------------
        if any(k in msg for k in ["when do you open", "opening time", "open time"]):
            if opening_time:
                return f"We open at {opening_time}.", "opening_time", {"opening_time": opening_time}
            return "Opening time is not listed.", "opening_time", {}

        # ------------------------------------------------
        # 4️⃣ CLOSING TIME ONLY
        # ------------------------------------------------
        if any(k in msg for k in ["when do you close", "closing time", "close time"]):
            if closing_time:
                return f"We close at {closing_time}.", "closing_time", {"closing_time": closing_time}
            return "Closing time is not listed.", "closing_time", {}

        # ------------------------------------------------
        # 5️⃣ DAY-SPECIFIC AVAILABILITY
        # ------------------------------------------------
        weekday = extract_weekday(msg)
        if weekday:
            if weekday in working_days:
                return (
                    f"Yes, we are open on {weekday}.",
                    "day_check",
                    {"day": weekday, "open": True},
                )
            return (
                f"No, we are closed on {weekday}.",
                "day_check",
                {"day": weekday, "open": False},
            )

        # ------------------------------------------------
        # 6️⃣ BRANCH / OTHER LOCATION (HIGH PRIORITY)
        # ------------------------------------------------
        if any(k in msg for k in ["branch", "branches", "another location", "other location"]):
            known_cities = ["nadiad", "anand", "ahmedabad", "vadodara"]
            asked_city = extract_city(msg, known_cities)

            if asked_city:
                if asked_city.lower() == city.lower():
                    return (
                        f"This business operates in {asked_city}.",
                        "branch",
                        {"city": asked_city, "has_branch": True},
                    )
                return (
                    f"I only have information about the main location ({main_location}). Please contact the business directly to confirm branches in {asked_city}.",
                    "branch",
                    {"city": asked_city, "has_branch": False},
                )

            return (
                f"I only have information about the main location: {main_location}. Please contact the business directly for branch details.",
                "branch",
                {"city": None, "has_branch": False},
            )

        # ------------------------------------------------
        # 7️⃣ FULL BUSINESS HOURS
        # ------------------------------------------------
        if any(k in msg for k in ["business hours", "working hours", "hours"]):
            parts = []
            if opening_time and closing_time:
                parts.append(f"{opening_time} to {closing_time}")
            if working_days:
                parts.append("on " + ", ".join(working_days))
            if parts:
                return (
                    f"Our business hours are {' '.join(parts)}.",
                    "hours",
                    {
                        "opening_time": opening_time,
                        "closing_time": closing_time,
                        "working_days": working_days,
                    },
                )
            return "Business hours are not listed.", "hours", {}

        # ------------------------------------------------
        # 8️⃣ SERVICES LIST
        # ------------------------------------------------
        if any(k in msg for k in ["what services", "services", "what do you do"]):
            if services:
                return (
                    f"We offer the following services: {', '.join(services)}.",
                    "services",
                    {"services": services},
                )
            return "Our services are not listed.", "services", {"services": []}

        # ------------------------------------------------
        # 9️⃣ SERVICE AVAILABILITY (STRICT)
        # ------------------------------------------------
        for svc in services:
            if normalize(svc) in msg:
                return (
                    f"Yes, we provide {svc}.",
                    "service_check",
                    {"service": svc, "available": True},
                )

        if any(k in msg for k in ["do you provide", "do you offer", "do you have"]):
            return (
                "I don’t have information confirming that service. Please contact the business directly.",
                "service_check",
                {"service": None, "available": None},
            )

        # ------------------------------------------------
        # 🔟 LOCATION
        # ------------------------------------------------
        if any(k in msg for k in ["where", "location", "address"]):
            if main_location:
                return f"We are located at {main_location}.", "location", {"location": main_location}
            return "Location details are not available.", "location", {}

        # ------------------------------------------------
        # 1️⃣1️⃣ CONTACT
        # ------------------------------------------------
        if any(k in msg for k in ["contact", "phone", "call", "email"]):
            parts = []
            if phone:
                parts.append(f"phone {phone}")
            if email:
                parts.append(f"email {email}")
            if parts:
                return (
                    f"You can contact us via {' and '.join(parts)}.",
                    "contact",
                    {"phone": phone, "email": email},
                )
            return "Contact details are not listed.", "contact", {}

        # ------------------------------------------------
        # 1️⃣2️⃣ ABOUT
        # ------------------------------------------------
        if any(k in msg for k in ["about", "describe", "overview"]):
            if description:
                return description, "about", {"description": description}
            return f"We are {name}.", "about", {"description": None}

        return None

    # ------------------------------------------------
    # POST ENDPOINT
    # ------------------------------------------------
    def post(self, request, company_id):
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            try:
                company = companies_collection.find_one({"_id": ObjectId(company_id)})
            except Exception:
                company = None

        if not company:
            return Response({"detail": "Company not found"}, status=404)

        original_message = request.data.get("message", "").strip()
        if not original_message:
            return Response({"detail": "Message is required"}, status=400)

        # 1) Detect language of the original message
        language = detect_language(original_message)
        print("Detected language:", language)

        # 2) Translate to English if needed (chatbot logic stays English-only)
        if language != "en":
            message_for_bot = translate_to_english(original_message)
        else:
            message_for_bot = original_message

        print("Message for bot:", message_for_bot)

        # 3) Run existing rule-based chatbot logic (unchanged behavior, but on English text)
        rule = self._rule_based_response(company, message_for_bot)
        if rule:
            english_text, intent, data = rule
            # 4) Translate response back to original language if required
            if language != "en":
                final_text = translate_from_english(english_text, language)
            else:
                final_text = english_text

            return Response(
                {
                    "response": final_text,
                    "language": language,
                    "intent": intent,
                    "data": data,
                    "business_name": company.get("name"),
                }
            )

        # No rule matched – fall back to the existing default English response
        english_fallback = (
            "I don’t have information about that. Please contact the business directly for confirmation."
        )
        if language != "en":
            final_fallback = translate_from_english(english_fallback, language)
        else:
            final_fallback = english_fallback

        return Response(
            {
                "response": final_fallback,
                "language": language,
                "intent": "unknown",
                "data": None,
                "business_name": company.get("name"),
            }
        )
