import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g, current_app
from extensions import get_db
from bson import ObjectId
import os

def generate_token(user_id, role, secret_key):
    """
    Generates a JWT token for a user.
    """
    payload = {
        'exp': datetime.now(timezone.utc) + timedelta(days=1),
        'iat': datetime.now(timezone.utc),
        'sub': str(user_id),
        'role': role
    }
    return jwt.encode(payload, secret_key, algorithm='HS256')

def token_required(f):
    """
    Decorator to protect routes. Requires a valid JWT token.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check if the Authorization header is present
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Expecting format: Bearer <token>
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format. Use Bearer <token>'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Decode the token
            secret_key = current_app.config['JWT_SECRET']
            data = jwt.decode(token, secret_key, algorithms=['HS256'])
            
            # Fetch user from database
            db = get_db()
            user = db.users.find_one({'_id': ObjectId(data['sub'])})
            
            if not user:
                return jsonify({'message': 'User not found!'}), 401
            
            # Remove password hash for security
            if 'password_hash' in user:
                del user['password_hash']
            
            user['_id'] = str(user['_id'])
            g.user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': f'Something went wrong: {str(e)}'}), 500
        
        return f(*args, **kwargs)
    
    return decorated

def admin_required(f):
    """
    Decorator to restrict access to admin users only.
    Must be used after @token_required.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user.get('role') != 'admin':
            return jsonify({'message': 'Admin privilege required!'}), 403
        return f(*args, **kwargs)
    return decorated
