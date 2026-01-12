"""
Business-specific chatbot endpoint.
Uses Ollama (local LLM) ONLY when required.
Rule-based responses are used first for speed and reliability.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import os
import requests
from dotenv import load_dotenv
from bson import ObjectId
from .db_mongo import companies_collection

# Load environment variables
load_dotenv()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")


class BusinessChatbotView(APIView):
    authentication_classes = []
    permission_classes = []

    # ----------------------------------------------------
    # RULE-BASED CHATBOT (FAST)
    # ----------------------------------------------------
    def _rule_based_response(self, company, message):
        msg = message.lower().strip()

        name = company.get("name", "this business")
        services = company.get("services", [])
        opening_time = company.get("opening_time", "")
        closing_time = company.get("closing_time", "")
        working_days = company.get("working_days", [])
        description = company.get("description", "")
        phone = company.get("phone", "")
        address = company.get("address", "")
        city = company.get("city", "")
        country = company.get("country", "")

        # Business hours / timings
        if any(k in msg for k in ["time", "timing", "hour", "open", "close", "business hour"]):
            parts = []
            if opening_time and closing_time:
                parts.append(f"{opening_time} - {closing_time}")
            elif opening_time:
                parts.append(f"Opens at {opening_time}")
            elif closing_time:
                parts.append(f"Closes at {closing_time}")
            
            if working_days and isinstance(working_days, list) and len(working_days) > 0:
                if len(working_days) == 7:
                    days_str = "Every day"
                elif len(working_days) == 1:
                    days_str = working_days[0]
                else:
                    days_str = ", ".join(working_days)
                parts.append(f"on {days_str}")
            
            if parts:
                return f"Our business hours are {' '.join(parts)}."
        
        # Working days specifically
        if any(k in msg for k in ["working day", "work day", "when are you open", "what days"]):
            if working_days and isinstance(working_days, list) and len(working_days) > 0:
                if len(working_days) == 7:
                    return "We are open every day of the week."
                elif len(working_days) == 1:
                    return f"We are open on {working_days[0]}."
                else:
                    days_str = ", ".join(working_days[:-1]) + f" and {working_days[-1]}"
                    return f"We are open on {days_str}."

        # Services
        if any(k in msg for k in ["service", "offer", "provide", "serve"]):
            if services:
                if isinstance(services, list) and len(services) > 0:
                    services_str = ", ".join(services) if len(services) > 1 else services[0]
                    return f"We offer the following services: {services_str}."
                elif isinstance(services, str) and services:
                    return f"We offer the following services: {services}."
            return None

        # Location
        if any(k in msg for k in ["where", "location", "address"]):
            location = ", ".join(p for p in [address, city, country] if p)
            return f"We are located at {location}." if location else None

        # Contact
        if any(k in msg for k in ["contact", "phone", "call", "number"]):
            return f"You can contact us at {phone}." if phone else None

        # About business
        if msg.startswith(("what", "tell me", "about")):
            return description or f"We are {name}."

        return None

    # ----------------------------------------------------
    # BUILD SMALL PROMPT FOR OLLAMA (FAST)
    # ----------------------------------------------------
    def _build_ollama_prompt(self, company, question):
        name = company.get("name", "")
        category = company.get("category", "")
        services = company.get("services", [])
        opening_time = company.get("opening_time", "")
        closing_time = company.get("closing_time", "")
        working_days = company.get("working_days", [])

        # Format services
        if isinstance(services, list) and len(services) > 0:
            services_str = ", ".join(services)
        elif isinstance(services, str) and services:
            services_str = services
        else:
            services_str = "Not specified"

        # Format business hours
        hours_parts = []
        if opening_time and closing_time:
            hours_parts.append(f"{opening_time} - {closing_time}")
        elif opening_time:
            hours_parts.append(f"Opens at {opening_time}")
        elif closing_time:
            hours_parts.append(f"Closes at {closing_time}")
        
        if working_days and isinstance(working_days, list) and len(working_days) > 0:
            if len(working_days) == 7:
                days_str = "Every day"
            else:
                days_str = ", ".join(working_days)
            hours_parts.append(f"on {days_str}")
        
        timings_str = " ".join(hours_parts) if hours_parts else "Not specified"

        address = company.get("address", "")
        city = company.get("city", "")
        country = company.get("country", "")
        location = ", ".join(p for p in [address, city, country] if p) or "Not specified"

        system_prompt = (
            "You are a business assistant. "
            "Answer only using the provided business information. "
            "Do not assume or add details. Keep answers short."
        )

        user_prompt = f"""
Business: {name} ({category})
Services: {services_str}
Business Hours: {timings_str}
Location: {location}

Question: {question}
"""

        return f"{system_prompt}\n{user_prompt}"

    # ----------------------------------------------------
    # CALL OLLAMA (SLOW - USE ONLY IF NEEDED)
    # ----------------------------------------------------
    def _call_ollama(self, prompt):
        try:
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 60
                    }
                },
                timeout=90
            )
            response.raise_for_status()
            return response.json().get("response", "").strip()

        except Exception as e:
            import sys
            sys.stderr.write(f"Ollama error: {e}\n")
            return None

    # ----------------------------------------------------
    # POST ENDPOINT
    # ----------------------------------------------------
    def post(self, request, company_id):
        # Fetch company
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            try:
                company = companies_collection.find_one({"_id": ObjectId(company_id)})
            except Exception:
                company = None

        if not company:
            return Response({"detail": "Company not found"}, status=404)

        message = request.data.get("message", "").strip()
        if not message:
            return Response({"detail": "Message is required"}, status=400)

        # 1️⃣ FAST RULE-BASED RESPONSE
        rule_response = self._rule_based_response(company, message)
        if rule_response:
            return Response({
                "response": rule_response,
                "business_name": company.get("name", "")
            })

        # 2️⃣ FALL BACK TO OLLAMA ONLY IF NEEDED
        prompt = self._build_ollama_prompt(company, message)
        ai_response = self._call_ollama(prompt)

        if ai_response:
            return Response({
                "response": ai_response,
                "business_name": company.get("name", "")
            })

        # 3️⃣ FINAL SAFETY FALLBACK
        return Response({
            "response": "I can help with services, timings, location, or contact details.",
            "business_name": company.get("name", "")
        })
