from django.db import models

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
    owner_id = models.IntegerField()

    # Contact & location
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)

    # Reputation & recommendation metrics
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

