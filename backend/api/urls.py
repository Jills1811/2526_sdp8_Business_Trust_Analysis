from django.urls import path

from .views_mongo import (
    CompanySignupView,
    CompanyLoginView,
    CustomerSignupView,
    CustomerLoginView,
    CompanyRatingView,
    CompanyCommentView,
    CompanySearchView,
    TopBusinessesView,
    RecommendationsView,
    CompanyMeView,
    CompanyFeedbackView,
    MongoCompanyListView,
    CompanyDetailView,
    CustomerGoogleLoginView,
    CompanyGoogleLoginView,
    CustomerMeView,
)
from .chatbot_view import BusinessChatbotView

urlpatterns = [
    # COMPANY AUTH ROUTES (MongoDB-based)
    path("company/signup/", CompanySignupView.as_view(), name="company-signup"),
    path("company/login/", CompanyLoginView.as_view(), name="company-login"),

    # CUSTOMER AUTH ROUTES (MongoDB-based)
    path("customer/signup/", CustomerSignupView.as_view(), name="customer-signup"),
    path("customer/login/", CustomerLoginView.as_view(), name="customer-login"),
    path("customer/google-login/", CustomerGoogleLoginView.as_view(), name="customer-google-login"),
    path("customer/me/", CustomerMeView.as_view(), name="customer-me"),

    # COMPANY RATING ROUTE
    path(
        "company/<str:company_id>/rate/",
        CompanyRatingView.as_view(),
        name="company-rate",
    ),

    # COMPANY COMMENTS ROUTE
    path(
        "company/<str:company_id>/comments/",
        CompanyCommentView.as_view(),
        name="company-comments",
    ),

    # SEARCH & DISCOVERY
    path("company/search/", CompanySearchView.as_view(), name="company-search"),
    path("company/top/", TopBusinessesView.as_view(), name="company-top"),
    path("company/recommendations/", RecommendationsView.as_view(), name="company-recommendations"),
    path("company/google-login/", CompanyGoogleLoginView.as_view(), name="company-google-login"),

    # Company owner self endpoints
    path("company/me/", CompanyMeView.as_view(), name="company-me"),
    path("company/me/feedback/", CompanyFeedbackView.as_view(), name="company-feedback"),

    # Mongo-only company list (used by customers)
    path("mongo/companies/", MongoCompanyListView.as_view(), name="mongo-company-list"),
    
    # Company detail view (MongoDB-based)
    path("company/<str:company_id>/", CompanyDetailView.as_view(), name="company-detail"),
    
    # Chatbot endpoint
    path("company/<str:company_id>/chatbot/", BusinessChatbotView.as_view(), name="company-chatbot"),
]
