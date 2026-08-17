from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient

socketio = SocketIO(cors_allowed_origins="*")

# Rate limiter (initialized with app in create_app)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],  # No default global limit — applied per-route
    storage_uri="memory://"
)

# Shared MongoDB connection
_mongo_client = None
_db = None

def init_db(app):
    """
    Initialize the shared MongoDB connection pool.
    Call this once during app creation.
    """
    global _mongo_client, _db
    _mongo_client = MongoClient(app.config['MONGODB_URI'])
    _db = _mongo_client[app.config['DB_NAME']]

def get_db():
    """
    Returns the shared MongoDB database instance.
    Use this in all route handlers instead of creating new MongoClient instances.
    """
    return _db
