from django.db import models

class Business(models.Model):
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50)
    description = models.TextField()
    rating = models.FloatField(default=0.0)

    def __str__(self):
        return self.name
