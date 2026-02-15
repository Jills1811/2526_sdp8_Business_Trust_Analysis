"""
All views rewritten to use MongoDB only - no Django models.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime, timedelta
from bson import ObjectId
import math
import os
import secrets

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from .mongo_auth import (
    create_user,
    authenticate_user,
    create_token,
    verify_token,
    get_user_by_id,
    get_user_by_email,
    delete_token,
    users_collection,
)
from .db_mongo import (
    companies_collection,
    customers_collection,
    events_collection,
    ratings_collection,
    comments_collection,
    search_history_collection,
)
from .recommendation_engine import recommend_businesses_ml


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _verify_google_token(id_token_value: str):
    """
    Verify a Google ID token and return the decoded payload, or None.
    """
    if not id_token_value or not GOOGLE_CLIENT_ID:
        return None

    try:
        info = google_id_token.verify_oauth2_token(
            id_token_value,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        # Ensure the token has an email
        if not info.get("email"):
            return None
        return info
    except Exception:
        return None


def _get_auth_user(request, user_type=None):
    """Helper to get authenticated user from token."""
    # Django converts Authorization header to HTTP_AUTHORIZATION
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    
    if not auth_header:
        return None
    
    # Parse "Token <token_value>" format
    parts = auth_header.split()
    if len(parts) != 2:
        return None
    
    # Check for "Token" prefix (case-insensitive)
    if parts[0].lower() != "token":
        return None
    
    token_value = parts[1]
    
    # Verify token
    token_info = verify_token(token_value)
    if not token_info:  
        return None
    
    # Check user type if specified
    if user_type and token_info.get("user_type") != user_type:
        return None
    
    # Get user from MongoDB
    user = get_user_by_id(token_info["user_id"])
    return user


def calculate_reputation_score(company_id):
    """
    Calculate reputation score using the formula:
    Reputation Score = (0.5 × Average Rating) + (0.3 × Recent Ratings) + (0.2 × Review Volume Factor)
    
    Where:
    - Average Rating: Overall average rating (0-5 scale, normalized to 0-100)
    - Recent Ratings: Average rating from last 3 days (0-5 scale, normalized to 0-100)
    - Review Volume Factor: More reviews = more trust (0-100 scale based on review count)
    """
    # Get all ratings for this company
    all_ratings = list(ratings_collection.find({"company_id": company_id}))
    
    if not all_ratings:
        return 0.0
    
    # Calculate average rating (component 1: 50% weight)
    total_rating = sum(float(r.get("rating", 0)) for r in all_ratings)
    avg_rating = total_rating / len(all_ratings) if all_ratings else 0.0
    # Normalize to 0-100 scale (rating is 1-5, so multiply by 20)
    avg_rating_normalized = avg_rating * 20.0
    
    # Calculate recent ratings (last 3 days) (component 2: 30% weight)
    # Use UTC to match how ratings are stored
    three_days_ago = datetime.utcnow() - timedelta(days=14)
    recent_ratings = [
        r for r in all_ratings 
        if (r.get("created_at") and r.get("created_at") >= three_days_ago) or
           (r.get("updated_at") and r.get("updated_at") >= three_days_ago)
    ]
    
    if recent_ratings:
        recent_avg = sum(float(r.get("rating", 0)) for r in recent_ratings) / len(recent_ratings)
        recent_avg_normalized = recent_avg * 20.0
    else:
        # If no recent ratings, use overall average
        recent_avg_normalized = avg_rating_normalized
    
    # Calculate review volume factor (component 3: 20% weight)
    # More reviews = more trust, capped at 100
    # Using logarithmic scale: log10(review_count + 1) * 20, capped at 100
    review_count = len(all_ratings)
    if review_count == 0:
        volume_factor = 0.0
    else:
        # Logarithmic scale: log10(count + 1) * 20, but cap at 100
        # For example: 1 review = ~6, 10 reviews = ~20, 100 reviews = ~40, 1000 reviews = ~60
        # We'll use a more practical scale: min(100, review_count * 2) for simplicity
        # Or use: min(100, math.log10(review_count + 1) * 33.33)
        volume_factor = min(100.0, math.log10(review_count + 1) * 33.33)
    
    # Calculate final reputation score
    reputation_score = (
        0.5 * avg_rating_normalized +
        0.3 * recent_avg_normalized +
        0.2 * volume_factor
    )
    
    # Ensure score is between 0 and 100
    return max(0.0, min(100.0, reputation_score))


class CompanySignupView(APIView):
    """
    POST /api/company/signup/
    Creates company user and company profile in MongoDB only.
    """

    def post(self, request, *args, **kwargs):
        data = request.data
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "").strip()
        
        if not email or not password or not name or not category:
            return Response(
                {"detail": "Email, password, name, and category are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check if email already exists
        if get_user_by_email(email):
            return Response(
                {"detail": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Create user in MongoDB
        user_id = create_user(
            email=email,
            password=password,
            user_type="company",
        )
        
        # Create company profile
        # MongoDB will auto-generate a unique _id, which we'll use as company_id
        company_doc = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "category": category,
            "description": data.get("description", ""),
            "phone": data.get("phone", ""),
            "address": data.get("address", ""),
            "city": data.get("city", ""),
            "country": data.get("country", ""),
            # Optional business details
            "services": data.get("services", []),
            "opening_time": data.get("opening_time", ""),
            "closing_time": data.get("closing_time", ""),
            "working_days": data.get("working_days", []),
            "rating": 0.0,
            "average_rating": 0.0,
            "total_reviews": 0,
            "reputation_score": 0.0,
            "recommendation_score": 0.0,
            "is_verified": False,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        company_result = companies_collection.insert_one(company_doc)
        # MongoDB _id is always unique - use it as company_id
        company_id = str(company_result.inserted_id)
        
        # Set company_id field to the string representation of _id for easier lookups
        # This ensures every company has a unique ID
        companies_collection.update_one(
            {"_id": company_result.inserted_id},
            {"$set": {"company_id": company_id}},
        )
        
        # Verify the company_id was set correctly (MongoDB _id is always unique)
        # No need to verify - MongoDB guarantees uniqueness
        
        # Create token
        token = create_token(user_id, "company")
        
        # Log signup event
        events_collection.insert_one({
            "event_type": "company_signup",
            "company_id": company_id,
            "user_id": user_id,
            "company_name": name,
            "email": email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token,
                "company": {
                    "id": company_id,
                    "name": name,
                    "email": email,
                    "category": category,
                    "description": company_doc["description"],
                    "phone": company_doc["phone"],
                    "address": company_doc["address"],
                    "city": company_doc["city"],
                    "country": company_doc["country"],
                    "services": company_doc.get("services", []),
                    "opening_time": company_doc.get("opening_time", ""),
                    "closing_time": company_doc.get("closing_time", ""),
                    "working_days": company_doc.get("working_days", []),
                    "average_rating": 0.0,
                    "total_reviews": 0,
                    "is_verified": False,
                    "is_active": True,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class CompanyLoginView(APIView):
    """
    POST /api/company/login/
    Authenticates company user from MongoDB.
    """

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password", "")
        
        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        user_id = authenticate_user(email, password, user_type="company")
        if not user_id:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Get company profile
        company = companies_collection.find_one({"user_id": user_id})
        if not company:
            return Response(
                {"detail": "Company profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # Create token
        token = create_token(user_id, "company")
        
        # Log login event
        events_collection.insert_one({
            "event_type": "company_login",
            "company_id": company.get("company_id"),
            "user_id": user_id,
            "company_name": company.get("name"),
            "email": email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token,
                "company": {
                    "id": company.get("company_id"),
                    "name": company.get("name"),
                    "email": company.get("email"),
                    "category": company.get("category"),
                    "description": company.get("description"),
                    "phone": company.get("phone"),
                    "address": company.get("address"),
                    "city": company.get("city"),
                    "country": company.get("country"),
                    "services": company.get("services", []),
                    "opening_time": company.get("opening_time", ""),
                    "closing_time": company.get("closing_time", ""),
                    "working_days": company.get("working_days", []),
                    "average_rating": float(company.get("average_rating", 0.0)),
                    "total_reviews": int(company.get("total_reviews", 0)),
                    "is_verified": bool(company.get("is_verified", False)),
                    "is_active": bool(company.get("is_active", True)),
                },
            },
            status=status.HTTP_200_OK,
        )


class CompanyGoogleLoginView(APIView):
    """
    POST /api/company/google-login/
    Login or lightweight-signup a company account using a Google ID token.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        id_token_value = request.data.get("id_token", "")
        if not id_token_value:
            return Response(
                {"detail": "id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        info = _verify_google_token(id_token_value)
        if not info:
            return Response(
                {"detail": "Invalid Google ID token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = (info.get("email") or "").lower()
        display_name = info.get("name") or email.split("@")[0]

        if not email:
            return Response(
                {"detail": "Google account email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_user = get_user_by_email(email)
        if existing_user:
            if existing_user.get("user_type") != "company":
                return Response(
                    {"detail": "This email is already used for a different account type."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user_id = str(existing_user["_id"])
        else:
            random_password = secrets.token_urlsafe(16)
            user_id = create_user(
                email=email,
                password=random_password,
                user_type="company",
                google_sub=info.get("sub"),
            )

        # Ensure company profile exists (create a minimal one if needed)
        company = companies_collection.find_one({"user_id": user_id})
        if not company:
            company_doc = {
                "user_id": user_id,
                "name": display_name,
                "email": email,
                "category": "",
                "description": "",
                "phone": "",
                "address": "",
                "city": "",
                "country": "",
                "services": [],
                "opening_time": "",
                "closing_time": "",
                "working_days": [],
                "rating": 0.0,
                "average_rating": 0.0,
                "total_reviews": 0,
                "reputation_score": 0.0,
                "recommendation_score": 0.0,
                "is_verified": False,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            result = companies_collection.insert_one(company_doc)
            company_id = str(result.inserted_id)
            companies_collection.update_one(
                {"_id": result.inserted_id},
                {"$set": {"company_id": company_id}},
            )
            company_doc["company_id"] = company_id
            company = company_doc
        else:
            company_id = company.get("company_id") or str(company.get("_id"))

        token = create_token(user_id, "company")

        events_collection.insert_one(
            {
                "event_type": "company_google_login",
                "company_id": company_id,
                "user_id": user_id,
                "company_name": company.get("name"),
                "email": email,
                "timestamp": datetime.utcnow(),
            }
        )

        return Response(
            {
                "token": token,
                "company": {
                    "id": company_id,
                    "name": company.get("name"),
                    "email": company.get("email"),
                    "category": company.get("category", ""),
                    "description": company.get("description", ""),
                    "phone": company.get("phone", ""),
                    "address": company.get("address", ""),
                    "city": company.get("city", ""),
                    "country": company.get("country", ""),
                    "services": company.get("services", []),
                    "opening_time": company.get("opening_time", ""),
                    "closing_time": company.get("closing_time", ""),
                    "working_days": company.get("working_days", []),
                    "average_rating": float(company.get("average_rating", 0.0)),
                    "total_reviews": int(company.get("total_reviews", 0)),
                    "is_verified": bool(company.get("is_verified", False)),
                    "is_active": bool(company.get("is_active", True)),
                },
            },
            status=status.HTTP_200_OK,
        )


class CustomerSignupView(APIView):
    """
    POST /api/customer/signup/
    Creates customer user in MongoDB only.
    """

    def post(self, request, *args, **kwargs):
        data = request.data
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        location = (data.get("location") or "").strip()
        
        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check if email already exists
        if get_user_by_email(email):
            return Response(
                {"detail": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Create user in MongoDB (store basic profile + location on the user document as well)
        user_id = create_user(
            email=email,
            password=password,
            user_type="customer",
            first_name=first_name,
            last_name=last_name,
            location=location,
        )
        
        # Create customer profile (per-customer data for recommendations)
        customers_collection.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "location": location,
                "recently_viewed": [],  # list of company_ids
                "created_at": datetime.utcnow(),
            }
        )
        
        # Create token
        token = create_token(user_id, "customer")
        
        # Log signup event
        events_collection.insert_one({
            "event_type": "customer_signup",
            "user_id": user_id,
            "email": email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token,
                "user": {
                    "id": user_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "location": location,
                    "recently_viewed": [],
                },
            },
            status=status.HTTP_201_CREATED,
        )


class CustomerLoginView(APIView):
    """
    POST /api/customer/login/
    Authenticates customer user from MongoDB.
    """

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password", "")
        
        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        user_id = authenticate_user(email, password, user_type="customer")
        if not user_id:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        user = get_user_by_id(user_id)
        if not user:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get customer profile for recommendation-related fields
        customer_profile = customers_collection.find_one({"user_id": user_id}) or {}
        
        # Create token
        token = create_token(user_id, "customer")
        
        # Log login event
        events_collection.insert_one({
            "event_type": "customer_login",
            "user_id": user_id,
            "email": email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token,
                "user": {
                    "id": user_id,
                    "email": user.get("email"),
                    "first_name": user.get("first_name", ""),
                    "last_name": user.get("last_name", ""),
                    "location": customer_profile.get("location", ""),
                    "recently_viewed": customer_profile.get("recently_viewed", []),
                },
            },
            status=status.HTTP_200_OK,
        )


class CustomerGoogleLoginView(APIView):
    """
    POST /api/customer/google-login/
    Login or signup a customer using a Google ID token.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        id_token_value = request.data.get("id_token", "")
        if not id_token_value:
            return Response(
                {"detail": "id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        info = _verify_google_token(id_token_value)
        if not info:
            return Response(
                {"detail": "Invalid Google ID token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = (info.get("email") or "").lower()
        first_name = info.get("given_name") or ""
        last_name = info.get("family_name") or ""

        if not email:
            return Response(
                {"detail": "Google account email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_user = get_user_by_email(email)
        if existing_user:
            if existing_user.get("user_type") != "customer":
                return Response(
                    {"detail": "This email is already used for a different account type."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user_id = str(existing_user["_id"])
        else:
            random_password = secrets.token_urlsafe(16)
            user_id = create_user(
                email=email,
                password=random_password,
                user_type="customer",
                first_name=first_name,
                last_name=last_name,
                google_sub=info.get("sub"),
            )

        # Ensure customer profile exists (with recommendation-related fields)
        customer_doc = customers_collection.find_one({"user_id": user_id})
        if not customer_doc:
            customers_collection.insert_one(
                {
                    "user_id": user_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "location": "",
                    "recently_viewed": [],
                    "created_at": datetime.utcnow(),
                }
            )
            customer_doc = customers_collection.find_one({"user_id": user_id})
        else:
            # Backfill new fields if missing on existing users
            updates = {}
            if "location" not in customer_doc:
                updates["location"] = ""
            if "recently_viewed" not in customer_doc:
                updates["recently_viewed"] = []
            if updates:
                customers_collection.update_one({"user_id": user_id}, {"$set": updates})
                customer_doc.update(updates)

        token = create_token(user_id, "customer")

        events_collection.insert_one(
            {
                "event_type": "customer_google_login",
                "user_id": user_id,
                "email": email,
                "timestamp": datetime.utcnow(),
            }
        )

        return Response(
            {
                "token": token,
                "user": {
                    "id": user_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "location": customer_doc.get("location", ""),
                    "recently_viewed": customer_doc.get("recently_viewed", []),
                },
            },
            status=status.HTTP_200_OK,
        )


class MongoCompanyListView(APIView):
    """
    GET /api/mongo/companies/
    Returns all companies from MongoDB.
    """

    def get(self, request, *args, **kwargs):
        docs = list(
            companies_collection.find(
                {"is_active": True},
            ).sort("average_rating", -1)
        )
        
        results = []
        for doc in docs:
            # Always use MongoDB _id as the primary identifier (guaranteed unique)
            company_id = doc.get("company_id") or str(doc.get("_id"))
            # Ensure company_id is set if missing (for backward compatibility with old data)
            if not doc.get("company_id"):
                companies_collection.update_one(
                    {"_id": doc.get("_id")},
                    {"$set": {"company_id": company_id}},
                )
            results.append({
                "id": company_id,
                "name": doc.get("name", ""),
                "email": doc.get("email", ""),
                "category": doc.get("category", ""),
                "description": doc.get("description", ""),
                "phone": doc.get("phone", ""),
                "address": doc.get("address", ""),
                "city": doc.get("city", ""),
                "country": doc.get("country", ""),
                "rating": float(doc.get("rating", 0.0) or 0.0),
                "average_rating": float(doc.get("average_rating", 0.0) or 0.0),
                "total_reviews": int(doc.get("total_reviews", 0) or 0),
                "is_verified": bool(doc.get("is_verified", False)),
                "is_active": bool(doc.get("is_active", True)),
            })
        
        return Response({"companies": results}, status=status.HTTP_200_OK)


class CompanyRatingView(APIView):
    """
    POST /api/company/<company_id>/rate/
    GET  /api/company/<company_id>/rate/
    """
    # Disable DRF's default authentication for this view
    authentication_classes = []
    permission_classes = []

    def _get_authenticated_customer(self, request):
        return _get_auth_user(request, user_type="customer")

    def get(self, request, company_id, *args, **kwargs):
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        customer = self._get_authenticated_customer(request)
        my_rating_value = None
        
        if customer:
            # Use string representation of user_id for consistency
            user_id_str = str(customer["_id"])
            # Try both ObjectId and string formats for backward compatibility
            doc = ratings_collection.find_one({
                "company_id": company_id,
                "$or": [
                    {"user_id": user_id_str},
                    {"user_id": customer["_id"]},
                ]
            })
            if doc and "rating" in doc:
                try:
                    my_rating_value = float(doc.get("rating"))
                except (TypeError, ValueError):
                    my_rating_value = None
        
        # Calculate reputation score if missing or 0
        reputation_score = company.get("reputation_score")
        if reputation_score is None or reputation_score == 0.0:
            reputation_score = calculate_reputation_score(company_id)
            if reputation_score > 0:
                companies_collection.update_one(
                    {"company_id": company_id},
                    {"$set": {"reputation_score": reputation_score}}
                )
        
        return Response({
            "company": {
                "id": company.get("company_id"),
                "name": company.get("name"),
                "average_rating": float(company.get("average_rating", 0.0)),
                "total_reviews": int(company.get("total_reviews", 0)),
                "reputation_score": float(reputation_score or 0.0),
            },
            "my_rating": my_rating_value,
        })

    def post(self, request, company_id, *args, **kwargs):
        customer = self._get_authenticated_customer(request)
        if not customer:
            return Response(
                {"detail": "Authentication as a customer is required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        rating_value = request.data.get("rating")
        try:
            rating_value = float(rating_value)
        except (TypeError, ValueError):
            return Response(
                {"detail": "Rating must be a number between 1.0 and 5.0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if rating_value < 1.0 or rating_value > 5.0:
            return Response(
                {"detail": "Rating must be between 1.0 and 5.0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Use update_one with upsert to handle both insert and update
        # This avoids duplicate key errors and allows users to update their rating
        user_id_str = str(customer["_id"])
        now = datetime.utcnow()
        
        # Check if rating already exists to determine if this is an update or insert
        existing = ratings_collection.find_one({
            "company_id": company_id,
            "user_id": user_id_str,
        })
        
        # Use upsert to insert or update
        ratings_collection.update_one(
            {
                "company_id": company_id,
                "user_id": user_id_str,
            },
            {
                "$set": {
                    "rating": rating_value,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                }
            },
            upsert=True
        )
        
        # Recalculate aggregates
        pipeline = [
            {"$match": {"company_id": company_id}},
            {
                "$group": {
                    "_id": None,
                    "avg_rating": {"$avg": "$rating"},
                    "count": {"$sum": 1},
                }
            },
        ]
        agg_result = list(ratings_collection.aggregate(pipeline))
        if agg_result:
            avg_rating = float(agg_result[0].get("avg_rating", 0.0))
            count = int(agg_result[0].get("count", 0))
        else:
            avg_rating = 0.0
            count = 0
        
        # Calculate reputation score
        reputation_score = calculate_reputation_score(company_id)
        
        # Update company
        companies_collection.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "average_rating": avg_rating,
                    "rating": avg_rating,
                    "total_reviews": count,
                    "reputation_score": reputation_score,
                    "updated_at": now,
                }
            },
        )
        
        return Response({
            "company": {
                "id": company_id,
                "name": company.get("name"),
                "average_rating": avg_rating,
                "total_reviews": count,
                "reputation_score": reputation_score,
            },
            "my_rating": rating_value,
        })


class CompanyCommentView(APIView):
    """
    GET  /api/company/<company_id>/comments/
    POST /api/company/<company_id>/comments/
    """
    # Disable DRF's default authentication for this view
    authentication_classes = []
    permission_classes = []

    def _get_authenticated_customer(self, request):
        return _get_auth_user(request, user_type="customer")

    def get(self, request, company_id, *args, **kwargs):
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        cursor = comments_collection.find({"company_id": company_id}).sort("created_at", -1)
        comments = []
        for doc in cursor:
            comments.append({
                "comment": doc.get("comment", ""),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
                "customer": {
                    "id": str(doc.get("user_id")),
                    "name": doc.get("customer_name", "Anonymous"),
                    "email": doc.get("customer_email", ""),
                },
            })
        
        return Response({"comments": comments})

    def post(self, request, company_id, *args, **kwargs):
        customer = self._get_authenticated_customer(request)
        if not customer:
            return Response(
                {"detail": "Authentication as a customer is required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        text = (request.data.get("comment") or "").strip()
        if not text:
            return Response(
                {"detail": "Comment cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(text) > 2000:
            return Response(
                {"detail": "Comment is too long (max 2000 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        now = datetime.utcnow()
        customer_name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip() or customer.get("email", "Anonymous")
        
        comments_collection.insert_one({
            "company_id": company_id,
            "user_id": customer["_id"],
            "comment": text,
            "customer_name": customer_name,
            "customer_email": customer.get("email", ""),
            "created_at": now,
            "updated_at": now,
        })
        
        events_collection.insert_one({
            "event_type": "company_comment_added",
            "company_id": company_id,
            "user_id": str(customer["_id"]),
            "timestamp": now,
        })
        
        return Response({"detail": "Comment added."}, status=status.HTTP_201_CREATED)


class CompanySearchView(APIView):
    """GET /api/company/search/"""

    # Public endpoint – we handle customer auth manually for search history only
    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        q = (request.GET.get("q") or "").strip()
        category = (request.GET.get("category") or "").strip()
        city = (request.GET.get("city") or "").strip()
        country = (request.GET.get("country") or "").strip()
        
        query = {"is_active": True}
        if q:
            query["name"] = {"$regex": q, "$options": "i"}
        if category:
            query["category"] = {"$regex": category, "$options": "i"}
        if city:
            query["city"] = {"$regex": city, "$options": "i"}
        if country:
            query["country"] = {"$regex": country, "$options": "i"}

        # Log search history for authenticated customers (for recommendations)
        customer = _get_auth_user(request, user_type="customer")
        if customer and (q or category):
            try:
                search_history_collection.insert_one(
                    {
                        "user_id": str(customer["_id"]),
                        "query": q,
                        "category": category,
                        "timestamp": datetime.utcnow(),
                    }
                )
            except Exception:
                # Don't break search if logging fails
                pass
        
        docs = list(
            companies_collection.find(query)
            .sort([("average_rating", -1), ("name", 1)])
            .limit(200)
        )
        
        results = []
        for doc in docs:
            company_id = doc.get("company_id") or str(doc.get("_id"))
            reputation_score = doc.get("reputation_score")
            # Calculate if missing or 0
            if reputation_score is None or reputation_score == 0.0:
                reputation_score = calculate_reputation_score(company_id)
                if reputation_score > 0:
                    companies_collection.update_one(
                        {"company_id": company_id},
                        {"$set": {"reputation_score": reputation_score}}
                    )
            
            results.append({
                "id": company_id,
                "name": doc.get("name", ""),
                "email": doc.get("email", ""),
                "category": doc.get("category", ""),
                "description": doc.get("description", ""),
                "city": doc.get("city", ""),
                "country": doc.get("country", ""),
                "average_rating": float(doc.get("average_rating", 0.0)),
                "total_reviews": int(doc.get("total_reviews", 0)),
                "reputation_score": float(reputation_score or 0.0),
            })
        
        return Response({"results": results})


class TopBusinessesView(APIView):
    """GET /api/company/top/"""

    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.GET.get("limit", 5))
        except ValueError:
            limit = 5
        
        # Get distinct categories
        categories = companies_collection.distinct("category", {"is_active": True})
        
        data = {}
        for cat in categories:
            top = list(
                companies_collection.find(
                    {"is_active": True, "category": cat}
                )
                .sort([("average_rating", -1), ("total_reviews", -1), ("name", 1)])
                .limit(limit)
            )
            
            data[cat] = []
            for doc in top:
                company_id = doc.get("company_id") or str(doc.get("_id"))
                reputation_score = doc.get("reputation_score")
                # Calculate if missing or 0
                if reputation_score is None or reputation_score == 0.0:
                    reputation_score = calculate_reputation_score(company_id)
                    if reputation_score > 0:
                        companies_collection.update_one(
                            {"company_id": company_id},
                            {"$set": {"reputation_score": reputation_score}}
                        )
                
                data[cat].append({
                    "id": company_id,
                    "name": doc.get("name", ""),
                    "category": doc.get("category", ""),
                    "average_rating": float(doc.get("average_rating", 0.0)),
                    "total_reviews": int(doc.get("total_reviews", 0)),
                    "reputation_score": float(reputation_score or 0.0),
                })
        
        return Response({"top_by_category": data})


class RecommendationsView(APIView):
    """
    GET /api/company/recommendations/

    ML-powered personalized recommendations:
    - User-user collaborative filtering: "similar users liked this business" (e.g. User1
      interested in Dairy A → recommend Dairy A to User2 who is also into dairy but
      hasn't seen Dairy A). Uses ratings, recently_viewed, search history, location.
    - Falls back to content-based (recently viewed, search history, location, reputation)
      when no similar users or to fill remaining slots.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        category_filter = (request.GET.get("category") or "").strip()
        q_filter = (request.GET.get("q") or "").strip()
        city_filter = (request.GET.get("city") or "").strip()
        country_filter = (request.GET.get("country") or "").strip()

        # Always cap to 10 for the UI, even if a higher limit is requested
        try:
            limit = min(int(request.GET.get("limit", 10)), 10)
        except ValueError:
            limit = 10

        # Build base company query (public filters)
        base_query = {"is_active": True}
        if category_filter:
            base_query["category"] = {"$regex": category_filter, "$options": "i"}
        if q_filter:
            base_query["name"] = {"$regex": q_filter, "$options": "i"}
        if city_filter:
            base_query["city"] = {"$regex": city_filter, "$options": "i"}
        if country_filter:
            base_query["country"] = {"$regex": country_filter, "$options": "i"}

        # Fetch a reasonable pool of candidates
        candidate_docs = list(
            companies_collection.find(base_query)
            .sort([("reputation_score", -1), ("average_rating", -1), ("name", 1)])
            .limit(200)
        )

        # If no candidates, just return empty
        if not candidate_docs:
            return Response({"recommendations": []})

        # Build id -> doc map for candidates
        candidate_by_id = {}
        for doc in candidate_docs:
            cid = doc.get("company_id") or str(doc.get("_id"))
            candidate_by_id[cid] = doc

        # Try to get the authenticated customer for personalization
        customer = _get_auth_user(request, user_type="customer")

        # If no customer, fall back to simple reputation-based sort
        if not customer:
            recommendations = []
            for doc in candidate_docs[:limit]:
                company_id = doc.get("company_id") or str(doc.get("_id"))
                reputation_score = doc.get("reputation_score")
                if reputation_score is None or reputation_score == 0.0:
                    reputation_score = calculate_reputation_score(company_id)
                recommendations.append(
                    {
                        "id": company_id,
                        "name": doc.get("name", ""),
                        "category": doc.get("category", ""),
                        "city": doc.get("city", ""),
                        "country": doc.get("country", ""),
                        "average_rating": float(doc.get("average_rating", 0.0)),
                        "total_reviews": int(doc.get("total_reviews", 0)),
                        "reputation_score": float(reputation_score or 0.0),
                        "score": float(reputation_score or 0.0),
                    }
                )
            return Response({"recommendations": recommendations})

        user_id = str(customer["_id"])

        # ---- ML: similar-users recommendation (businesses similar users liked that this user hasn't seen) ----
        candidate_ids = list(candidate_by_id.keys())
        try:
            ml_recs = recommend_businesses_ml(
                current_user_id=user_id,
                ratings_collection=ratings_collection,
                search_history_collection=search_history_collection,
                customers_collection=customers_collection,
                companies_collection=companies_collection,
                limit=limit,
                candidate_company_ids=candidate_ids,
                base_query=base_query,
            )
        except Exception:
            ml_recs = []

        # Build response: ML results first (with full company fields)
        recommendations = []
        used_ids = set()
        for item in ml_recs:
            cid = item.get("company_id")
            if not cid or cid in used_ids or cid not in candidate_by_id:
                continue
            used_ids.add(cid)
            doc = candidate_by_id[cid]
            reputation_score = doc.get("reputation_score")
            if reputation_score is None or reputation_score == 0.0:
                reputation_score = calculate_reputation_score(cid)
            recommendations.append({
                "id": cid,
                "name": doc.get("name", ""),
                "category": doc.get("category", ""),
                "city": doc.get("city", ""),
                "country": doc.get("country", ""),
                "average_rating": float(doc.get("average_rating", 0.0)),
                "total_reviews": int(doc.get("total_reviews", 0)),
                "reputation_score": float(reputation_score or 0.0),
                "score": round(float(item.get("score", 0)) * 100.0, 2),
            })

        # ---- Fill remaining slots with content-based (recently viewed, search history, location, reputation) ----
        if len(recommendations) < limit:
            customer_profile = customers_collection.find_one({"user_id": user_id}) or {}
            customer_location = (customer_profile.get("location") or "").lower()
            recently_viewed = customer_profile.get("recently_viewed", []) or []

            recently_weight_map = {}
            if recently_viewed:
                n = len(recently_viewed)
                for idx, cid in enumerate(recently_viewed):
                    recently_weight_map[str(cid)] = (n - idx) / float(n)

            last_viewed_category = None
            if recently_viewed:
                last_id = recently_viewed[0]
                last_doc = companies_collection.find_one({"company_id": last_id}) or companies_collection.find_one({"_id": ObjectId(last_id)})
                if last_doc:
                    last_viewed_category = (last_doc.get("category") or "").lower()

            category_interest = {}
            for idx, sh in enumerate(search_history_collection.find({"user_id": user_id}).sort("timestamp", -1).limit(100)):
                cat = (sh.get("category") or "").strip().lower()
                if cat:
                    category_interest[cat] = category_interest.get(cat, 0.0) + 1.0 / (1.0 + idx)
            if category_interest:
                max_cat = max(category_interest.values())
                if max_cat > 0:
                    category_interest = {k: v / max_cat for k, v in category_interest.items()}

            # Score only candidates not already in recommendations
            fallback_docs = [d for d in candidate_docs if (d.get("company_id") or str(d.get("_id"))) not in used_ids]
            scored = []
            for doc in fallback_docs:
                company_id = doc.get("company_id") or str(doc.get("_id"))
                category = (doc.get("category") or "").lower()
                city = (doc.get("city") or "").lower()
                country = (doc.get("country") or "").lower()

                rv_score = recently_weight_map.get(company_id, 0.0)
                sh_score = category_interest.get(category, 0.0)
                loc_score = 0.0
                if customer_location:
                    if city and (city in customer_location or customer_location in city):
                        loc_score = 1.0
                    elif country and (country in customer_location or customer_location in country):
                        loc_score = 0.7

                reputation_score = doc.get("reputation_score")
                if reputation_score is None or reputation_score == 0.0:
                    reputation_score = calculate_reputation_score(company_id)
                rep_norm = max(0.0, min(1.0, float(reputation_score or 0.0) / 100.0))

                base_score = 0.4 * rv_score + 0.3 * sh_score + 0.2 * loc_score + 0.1 * rep_norm
                if last_viewed_category and category == last_viewed_category:
                    base_score += 0.05

                scored.append((doc, company_id, base_score, reputation_score))

            scored.sort(key=lambda x: x[2], reverse=True)
            need = limit - len(recommendations)
            for doc, company_id, base_score, reputation_score in scored[:need]:
                recommendations.append({
                    "id": company_id,
                    "name": doc.get("name", ""),
                    "category": doc.get("category", ""),
                    "city": doc.get("city", ""),
                    "country": doc.get("country", ""),
                    "average_rating": float(doc.get("average_rating", 0.0)),
                    "total_reviews": int(doc.get("total_reviews", 0)),
                    "reputation_score": float(reputation_score or 0.0),
                    "score": round(base_score * 100.0, 2),
                })

        return Response({"recommendations": recommendations[:limit]})


class CompanyMeView(APIView):
    """GET/PATCH /api/company/me/"""
    # Disable DRF's default authentication for this view
    authentication_classes = []
    permission_classes = []

    editable_fields = [
        "name",
        "description",
        "category",
        "email",
        "phone",
        "address",
        "city",
        "country",
        # New editable business info
        "services",
        "opening_time",
        "closing_time",
        "working_days",
    ]

    def _get_company(self, request):
        user = _get_auth_user(request, user_type="company")
        if not user:
            return None
        
        company = companies_collection.find_one({"user_id": str(user["_id"])})
        return company

    def get(self, request, *args, **kwargs):
        company = self._get_company(request)
        if not company:
            return Response(
                {"detail": "Company authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        company_id = company.get("company_id") or str(company.get("_id"))
        
        # Calculate reputation score if missing or 0 (for existing companies)
        reputation_score = company.get("reputation_score")
        if reputation_score is None or reputation_score == 0.0:
            reputation_score = calculate_reputation_score(company_id)
            # Update the company with the calculated score
            if reputation_score > 0:
                companies_collection.update_one(
                    {"company_id": company_id},
                    {"$set": {"reputation_score": reputation_score}}
                )
        
        return Response({
            "id": company_id,
            "name": company.get("name", ""),
            "email": company.get("email", ""),
            "category": company.get("category", ""),
            "description": company.get("description", ""),
            "phone": company.get("phone", ""),
            "address": company.get("address", ""),
            "city": company.get("city", ""),
            "country": company.get("country", ""),
            "services": company.get("services", []),
            "opening_time": company.get("opening_time", ""),
            "closing_time": company.get("closing_time", ""),
            "working_days": company.get("working_days", []),
            "average_rating": float(company.get("average_rating", 0.0)),
            "total_reviews": int(company.get("total_reviews", 0)),
            "reputation_score": float(reputation_score or 0.0),
            "is_verified": bool(company.get("is_verified", False)),
            "is_active": bool(company.get("is_active", True)),
        })

    def patch(self, request, *args, **kwargs):
        company = self._get_company(request)
        if not company:
            return Response(
                {"detail": "Company authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        updates = {}
        for field in self.editable_fields:
            if field in request.data:
                updates[field] = request.data[field]
        
        if updates:
            updates["updated_at"] = datetime.utcnow()
            companies_collection.update_one(
                {"company_id": company.get("company_id")},
                {"$set": updates},
            )
        
        # Return updated company
        updated = companies_collection.find_one({"company_id": company.get("company_id")})
        return Response({
            "id": updated.get("company_id") or str(updated.get("_id")),
            "name": updated.get("name", ""),
            "email": updated.get("email", ""),
            "category": updated.get("category", ""),
            "description": updated.get("description", ""),
            "phone": updated.get("phone", ""),
            "address": updated.get("address", ""),
            "city": updated.get("city", ""),
            "country": updated.get("country", ""),
            "services": updated.get("services", []),
            "opening_time": updated.get("opening_time", ""),
            "closing_time": updated.get("closing_time", ""),
            "working_days": updated.get("working_days", []),
            "average_rating": float(updated.get("average_rating", 0.0)),
            "total_reviews": int(updated.get("total_reviews", 0)),
            "is_verified": bool(updated.get("is_verified", False)),
            "is_active": bool(updated.get("is_active", True)),
        })


class CompanyFeedbackView(APIView):
    """GET /api/company/me/feedback/"""
    # Disable DRF's default authentication for this view
    authentication_classes = []
    permission_classes = []

    POSITIVE_WORDS = {
        "good", "great", "excellent", "amazing", "fast",
        "helpful", "friendly", "recommend", "satisfied", "happy",
    }
    NEGATIVE_WORDS = {
        "bad", "poor", "terrible", "slow", "rude",
        "disappoint", "issue", "problem", "unhappy",
    }

    def _get_company(self, request):
        user = _get_auth_user(request, user_type="company")
        if not user:
            return None
        return companies_collection.find_one({"user_id": str(user["_id"])})

    def _sentiment_score(self, text: str) -> float:
        if not text:
            return 0.0
        s = text.lower()
        pos = sum(1 for w in self.POSITIVE_WORDS if w in s)
        neg = sum(1 for w in self.NEGATIVE_WORDS if w in s)
        if pos == 0 and neg == 0:
            return 0.0
        return (pos - neg) / (pos + neg)

    def get(self, request, *args, **kwargs):
        company = self._get_company(request)
        if not company:
            return Response(
                {"detail": "Company authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        company_id = company.get("company_id")
        
        # Ratings from MongoDB
        rating_docs = list(ratings_collection.find({"company_id": company_id}))
        total_reviews = len(rating_docs)
        avg_rating = (
            sum(float(doc.get("rating", 0) or 0) for doc in rating_docs) / total_reviews
            if total_reviews > 0
            else 0.0
        )
        
        # Comments
        comment_docs = list(
            comments_collection.find({"company_id": company_id}).sort("created_at", -1)
        )
        
        feedback = {
            "ratings": [
                {
                    "user_id": str(doc.get("user_id")),
                    "rating": float(doc.get("rating", 0) or 0),
                    "created_at": doc.get("created_at"),
                }
                for doc in rating_docs
            ],
            "comments": [
                {
                    "user_id": str(doc.get("user_id")),
                    "comment": doc.get("comment", ""),
                    "created_at": doc.get("created_at"),
                    "sentiment": self._sentiment_score(doc.get("comment", "")),
                }
                for doc in comment_docs
            ],
        }
        
        # Calculate reputation score
        reputation_score = calculate_reputation_score(company_id)
        
        # Update company stats
        companies_collection.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "average_rating": avg_rating,
                    "total_reviews": total_reviews,
                    "reputation_score": reputation_score,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        
        return Response({
            "company": {
                "id": company_id,
                "name": company.get("name", ""),
                "average_rating": avg_rating,
                "total_reviews": total_reviews,
            },
            "average_sentiment": 0.0,
            "reputation_score": reputation_score,
            "feedback": feedback,
        })


class CustomerMeView(APIView):
    """
    GET /api/customer/me/
    PATCH /api/customer/me/
    View and update the logged-in customer's profile (name, location, etc.).
    """

    authentication_classes = []
    permission_classes = []

    editable_fields = [
        "first_name",
        "last_name",
        "location",
    ]

    def _get_customer(self, request):
        user = _get_auth_user(request, user_type="customer")
        if not user:
            return None, None
        user_id = str(user["_id"])
        profile = customers_collection.find_one({"user_id": user_id})
        return user, profile

    def get(self, request, *args, **kwargs):
        user, profile = self._get_customer(request)
        if not user:
            return Response(
                {"detail": "Customer authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_id = str(user["_id"])

        if not profile:
            profile = {
                "user_id": user_id,
                "email": user.get("email", ""),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "location": user.get("location", ""),
                "recently_viewed": [],
                "created_at": datetime.utcnow(),
            }
            customers_collection.insert_one(profile)

        return Response(
            {
                "id": user_id,
                "email": profile.get("email", user.get("email", "")),
                "first_name": profile.get("first_name", user.get("first_name", "")),
                "last_name": profile.get("last_name", user.get("last_name", "")),
                "location": profile.get("location", user.get("location", "")),
                "recently_viewed": profile.get("recently_viewed", []),
            }
        )

    def patch(self, request, *args, **kwargs):
        user, profile = self._get_customer(request)
        if not user:
            return Response(
                {"detail": "Customer authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_id = str(user["_id"])

        if not profile:
            profile = {
                "user_id": user_id,
                "email": user.get("email", ""),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "location": user.get("location", ""),
                "recently_viewed": [],
                "created_at": datetime.utcnow(),
            }
            customers_collection.insert_one(profile)

        updates = {}
        for field in self.editable_fields:
            if field in request.data:
                updates[field] = request.data[field]

        if updates:
            updates["updated_at"] = datetime.utcnow()
            customers_collection.update_one(
                {"user_id": user_id},
                {"$set": updates},
            )
            # Also update the unified users collection for consistency
            users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {k: v for k, v in updates.items() if k in ["first_name", "last_name", "location"]}},
            )

        updated = customers_collection.find_one({"user_id": user_id}) or profile

        return Response(
            {
                "id": user_id,
                "email": updated.get("email", user.get("email", "")),
                "first_name": updated.get("first_name", user.get("first_name", "")),
                "last_name": updated.get("last_name", user.get("last_name", "")),
                "location": updated.get("location", user.get("location", "")),
                "recently_viewed": updated.get("recently_viewed", []),
            }
        )


class CompanyDetailView(APIView):
    """
    GET /api/company/<company_id>/
    Returns a single company's details from MongoDB.
    """
    # Public endpoint – we use our own lightweight token parsing for recently_viewed
    authentication_classes = []
    permission_classes = []

    def get(self, request, company_id, *args, **kwargs):
        # Try finding by company_id first
        company = companies_collection.find_one({"company_id": company_id})
        if not company:
            # Try finding by _id if company_id doesn't work (for backward compatibility)
            try:
                company = companies_collection.find_one({"_id": ObjectId(company_id)})
                # If found by _id but company_id is missing, set it
                if company and not company.get("company_id"):
                    companies_collection.update_one(
                        {"_id": company.get("_id")},
                        {"$set": {"company_id": str(company.get("_id"))}},
                    )
                    company["company_id"] = str(company.get("_id"))
            except Exception:
                pass
        
        if not company:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # Always use MongoDB _id as the primary identifier (guaranteed unique)
        final_company_id = company.get("company_id") or str(company.get("_id"))
        
        # Calculate reputation score if missing or 0 (for existing companies)
        reputation_score = company.get("reputation_score")
        if reputation_score is None or reputation_score == 0.0:
            reputation_score = calculate_reputation_score(final_company_id)
            # Update the company with the calculated score
            if reputation_score > 0:
                companies_collection.update_one(
                    {"company_id": final_company_id},
                    {"$set": {"reputation_score": reputation_score}}
                )

        # If a customer is logged in, update their recently_viewed list
        customer = _get_auth_user(request, user_type="customer")
        if customer:
            user_id = str(customer["_id"])
            # Ensure profile exists
            profile = customers_collection.find_one({"user_id": user_id})
            if not profile:
                profile = {
                    "user_id": user_id,
                    "email": customer.get("email", ""),
                    "first_name": customer.get("first_name", ""),
                    "last_name": customer.get("last_name", ""),
                    "location": customer.get("location", ""),
                    "recently_viewed": [],
                    "created_at": datetime.utcnow(),
                }
                customers_collection.insert_one(profile)

            # Remove existing occurrences of this company_id then push to front, keep last 5
            customers_collection.update_one(
                {"user_id": user_id},
                {"$pull": {"recently_viewed": final_company_id}},
            )
            customers_collection.update_one(
                {"user_id": user_id},
                {
                    "$push": {
                        "recently_viewed": {
                            "$each": [final_company_id],
                            "$position": 0,
                             "$slice": 5,
                        }
                    }
                },
            )
        
        return Response({
            "id": final_company_id,
            "name": company.get("name", ""),
            "email": company.get("email", ""),
            "category": company.get("category", ""),
            "description": company.get("description", ""),
            "phone": company.get("phone", ""),
            "address": company.get("address", ""),
            "city": company.get("city", ""),
            "country": company.get("country", ""),
            "services": company.get("services", []),
            "opening_time": company.get("opening_time", ""),
            "closing_time": company.get("closing_time", ""),
            "working_days": company.get("working_days", []),
            "rating": float(company.get("rating", 0.0) or 0.0),
            "average_rating": float(company.get("average_rating", 0.0) or 0.0),
            "total_reviews": int(company.get("total_reviews", 0) or 0),
            "reputation_score": float(reputation_score or 0.0),
            "recommendation_score": float(company.get("recommendation_score", 0.0) or 0.0),
            "is_verified": bool(company.get("is_verified", False)),
            "is_active": bool(company.get("is_active", True)),
        })

