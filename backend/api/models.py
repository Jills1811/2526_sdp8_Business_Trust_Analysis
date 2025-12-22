from django.db import models
from django.contrib.auth.models import User

# class Business(models.Model):
#     name = models.CharField(max_length=100)
#     category = models.CharField(max_length=50)
#     description = models.TextField()
#     rating = models.FloatField(default=0.0)

#     def __str__(self):
#         return self.name



class Company(models.Model):
    # Basic info
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100)
    # Link to the Django auth user that can log in as this company
    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='company',
        null=True,
        blank=True,
    )

    # Contact & location
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)

    # Reputation & recommendation metrics
    rating = models.FloatField(default=0.0)  # duplicate of average_rating for convenience
    average_rating = models.FloatField(default=0.0)
    total_reviews = models.PositiveIntegerField(default=0)
    reputation_score = models.FloatField(default=0.0)  # 0–100
    recommendation_score = models.FloatField(default=0.0)

    # Status
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class CompanyRating(models.Model):
    """
    Rating a customer gives to a company.

    We store individual ratings so that:
    - each customer can rate a company once (but can update it)
    - the company's aggregate rating can be recomputed reliably
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    # Customer is represented by the Django auth user used for customer login
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="company_ratings",
    )
    rating = models.PositiveSmallIntegerField()  # typically 1–5
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("company", "customer")

    def __str__(self):
        return f"{self.customer_id} → {self.company_id}: {self.rating}"
