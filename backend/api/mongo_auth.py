"""
MongoDB-based authentication utilities.
Replaces Django's User model and Token system.
"""
import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta
from bson import ObjectId
from .db_mongo import mongo_db

# Collections
users_collection = mongo_db.users  # Unified users collection (companies + customers)
tokens_collection = mongo_db.tokens


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


def create_token(user_id: str, user_type: str) -> str:
    """
    Create a token for a user and store it in MongoDB.
    Returns the token string.
    """
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=30)  # 30 day expiry
    
    tokens_collection.insert_one({
        "token": token,
        "user_id": user_id,
        "user_type": user_type,  # "company" or "customer"
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    })
    
    return token


def verify_token(token: str) -> dict:
    """
    Verify a token and return user info if valid.
    Returns None if invalid.
    """
    if not token:
        return None
    
    doc = tokens_collection.find_one({"token": token})
    if not doc:
        return None
    
    # Check expiry
    expires_at = doc.get("expires_at")
    if expires_at and expires_at < datetime.utcnow():
        tokens_collection.delete_one({"_id": doc["_id"]})
        return None
    
    return {
        "user_id": doc["user_id"],
        "user_type": doc["user_type"],
    }


def get_user_by_email(email: str):
    """Get user from MongoDB by email."""
    return users_collection.find_one({"email": email.lower()})


def get_user_by_id(user_id: str):
    """Get user from MongoDB by ID."""
    try:
        # Try ObjectId first (if it's a MongoDB ObjectId string)
        try:
            return users_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            # If not ObjectId, try as string
            return users_collection.find_one({"_id": user_id})
    except Exception as e:
        print(f"Error getting user by ID {user_id}: {e}")
        return None


def create_user(email: str, password: str, user_type: str, **extra_data):
    """
    Create a new user in MongoDB.
    user_type: "company" or "customer"
    """
    hashed_password = hash_password(password)
    
    user_doc = {
        "email": email.lower(),
        "password_hash": hashed_password,
        "user_type": user_type,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        **extra_data,
    }
    
    result = users_collection.insert_one(user_doc)
    return str(result.inserted_id)


def authenticate_user(email: str, password: str, user_type: str = None):
    """
    Authenticate a user by email and password.
    Returns user_id if successful, None otherwise.
    """
    user = get_user_by_email(email)
    if not user:
        return None
    
    # Check user type if specified
    if user_type and user.get("user_type") != user_type:
        return None
    
    # Verify password
    if not verify_password(password, user.get("password_hash", "")):
        return None
    
    return str(user["_id"])


def delete_token(token: str):
    """Delete a token (logout)."""
    tokens_collection.delete_one({"token": token})

