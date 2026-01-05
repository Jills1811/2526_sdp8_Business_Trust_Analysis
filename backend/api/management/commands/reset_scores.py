from django.core.management.base import BaseCommand
from api.models import Company

try:
    from api.db_mongo import companies_collection
except Exception:
    companies_collection = None

class Command(BaseCommand):
    help = "Reset reputation_score and recommendation_score to 0 for all companies (and mirror to MongoDB if available)."

    def handle(self, *args, **options):
        updated = Company.objects.update(reputation_score=0.0, recommendation_score=0.0)
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} companies in Django DB."))

        if companies_collection is not None:
            res = companies_collection.update_many({}, {"$set": {"reputation_score": 0.0, "recommendation_score": 0.0}})
            self.stdout.write(self.style.SUCCESS(f"Updated {res.modified_count} companies in MongoDB."))
        else:
            self.stdout.write(self.style.WARNING("MongoDB companies_collection not available; skipped Mongo update."))

        self.stdout.write(self.style.SUCCESS("Reset complete."))
