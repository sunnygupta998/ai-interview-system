import gevent.monkey
gevent.monkey.patch_all()

import os
from flask import Flask, jsonify
from flask_cors import CORS
from extensions import socketio
from pymongo import MongoClient
import config

# Import blueprints
from auth.routes import auth_bp
from resume.routes import resume_bp
from test.routes import test_bp
from admin.routes import admin_bp
from interview.routes import interview_bp
# We will import socket events here later
import interview.events

def create_app():
    app = Flask(__name__)
    
    # Enable Cross-Origin Resource Sharing (CORS)
    CORS(app)
    socketio.init_app(app)
    
    # Load configuration
    app.config['GROQ_API_KEY'] = config.GROQ_API_KEY
    app.config['MONGODB_URI'] = config.MONGODB_URI
    app.config['DB_NAME'] = config.DB_NAME
    app.config['JWT_SECRET'] = config.JWT_SECRET
    app.config['PORT'] = config.FLASK_PORT
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(resume_bp, url_prefix='/api/resume')
    app.register_blueprint(test_bp, url_prefix='/api/test')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(interview_bp, url_prefix='/api/interview')
    
    # Ensure uploads directory exists
    uploads_dir = os.path.join(app.root_path, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Seed default settings
    try:
        client = MongoClient(app.config['MONGODB_URI'])
        db = client[app.config['DB_NAME']]
        settings_col = db.settings
        
        if settings_col.count_documents({}) == 0:
            default_settings = {
                'questions_per_test': 15,
                'time_limit_minutes': 25,
                'pass_percentage': 60,
                'difficulty_mix': {'easy': 30, 'medium': 50, 'hard': 20}
            }
            settings_col.insert_one(default_settings)
            print("Successfully seeded default settings.")
    except Exception as e:
        print(f"Error seeding default settings: {str(e)}")
        
    # Error Handlers
    @app.errorhandler(404)
    def page_not_found(e):
        return jsonify({'message': 'Resource not found'}), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({'message': 'An internal server error occurred'}), 500
        
    return app

app = create_app()

if __name__ == '__main__':
    port = app.config.get('PORT', 5000)
    print(f"Starting SocketIO server on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
