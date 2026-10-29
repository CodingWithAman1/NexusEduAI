import os
import secrets

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Config:
    # Use SECRET_KEY from environment or generate/reuse a persistent local secret key
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        secret_file = os.path.join(os.path.dirname(__file__), '.secret_key')
        if os.path.exists(secret_file):
            try:
                with open(secret_file, 'r', encoding='utf-8') as sf:
                    SECRET_KEY = sf.read().strip()
            except Exception:
                SECRET_KEY = None
        if not SECRET_KEY:
            SECRET_KEY = secrets.token_hex(32)
            try:
                with open(secret_file, 'w', encoding='utf-8') as sf:
                    sf.write(SECRET_KEY)
            except Exception:
                pass

    DB_PATH = os.path.join(os.path.dirname(__file__), 'campus_nexus.db')
    
    # Official Google Gemini API Key for Multimodal AI Diagnostics & Copilot
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    
    # Official Firebase client configuration from user
    FIREBASE_CONFIG = {
        "apiKey": os.environ.get("FIREBASE_API_KEY"),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID"),
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.environ.get("FIREBASE_APP_ID"),
        "measurementId": os.environ.get("FIREBASE_MEASUREMENT_ID")
    }
    SESSION_COOKIE_NAME = 'nexusedu_session'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = str(os.environ.get('COOKIE_SECURE', 'true' if os.environ.get('APP_ENV') == 'production' else 'false')).lower() == 'true'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ENABLE_DEMO_AUTH = str(os.environ.get('ENABLE_DEMO_AUTH', 'false')).lower() == 'true'
    FACULTY_INVITE_CODE = os.environ.get('FACULTY_INVITE_CODE', 'FACULTY2026')
