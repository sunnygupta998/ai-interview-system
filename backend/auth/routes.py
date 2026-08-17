from flask import Blueprint, request, jsonify, current_app, g
from extensions import get_db, limiter
import re
import bcrypt
import random
from datetime import datetime, timedelta
from auth.middleware import generate_token, token_required
from utils.email_service import send_otp_email
from google.oauth2 import id_token
from google.auth.transport import requests
import os

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'candidate') # Default to candidate
    admin_secret = data.get('adminSecret')

    if not name or not email or not password:
        return jsonify({'message': 'Missing name, email, or password'}), 400

    if len(name) < 2 or len(name) > 100:
        return jsonify({'message': 'Name must be between 2 and 100 characters'}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({'message': 'Invalid email format'}), 400

    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters long'}), 400

    if role not in ['admin', 'candidate']:
        return jsonify({'message': 'Invalid role. Must be admin or candidate'}), 400

    if role == 'admin':
        if admin_secret != current_app.config.get('ADMIN_SECRET_KEY'):
            return jsonify({'message': 'Invalid Admin Registration Code. Registration denied.'}), 403

    db = get_db()

    # Check for duplicate email
    if db.users.find_one({'email': email}):
        return jsonify({'message': 'Email already exists'}), 400

    # Hash password
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

    verification_code = str(random.randint(100000, 999999))

    user = {
        'name': name,
        'email': email,
        'password_hash': password_hash,
        'role': role,
        'is_verified': False,
        'verification_code': verification_code,
        'verification_expires_at': datetime.utcnow() + timedelta(minutes=10),
        'created_at': datetime.utcnow()
    }

    result = db.users.insert_one(user)
    
    try:
        send_otp_email(email, name, verification_code)
    except Exception as e:
        print(f"Failed to send OTP: {e}")

    return jsonify({
        'requires_verification': True,
        'message': 'Please verify your email to complete registration.',
        'email': email
    }), 201

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'message': 'Missing email or password'}), 400

    db = get_db()

    user = db.users.find_one({'email': email})

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
        return jsonify({'message': 'Invalid email or password'}), 401

    if not user.get('is_verified', True):
        return jsonify({
            'message': 'Please verify your email before logging in.',
            'requires_verification': True,
            'email': email
        }), 403

    user_id = str(user['_id'])
    token = generate_token(user_id, user['role'], current_app.config['JWT_SECRET'])

    return jsonify({
        'token': token,
        'user': {
            '_id': user_id,
            'name': user['name'],
            'email': user['email'],
            'role': user['role']
        }
    }), 200

@auth_bp.route('/me', methods=['GET'])
@token_required
def me():
    return jsonify({'user': g.user}), 200

@auth_bp.route('/verify-email', methods=['POST'])
@limiter.limit("10 per minute")
def verify_email():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code')
    
    if not email or not code:
        return jsonify({'message': 'Missing email or verification code'}), 400
        
    db = get_db()
    
    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    if user.get('is_verified'):
        return jsonify({'message': 'Email is already verified'}), 400
        
    if user.get('verification_code') != code:
        return jsonify({'message': 'Invalid verification code'}), 400
        
    if user.get('verification_expires_at') and user.get('verification_expires_at') < datetime.utcnow():
        return jsonify({'message': 'Verification code expired. Please request a new one.'}), 400
        
    # Mark verified
    db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'is_verified': True}, '$unset': {'verification_code': "", 'verification_expires_at': ""}}
    )
    
    # Issue token
    user_id = str(user['_id'])
    token = generate_token(user_id, user['role'], current_app.config['JWT_SECRET'])

    return jsonify({
        'token': token,
        'user': {
            '_id': user_id,
            'name': user['name'],
            'email': user['email'],
            'role': user['role']
        }
    }), 200

@auth_bp.route('/resend-verification', methods=['POST'])
@limiter.limit("3 per minute")
def resend_verification():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({'message': 'Missing email'}), 400
        
    db = get_db()
    
    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    if user.get('is_verified'):
        return jsonify({'message': 'Email is already verified'}), 400
        
    verification_code = str(random.randint(100000, 999999))
    db.users.update_one(
        {'_id': user['_id']},
        {'$set': {
            'verification_code': verification_code,
            'verification_expires_at': datetime.utcnow() + timedelta(minutes=10)
        }}
    )
    
    try:
        send_otp_email(email, user['name'], verification_code)
    except Exception as e:
        print(f"Failed to resend OTP: {e}")
        
    return jsonify({'message': 'A new verification code has been sent to your email.'}), 200

@auth_bp.route('/google', methods=['POST'])
@limiter.limit("10 per minute")
def google_auth():
    data = request.get_json() or {}
    token = data.get('token')
    role = data.get('role', 'candidate')
    
    if not token:
        return jsonify({'message': 'Missing token'}), 400
        
    try:
        # Verify the Google token
        client_id = os.environ.get('VITE_GOOGLE_CLIENT_ID')
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
        
        email = idinfo['email']
        name = idinfo.get('name', '')
        
        db = get_db()
        
        # Check if user exists
        user = db.users.find_one({'email': email})
        
        if not user:
            # Create user if they don't exist
            user = {
                'name': name,
                'email': email,
                'password_hash': b'', # No password for google accounts
                'role': role,
                'is_verified': True, # Google accounts are pre-verified
                'created_at': datetime.utcnow()
            }
            result = db.users.insert_one(user)
            user_id = str(result.inserted_id)
        else:
            user_id = str(user['_id'])
            # Ensure they are marked as verified since they used Google
            if not user.get('is_verified'):
                db.users.update_one({'_id': user['_id']}, {'$set': {'is_verified': True}})
                
        # Generate our JWT token
        jwt_token = generate_token(user_id, user.get('role', role), current_app.config['JWT_SECRET'])
        
        return jsonify({
            'token': jwt_token,
            'user': {
                '_id': user_id,
                'name': user.get('name', name),
                'email': email,
                'role': user.get('role', role)
            }
        }), 200
        
    except ValueError as e:
        print(f"Google auth error: {e}")
        return jsonify({'message': 'Invalid Google token'}), 401
