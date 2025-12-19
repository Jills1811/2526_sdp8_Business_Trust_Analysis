from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet,
    CompanySignupView,
    CompanyLoginView,
    CustomerSignupView,
    CustomerLoginView,
)

router = DefaultRouter()
router.register(r'company', CompanyViewSet)

urlpatterns = [
    # COMPANY AUTH ROUTES
    path("company/signup/", CompanySignupView.as_view(), name="company-signup"),
    path("company/login/", CompanyLoginView.as_view(), name="company-login"),
    
    # CUSTOMER AUTH ROUTES
    path("customer/signup/", CustomerSignupView.as_view(), name="customer-signup"),
    path("customer/login/", CustomerLoginView.as_view(), name="customer-login"),

    # ROUTER LAST
    path("", include(router.urls)),
]
