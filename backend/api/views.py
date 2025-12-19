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
from .db_mongo import companies_collection, customers_collection, events_collection


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
