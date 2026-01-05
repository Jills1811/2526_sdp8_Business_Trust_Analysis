from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet,
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
)

router = DefaultRouter()
router.register(r"company", CompanyViewSet)

urlpatterns = [
    # COMPANY AUTH ROUTES
    path("company/signup/", CompanySignupView.as_view(), name="company-signup"),
    path("company/login/", CompanyLoginView.as_view(), name="company-login"),

    # CUSTOMER AUTH ROUTES
    path("customer/signup/", CustomerSignupView.as_view(), name="customer-signup"),
    path("customer/login/", CustomerLoginView.as_view(), name="customer-login"),

    # COMPANY RATING ROUTE
    path(
        "company/<int:company_id>/rate/",
        CompanyRatingView.as_view(),
        name="company-rate",
    ),

    # COMPANY COMMENTS ROUTE
    path(
        "company/<int:company_id>/comments/",
        CompanyCommentView.as_view(),
        name="company-comments",
    ),

    # SEARCH & DISCOVERY
    path("company/search/", CompanySearchView.as_view(), name="company-search"),
    path("company/top/", TopBusinessesView.as_view(), name="company-top"),
    path("company/recommendations/", RecommendationsView.as_view(), name="company-recommendations"),

    # Company owner self endpoints
    path("company/me/", CompanyMeView.as_view(), name="company-me"),
    path("company/me/feedback/", CompanyFeedbackView.as_view(), name="company-feedback"),

    # ROUTER LAST
    path("", include(router.urls)),
]
