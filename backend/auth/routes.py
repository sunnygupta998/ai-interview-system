from flask import Blueprint, request, jsonify, current_app, g
from pymongo import MongoClient
import bcrypt
import random
from datetime import datetime, timedelta
from auth.middleware import generate_token, token_required
from utils.email_service import send_otp_email

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'candidate') # Default to candidate
    admin_secret = data.get('adminSecret')

    if not name or not email or not password:
        return jsonify({'message': 'Missing name, email, or password'}), 400

    if role not in ['admin', 'candidate']:
        return jsonify({'message': 'Invalid role. Must be admin or candidate'}), 400

    if role == 'admin':
        if admin_secret != current_app.config.get('ADMIN_SECRET_KEY'):
            return jsonify({'message': 'Invalid Admin Registration Code. Registration denied.'}), 403

    client = MongoClient(current_app.config['MONGODB_URI'])
    db = client[current_app.config['DB_NAME']]

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
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Missing email or password'}), 400

    client = MongoClient(current_app.config['MONGODB_URI'])
    db = client[current_app.config['DB_NAME']]

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
def verify_email():
    data = request.get_json() or {}
    email = data.get('email')
    code = data.get('code')
    
    if not email or not code:
        return jsonify({'message': 'Missing email or verification code'}), 400
        
    client = MongoClient(current_app.config['MONGODB_URI'])
    db = client[current_app.config['DB_NAME']]
    
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
def resend_verification():
    data = request.get_json() or {}
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Missing email'}), 400
        
    client = MongoClient(current_app.config['MONGODB_URI'])
    db = client[current_app.config['DB_NAME']]
    
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
