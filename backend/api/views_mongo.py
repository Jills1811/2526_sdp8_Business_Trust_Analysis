"""
All views rewritten to use MongoDB only - no Django models.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime
from bson import ObjectId

from .mongo_auth import (
    create_user,
    authenticate_user,
    create_token,
    verify_token,
    get_user_by_id,
    get_user_by_email,
    delete_token,
)
from .db_mongo import (
    companies_collection,
    customers_collection,
    events_collection,
    ratings_collection,
    comments_collection,
)


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
        
        # Create user in MongoDB
        user_id = create_user(
            email=email,
            password=password,
            user_type="customer",
            first_name=first_name,
            last_name=last_name,
        )
        
        # Create customer profile
        customers_collection.insert_one({
            "user_id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "created_at": datetime.utcnow(),
        })
        
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
        
        return Response({
            "company": {
                "id": company.get("company_id"),
                "name": company.get("name"),
                "average_rating": float(company.get("average_rating", 0.0)),
                "total_reviews": int(company.get("total_reviews", 0)),
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
        
        # Check if already rated
        user_id_str = str(customer["_id"])
        existing = ratings_collection.find_one({
            "company_id": company_id,
            "user_id": user_id_str,
        })
        if existing:
            return Response(
                {"detail": "You have already rated this company."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Create rating
        now = datetime.utcnow()
        ratings_collection.insert_one({
            "company_id": company_id,
            "user_id": user_id_str,
            "rating": rating_value,
            "created_at": now,
            "updated_at": now,
        })
        
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
        
        # Update company
        companies_collection.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "average_rating": avg_rating,
                    "rating": avg_rating,
                    "total_reviews": count,
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
        
        docs = list(
            companies_collection.find(query)
            .sort([("average_rating", -1), ("name", 1)])
            .limit(200)
        )
        
        results = []
        for doc in docs:
            results.append({
                "id": doc.get("company_id") or str(doc.get("_id")),
                "name": doc.get("name", ""),
                "email": doc.get("email", ""),
                "category": doc.get("category", ""),
                "description": doc.get("description", ""),
                "city": doc.get("city", ""),
                "country": doc.get("country", ""),
                "average_rating": float(doc.get("average_rating", 0.0)),
                "total_reviews": int(doc.get("total_reviews", 0)),
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
            
            data[cat] = [
                {
                    "id": doc.get("company_id") or str(doc.get("_id")),
                    "name": doc.get("name", ""),
                    "category": doc.get("category", ""),
                    "average_rating": float(doc.get("average_rating", 0.0)),
                    "total_reviews": int(doc.get("total_reviews", 0)),
                }
                for doc in top
            ]
        
        return Response({"top_by_category": data})


class RecommendationsView(APIView):
    """GET /api/company/recommendations/"""

    def get(self, request, *args, **kwargs):
        category = (request.GET.get("category") or "").strip()
        q = (request.GET.get("q") or "").strip()
        city = (request.GET.get("city") or "").strip()
        country = (request.GET.get("country") or "").strip()
        try:
            limit = int(request.GET.get("limit", 10))
        except ValueError:
            limit = 10
        
        query = {"is_active": True}
        if category:
            query["category"] = {"$regex": category, "$options": "i"}
        if q:
            query["name"] = {"$regex": q, "$options": "i"}
        if city:
            query["city"] = {"$regex": city, "$options": "i"}
        if country:
            query["country"] = {"$regex": country, "$options": "i"}
        
        docs = list(
            companies_collection.find(query)
            .sort([("reputation_score", -1), ("average_rating", -1), ("name", 1)])
            .limit(limit)
        )
        
        recommendations = []
        for doc in docs:
            recommendations.append({
                "id": doc.get("company_id") or str(doc.get("_id")),
                "name": doc.get("name", ""),
                "category": doc.get("category", ""),
                "average_rating": float(doc.get("average_rating", 0.0)),
                "total_reviews": int(doc.get("total_reviews", 0)),
                "reputation_score": float(doc.get("reputation_score", 0.0)),
            })
        
        return Response({"recommendations": recommendations})


class CompanyMeView(APIView):
    """GET/PATCH /api/company/me/"""

    editable_fields = [
        "name",
        "description",
        "category",
        "email",
        "phone",
        "address",
        "city",
        "country",
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
        
        return Response({
            "id": company.get("company_id") or str(company.get("_id")),
            "name": company.get("name", ""),
            "email": company.get("email", ""),
            "category": company.get("category", ""),
            "description": company.get("description", ""),
            "phone": company.get("phone", ""),
            "address": company.get("address", ""),
            "city": company.get("city", ""),
            "country": company.get("country", ""),
            "average_rating": float(company.get("average_rating", 0.0)),
            "total_reviews": int(company.get("total_reviews", 0)),
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
            "average_rating": float(updated.get("average_rating", 0.0)),
            "total_reviews": int(updated.get("total_reviews", 0)),
            "is_verified": bool(updated.get("is_verified", False)),
            "is_active": bool(updated.get("is_active", True)),
        })


class CompanyFeedbackView(APIView):
    """GET /api/company/me/feedback/"""

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
        
        # Update company stats
        companies_collection.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "average_rating": avg_rating,
                    "total_reviews": total_reviews,
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
            "reputation_score": 0.0,
            "feedback": feedback,
        })


class CompanyDetailView(APIView):
    """
    GET /api/company/<company_id>/
    Returns a single company's details from MongoDB.
    """

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
            "rating": float(company.get("rating", 0.0) or 0.0),
            "average_rating": float(company.get("average_rating", 0.0) or 0.0),
            "total_reviews": int(company.get("total_reviews", 0) or 0),
            "reputation_score": float(company.get("reputation_score", 0.0) or 0.0),
            "recommendation_score": float(company.get("recommendation_score", 0.0) or 0.0),
            "is_verified": bool(company.get("is_verified", False)),
            "is_active": bool(company.get("is_active", True)),
        })

