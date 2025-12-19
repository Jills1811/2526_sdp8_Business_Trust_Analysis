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
