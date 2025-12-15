from django.shortcuts import render
from rest_framework import viewsets
from .models import Company
from .serializers import CompanySerializer

# class BusinessViewSet(viewsets.ModelViewSet):
#     queryset = Business.objects.all()
#     serializer_class = BusinessSerializer
class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
