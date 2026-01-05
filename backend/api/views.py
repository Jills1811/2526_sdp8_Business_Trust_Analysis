from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime
import math

from .models import Company
from .serializers import (
    CompanySerializer,
    CompanySignupSerializer,
    CompanyLoginSerializer,
    CustomerSignupSerializer,
    CustomerLoginSerializer,
)
from django.contrib.auth.models import User

# MongoDB collections
from .db_mongo import (
    companies_collection,
    customers_collection,
    events_collection,
    ratings_collection,
    comments_collection,
)


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer


class CompanySignupView(APIView):
    """
    POST /api/company/signup/

    Creates:
    - Django User (authentication)
    - Django Company (auth relation)
    - MongoDB Company document (profile data)
    """

    def post(self, request, *args, **kwargs):
        print("🔥 CompanySignupView HIT")

        serializer = CompanySignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 🔹 Save to Django DB
        company = serializer.save()
        user = company.owner

        # 🔹 Create auth token
        token, _ = Token.objects.get_or_create(user=user)

        # 🔹 Save full company profile to MongoDB
        print("🔥 Inserting company into MongoDB")
        companies_collection.insert_one({
            "django_company_id": company.id,
            "name": company.name,
            "email": company.email,
            "category": company.category,
            "description": company.description,
            "phone": company.phone,
            "address": company.address,
            "city": company.city,
            "country": company.country,
            "rating": company.rating,
            "average_rating": company.average_rating,
            "total_reviews": company.total_reviews,
            "is_verified": company.is_verified,
            "is_active": company.is_active,
            "created_at": datetime.utcnow(),
        })

        # 🔹 Log signup event
        events_collection.insert_one({
            "event_type": "company_signup",
            "django_company_id": company.id,
            "company_name": company.name,
            "email": company.email,
            "timestamp": datetime.utcnow(),
        })

        return Response(
            {
                "token": token.key,
                "company": CompanySerializer(company).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CompanyLoginView(APIView):
    """
    POST /api/company/login/

    Verifies credentials from Django DB only
    """

    def post(self, request, *args, **kwargs):
        serializer = CompanyLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        company = serializer.validated_data["company"]

        token, _ = Token.objects.get_or_create(user=user)

        # 🔹 Log login event to MongoDB
        events_collection.insert_one({
            "event_type": "company_login",
            "django_company_id": company.id,
            "company_name": company.name,
            "email": company.email,
            "timestamp": datetime.utcnow(),
        })

        return Response(
            {
                "token": token.key,
                "company": CompanySerializer(company).data,
            },
            status=status.HTTP_200_OK,
        )


class CustomerSignupView(APIView):
    """
    POST /api/customer/signup/
    
    Creates:
    - Django User (authentication)
    - MongoDB Customer document (profile data)
    """

    def post(self, request, *args, **kwargs):
        serializer = CustomerSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        
        # Save customer profile to MongoDB
        customers_collection.insert_one({
            "django_user_id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "created_at": datetime.utcnow(),
        })
        
        # Log signup event
        events_collection.insert_one({
            "event_type": "customer_signup",
            "user_id": user.id,
            "email": user.email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class CustomerLoginView(APIView):
    """
    POST /api/customer/login/
    
    Verifies customer credentials.
    """

    def post(self, request, *args, **kwargs):
        serializer = CustomerLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        
        # Log login event
        events_collection.insert_one({
            "event_type": "customer_login",
            "user_id": user.id,
            "email": user.email,
            "timestamp": datetime.utcnow(),
        })
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
            },
            status=status.HTTP_200_OK,
        )


class CompanyRatingView(APIView):
    """
    POST /api/company/<company_id>/rate/
    GET  /api/company/<company_id>/rate/

    Allows an authenticated *customer* (Django User that is not a company owner)
    to create or update their rating for a company.
    """

    def _get_authenticated_customer(self, request):
        """
        Lightweight token auth:
        Expects header: Authorization: Token <key>
        """
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "token":
            return None

        token_key = parts[1]
        try:
            token = Token.objects.select_related("user").get(key=token_key)
        except Token.DoesNotExist:
            return None

        user = token.user

        # If this user is linked to a company, they are not a customer
        from .models import Company as CompanyModel

        if CompanyModel.objects.filter(owner=user).exists():
            return None

        return user

    def get(self, request, company_id, *args, **kwargs):
        """
        Return the current company rating info for this user (if any)
        plus aggregate stats.
        """
        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response(
                {"detail": "Company not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer = self._get_authenticated_customer(request)

        my_rating_value = None
        if customer is not None:
            doc = ratings_collection.find_one(
                {
                    "django_company_id": company.id,
                    "django_user_id": customer.id,
                }
            )
            if doc and "rating" in doc:
                try:
                    my_rating_value = float(doc.get("rating"))
                except (TypeError, ValueError):
                    my_rating_value = None

        return Response(
            {
                "company": CompanySerializer(company).data,
                "my_rating": my_rating_value,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, company_id, *args, **kwargs):
        """
        Create the customer's rating for the given company.
        Once a customer has rated a company, they cannot rate it again.
        """
        customer = self._get_authenticated_customer(request)
        if customer is None:
            return Response(
                {"detail": "Authentication as a customer is required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
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

        # Restrict: one rating per (customer, company)
        existing = ratings_collection.find_one(
            {
                "django_company_id": company.id,
                "django_user_id": customer.id,
            }
        )
        if existing is not None:
            return Response(
                {"detail": "You have already rated this company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create the rating in MongoDB
        now = datetime.utcnow()
        ratings_collection.update_one(
            {
                "django_company_id": company.id,
                "django_user_id": customer.id,
            },
            {
                "$set": {
                    "rating": rating_value,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
        )

        # Recalculate aggregates from MongoDB
        pipeline = [
            {"$match": {"django_company_id": company.id}},
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

        company.average_rating = avg_rating
        company.rating = avg_rating
        company.total_reviews = count
        company.save(update_fields=["rating", "average_rating", "total_reviews"])

        # Also mirror rating info into the MongoDB company document
        companies_collection.update_one(
            {"django_company_id": company.id},
            {
                "$set": {
                    "rating": company.rating,
                    "average_rating": company.average_rating,
                    "total_reviews": company.total_reviews,
                }
            },
        )

        return Response(
            {
                "company": CompanySerializer(company).data,
                "my_rating": rating_value,
            },
            status=status.HTTP_200_OK,
        )


class CompanyCommentView(APIView):
    """
    GET  /api/company/<company_id>/comments/
    POST /api/company/<company_id>/comments/

    Allows customers to view and add comments for a company.
    """

    def _get_authenticated_customer(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "token":
            return None

        token_key = parts[1]
        try:
            token = Token.objects.select_related("user").get(key=token_key)
        except Token.DoesNotExist:
            return None

        user = token.user

        # If this user is linked to a company, they are not a customer
        if Company.objects.filter(owner=user).exists():
            return None

        return user

    def get(self, request, company_id, *args, **kwargs):
        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)

        # Fetch latest comments from MongoDB
        cursor = comments_collection.find({"django_company_id": company.id}).sort("created_at", -1)
        comments = []
        for doc in cursor:
            comments.append({
                "comment": doc.get("comment", ""),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
                "customer": {
                    "id": doc.get("django_user_id"),
                    "name": doc.get("customer_name", "Anonymous"),
                    "email": doc.get("customer_email"),
                },
            })

        return Response({"comments": comments}, status=status.HTTP_200_OK)

    def post(self, request, company_id, *args, **kwargs):
        customer = self._get_authenticated_customer(request)
        if customer is None:
            return Response({"detail": "Authentication as a customer is required."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)

        text = (request.data.get("comment") or "").strip()
        if not text:
            return Response({"detail": "Comment cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 2000:
            return Response({"detail": "Comment is too long (max 2000 characters)."}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.utcnow()
        doc = {
            "django_company_id": company.id,
            "django_user_id": customer.id,
            "comment": text,
            "customer_name": (customer.get_full_name() or customer.username or customer.email),
            "customer_email": customer.email,
            "created_at": now,
            "updated_at": now,
        }
        comments_collection.insert_one(doc)

        events_collection.insert_one({
            "event_type": "company_comment_added",
            "django_company_id": company.id,
            "user_id": customer.id,
            "timestamp": now,
        })

        return Response({"detail": "Comment added."}, status=status.HTTP_201_CREATED)


class CompanySearchView(APIView):
    """GET /api/company/search/ with query params: q, category, city, country"""

    def get(self, request, *args, **kwargs):
        q = (request.GET.get("q") or "").strip()
        category = (request.GET.get("category") or "").strip()
        city = (request.GET.get("city") or "").strip()
        country = (request.GET.get("country") or "").strip()

        qs = Company.objects.filter(is_active=True)
        if q:
            qs = qs.filter(name__icontains=q)
        if category:
            qs = qs.filter(category__iexact=category)
        if city:
            qs = qs.filter(city__icontains=city)
        if country:
            qs = qs.filter(country__icontains=country)

        qs = qs.order_by("-average_rating", "name")[:200]
        return Response({"results": CompanySerializer(qs, many=True).data})


class TopBusinessesView(APIView):
    """GET /api/company/top/ returns highest-rated businesses per category."""

    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.GET.get("limit", 5))
        except ValueError:
            limit = 5
        categories = (
            Company.objects.filter(is_active=True)
            .values_list("category", flat=True)
            .distinct()
        )
        data = {}
        for cat in categories:
            top = (
                Company.objects.filter(is_active=True, category=cat)
                .order_by("-average_rating", "-total_reviews", "name")[:limit]
            )
            data[cat] = CompanySerializer(top, many=True).data

        return Response({"top_by_category": data})


class RecommendationsView(APIView):
    """GET /api/company/recommendations/ based on reputation_score with filters.

    Query params:
    - category (optional, exact match)
    - q (optional, name contains)
    - city (optional, contains)
    - country (optional, contains)
    - limit (optional, default 10)
    """

    def get(self, request, *args, **kwargs):
        category = (request.GET.get("category") or "").strip()
        q = (request.GET.get("q") or "").strip()
        city = (request.GET.get("city") or "").strip()
        country = (request.GET.get("country") or "").strip()
        try:
            limit = int(request.GET.get("limit", 10))
        except ValueError:
            limit = 10

        qs = Company.objects.filter(is_active=True)
        if category:
            qs = qs.filter(category__iexact=category)
        if q:
            qs = qs.filter(name__icontains=q)
        if city:
            qs = qs.filter(city__icontains=city)
        if country:
            qs = qs.filter(country__icontains=country)

        qs = qs.order_by("-reputation_score", "-average_rating", "name")[:limit]
        return Response({"recommendations": CompanySerializer(qs, many=True).data})


class CompanyMeView(APIView):
    """GET/PATCH /api/company/me/ for authenticated company owners."""

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

    def _get_company_user(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "").split()
        if len(auth) != 2 or auth[0].lower() != "token":
            return None, None
        try:
            token = Token.objects.select_related("user").get(key=auth[1])
        except Token.DoesNotExist:
            return None, None
        user = token.user
        try:
            company = Company.objects.get(owner=user)
        except Company.DoesNotExist:
            return user, None
        return user, company

    def get(self, request, *args, **kwargs):
        user, company = self._get_company_user(request)
        if not user or not company:
            return Response({"detail": "Company authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(CompanySerializer(company).data)

    def patch(self, request, *args, **kwargs):
        user, company = self._get_company_user(request)
        if not user or not company:
            return Response({"detail": "Company authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = {k: v for k, v in request.data.items() if k in self.editable_fields}
        for k, v in data.items():
            setattr(company, k, v)
        company.save()

        # mirror to MongoDB company document as well
        companies_collection.update_one(
            {"django_company_id": company.id},
            {"$set": {k: getattr(company, k) for k in self.editable_fields}},
        )
        return Response(CompanySerializer(company).data)


class CompanyFeedbackView(APIView):
    """
    GET /api/company/me/feedback/
    Returns ratings and comments for the authenticated company, with a
    derived reputation score based on rating, sentiment, and reviews count.
    """

    POSITIVE_WORDS = {
        "good",
        "great",
        "excellent",
        "amazing",
        "fast",
        "helpful",
        "friendly",
        "recommend",
        "satisfied",
        "happy",
    }
    NEGATIVE_WORDS = {
        "bad",
        "poor",
        "terrible",
        "slow",
        "rude",
        "disappoint",
        "issue",
        "problem",
        "unhappy",
    }

    def _get_company(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "").split()
        if len(auth) != 2 or auth[0].lower() != "token":
            return None
        try:
            token = Token.objects.select_related("user").get(key=auth[1])
        except Token.DoesNotExist:
            return None
        try:
            return Company.objects.get(owner=token.user)
        except Company.DoesNotExist:
            return None

    def _sentiment_score(self, text: str) -> float:
        if not text:
            return 0.0
        s = text.lower()
        pos = sum(1 for w in self.POSITIVE_WORDS if w in s)
        neg = sum(1 for w in self.NEGATIVE_WORDS if w in s)
        if pos == 0 and neg == 0:
            return 0.0
        return (pos - neg) / (pos + neg)  # -1..1

    def get(self, request, *args, **kwargs):
        company = self._get_company(request)
        if not company:
            return Response({"detail": "Company authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        # Ratings from MongoDB
        rating_docs = list(
            ratings_collection.find({"django_company_id": company.id})
        )
        total_reviews = len(rating_docs)
        avg_rating = (
            sum(float(doc.get("rating", 0) or 0) for doc in rating_docs) / total_reviews
            if total_reviews > 0
            else 0.0
        )

        # Comments with light sentiment
        comment_docs = list(
            comments_collection.find({"django_company_id": company.id}).sort("created_at", -1)
        )
        # Temporarily disable sentiment and reputation features
        sentiments = []
        avg_sentiment = 0.0

        # Reputation score 0..100
        # Reputation is disabled; force to 0
        reputation = 0.0
        # Recommendation/segmentation score also disabled
        recommendation_score = 0.0

        # Update company fields for convenience
        # Persist rating counts, ensure reputation and recommendation stay 0
        company.average_rating = avg_rating
        company.total_reviews = total_reviews
        company.reputation_score = 0.0
        company.recommendation_score = 0.0
        company.save(update_fields=["average_rating", "total_reviews", "reputation_score", "recommendation_score"])
        companies_collection.update_one(
            {"django_company_id": company.id},
            {"$set": {
                "average_rating": avg_rating,
                "total_reviews": total_reviews,
                "reputation_score": 0.0,
                "recommendation_score": 0.0,
            }},
        )

        feedback = {
            "ratings": [
                {
                    "user_id": doc.get("django_user_id"),
                    "rating": float(doc.get("rating", 0) or 0),
                    "created_at": doc.get("created_at"),
                }
                for doc in rating_docs
            ],
            "comments": [
                {
                    "user_id": doc.get("django_user_id"),
                    "comment": doc.get("comment", ""),
                    "created_at": doc.get("created_at"),
                    "sentiment": self._sentiment_score(doc.get("comment", "")),
                }
                for doc in comment_docs
            ],
        }

        return Response(
            {
                "company": CompanySerializer(company).data,
                "average_rating": avg_rating,
                "total_reviews": total_reviews,
                "average_sentiment": 0.0,
                "reputation_score": 0.0,
                "feedback": feedback,
            }
        )


class MongoCompanyListView(APIView):
    """
    GET /api/mongo/companies/

    Returns the list of companies directly from MongoDB, not from Django ORM.
    Used for customer browsing so that the primary data source is MongoDB.
    """

    def get(self, request, *args, **kwargs):
        docs = list(
            companies_collection.find(
                {},
                {
                    "_id": 0,
                    "django_company_id": 1,
                    "name": 1,
                    "email": 1,
                    "category": 1,
                    "description": 1,
                    "city": 1,
                    "country": 1,
                    "rating": 1,
                    "average_rating": 1,
                    "total_reviews": 1,
                    "is_verified": 1,
                    "is_active": 1,
                },
            )
        )

        # Normalize field names so frontend can treat them like Django objects
        results = []
        for doc in docs:
            results.append(
                {
                    "id": doc.get("django_company_id"),
                    "name": doc.get("name"),
                    "email": doc.get("email"),
                    "category": doc.get("category"),
                    "description": doc.get("description"),
                    "city": doc.get("city"),
                    "country": doc.get("country"),
                    "rating": float(doc.get("rating", 0.0) or 0.0),
                    "average_rating": float(doc.get("average_rating", 0.0) or 0.0),
                    "total_reviews": int(doc.get("total_reviews", 0) or 0),
                    "is_verified": bool(doc.get("is_verified", False)),
                    "is_active": bool(doc.get("is_active", True)),
                }
            )

        return Response({"companies": results}, status=status.HTTP_200_OK)
