from rest_framework import serializers
from .models import  Company

# class BusinessSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Business
#         fields = '__all__'
class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'
