from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import Company
from django.contrib.auth.models import User

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'


class CompanySignupSerializer(serializers.Serializer):
    """
    Serializer used when a new company signs up.
    It creates both a Django User and the related Company.
    """

    # Auth fields
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    # Basic company fields
    name = serializers.CharField(max_length=255)
    category = serializers.CharField(max_length=100)
    description = serializers.CharField(allow_blank=True, required=False)

    # Optional contact/location fields
    phone = serializers.CharField(allow_blank=True, required=False)
    address = serializers.CharField(allow_blank=True, required=False)
    city = serializers.CharField(allow_blank=True, required=False)
    country = serializers.CharField(allow_blank=True, required=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        email = validated_data.pop("email")
        password = validated_data.pop("password")

        # Create the Django auth user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
        )

        # Create the company linked to this user
        company = Company.objects.create(
            owner=user,
            email=email,
            **validated_data,
        )

        # Optionally create a token for immediate login
        Token.objects.get_or_create(user=user)

        return company


class CompanyLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        if not hasattr(user, "company"):
            raise serializers.ValidationError("This user is not linked to a company.")

        attrs["user"] = user
        attrs["company"] = user.company
        return attrs


class CustomerSignupSerializer(serializers.Serializer):
    """
    Serializer for customer signup.
    Creates a Django User for authentication.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")

        # Create the Django auth user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Create a token for immediate login
        Token.objects.get_or_create(user=user)

        return user


class CustomerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        # Check if user is a company owner (should not login as customer)
        # Use Company.objects.filter instead of hasattr for OneToOneField reverse relation
        from .models import Company
        if Company.objects.filter(owner=user).exists():
            raise serializers.ValidationError("This email is registered as a company. Please use company login.")

        attrs["user"] = user
        return attrs
