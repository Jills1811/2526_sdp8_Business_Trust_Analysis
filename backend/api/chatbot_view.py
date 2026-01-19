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
        email = company.get("email", "")
        address = company.get("address", "")
        city = company.get("city", "")
        country = company.get("country", "")

        # Normalize services to list
        services_list = []
        if isinstance(services, list):
            services_list = [s for s in services if isinstance(s, str) and s.strip()]
        elif isinstance(services, str) and services.strip():
            services_list = [s.strip() for s in services.split(",") if s.strip()]

        # Helper: match a specific service mentioned in the user message
        matched_service = None
        for svc in services_list:
            try:
                if svc and svc.lower() in msg:
                    matched_service = svc
                    break
            except Exception:
                continue

        # Name intent: explicit requests for business/shop/company name
        name_keywords = [
            "shop name",
            "store name",
            "business name",
            "company name",
            "what is your name",
            "what's your name",
            "whats your name",
        ]
        if any(kw in msg for kw in name_keywords):
            return (
                f"Our company name is {name}.",
                "name",
                {"name": name}
            )

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
                # Best-effort open/closed status using server local time
                def _to_minutes(hhmm):
                    try:
                        h, m = str(hhmm).split(":")
                        return int(h) * 60 + int(m)
                    except Exception:
                        return None
                from datetime import datetime
                now = datetime.now()
                now_m = now.hour * 60 + now.minute
                o_m = _to_minutes(opening_time)
                c_m = _to_minutes(closing_time)
                is_open = None
                if o_m is not None and c_m is not None:
                    is_open = (now_m >= o_m and now_m <= c_m)

                return (
                    f"Our business hours are {' '.join(parts)}.",
                    "hours",
                    {
                        "opening_time": opening_time or None,
                        "closing_time": closing_time or None,
                        "working_days": working_days or [],
                        "is_open_now": is_open,
                    },
                )
        
        # Working days specifically
        if any(k in msg for k in ["working day", "work day", "when are you open", "what days"]):
            if working_days and isinstance(working_days, list) and len(working_days) > 0:
                if len(working_days) == 7:
                    return (
                        "We are open every day of the week.",
                        "hours",
                        {
                            "opening_time": opening_time or None,
                            "closing_time": closing_time or None,
                            "working_days": working_days or [],
                        },
                    )
                elif len(working_days) == 1:
                    return (
                        f"We are open on {working_days[0]}.",
                        "hours",
                        {
                            "opening_time": opening_time or None,
                            "closing_time": closing_time or None,
                            "working_days": working_days or [],
                        },
                    )
                else:
                    days_str = ", ".join(working_days[:-1]) + f" and {working_days[-1]}"
                    return (
                        f"We are open on {days_str}.",
                        "hours",
                        {
                            "opening_time": opening_time or None,
                            "closing_time": closing_time or None,
                            "working_days": working_days or [],
                        },
                    )

        # Services
        if any(k in msg for k in ["service",  "serve"]):
            if services:
                if isinstance(services, list) and len(services) > 0:
                    services_str = ", ".join(services_list) if len(services_list) > 1 else services_list[0]
                    return (
                        f"We offer the following services: {services_str}.",
                        "services",
                        {"services": services_list},
                    )
                elif isinstance(services, str) and services:
                    return (
                        f"We offer the following services: {services}.",
                        "services",
                        {"services": services_list},
                    )
            return None

        # Availability checks like "do you have X" / "is X available"
        availability_keywords = ["do you have", "is there", "available", "in stock", "sell", "carry"]
        if any(k in msg for k in availability_keywords):
            if matched_service:
                return (
                    f"Yes, we offer {matched_service}.",
                    "service_check",
                    {"query": matched_service, "available": True},
                )
            elif services_list:
                return (
                    "We may have what you're looking for. Here are our listed services.",
                    "services",
                    {"services": services_list},
                )
            else:
                return (
                    "Our services are not listed. Please contact us for availability.",
                    "service_check",
                    {"query": None, "available": None},
                )

        # Pricing queries: price, cost, rate, charges, fee, how much
        pricing_keywords = ["price", "cost", "rate", "charges", "fee", "how much"]
        if any(k in msg for k in pricing_keywords):
            if matched_service:
                return (
                    f"Pricing for {matched_service} isn't listed. Please contact us for current rates.",
                    "pricing",
                    {"service": matched_service},
                )
            return (
                "Pricing details aren't listed. Please contact us for current rates.",
                "pricing",
                {"service": None},
            )

        # Location
        if any(k in msg for k in ["where", "location", "address"]):
            location = ", ".join(p for p in [address, city, country] if p)
            return (
                f"We are located at {location}.",
                "location",
                {"address": address or None, "city": city or None, "country": country or None},
            ) if location else None

        # Contact
        if any(k in msg for k in ["contact", "phone", "call", "number", "email", "mail"]):
            if phone or email:
                parts = []
                if phone:
                    parts.append(f"phone {phone}")
                if email:
                    parts.append(f"email {email}")
                return (
                    f"You can contact us via {' and '.join(parts)}.",
                    "contact",
                    {"phone": phone or None, "email": email or None},
                )
            return None

        # About/description intent: only respond when explicitly asked
        description_keywords = [
            "description",
            "describe",
            "about the company",
            "about the business",
            "about us",
            "company overview",
            "business overview",
            "details about",
            "what do you do",
            "what does your company do",
            "tell me about",
            "what company do",
            "what company do you provide",
            "what business do you provide",
        ]
        if any(kw in msg for kw in description_keywords):
            short = None
            if isinstance(description, str) and description:
                short = (description[:200] + ("…" if len(description) > 200 else ""))
            return (
                description or f"We are {name}.",
                "description",
                {"description": description or None, "descriptionShort": short or description or None},
            )

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
            text, intent, data = rule_response
            return Response({
                "response": text,
                "intent": intent,
                "data": data,
                "business_name": company.get("name", "")
            })

        # 2️⃣ FALL BACK TO OLLAMA ONLY IF NEEDED
        prompt = self._build_ollama_prompt(company, message)
        ai_response = self._call_ollama(prompt)

        if ai_response:
            return Response({
                "response": ai_response,
                "intent": "general",
                "data": None,
                "business_name": company.get("name", "")
            })

        # 3️⃣ FINAL SAFETY FALLBACK
        return Response({
            "response": "I can help with services, timings, location, or contact details.",
            "intent": "help",
            "data": None,
            "business_name": company.get("name", "")
        })
