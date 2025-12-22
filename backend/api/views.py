from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime

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
