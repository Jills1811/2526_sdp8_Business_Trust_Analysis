from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
mongo_db = client.business_trust

# Collections
companies_collection = mongo_db.companies
customers_collection = mongo_db.customers
events_collection = mongo_db.events
ratings_collection = mongo_db.ratings
comments_collection = mongo_db.comments
users_collection = mongo_db.users  # Unified users (companies + customers)
tokens_collection = mongo_db.tokens  # Authentication tokens

# Ensure correct indexes exist and drop old ones
def setup_indexes():
    """Setup MongoDB indexes for the application."""
    try:
        # Drop old Django-based indexes if they exist
        try:
            ratings_collection.drop_index("django_company_id_1_django_user_id_1")
        except Exception:
            pass  # Index doesn't exist, that's fine
        
        # Create correct unique index on company_id and user_id for ratings
        # This ensures one rating per user per company
        try:
            ratings_collection.create_index(
                [("company_id", 1), ("user_id", 1)],
                unique=True,
                name="company_user_unique"
            )
        except Exception:
            pass  # Index might already exist
        
        # Create index on email for users (for faster lookups)
        try:
            users_collection.create_index("email", unique=True)
        except Exception:
            pass
        
        # Create index on token for tokens collection (for faster lookups)
        try:
            tokens_collection.create_index("token", unique=True)
        except Exception:
            pass
    except Exception:
        pass  # Fail silently if indexes can't be created

# Setup indexes on import
setup_indexes()
