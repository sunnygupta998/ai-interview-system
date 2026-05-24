"""
Configuration module for the AI Interview System backend.
Loads environment variables using python-dotenv and exports config values.
"""

import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "ai_interview_system")
JWT_SECRET = os.getenv("JWT_SECRET", "default_jwt_secret_change_this")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "default_secret")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
