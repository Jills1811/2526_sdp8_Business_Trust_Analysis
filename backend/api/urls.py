from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyViewSet

router = DefaultRouter()
# router.register(r'businesses', BusinessViewSet)
router.register(r'company', CompanyViewSet)


urlpatterns = [
    path('', include(router.urls)),
]