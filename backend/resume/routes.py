import os
from flask import Blueprint, request, jsonify, current_app, g
from extensions import get_db
from bson import ObjectId
from datetime import datetime
from auth.middleware import token_required
from resume.parser import extract_text_from_pdf
from resume.analyzer import analyze_resume
import cloudinary
import cloudinary.uploader

resume_bp = Blueprint('resume', __name__)

# Ensure secure filename helper
from werkzeug.utils import secure_filename

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'

@resume_bp.route('/upload', methods=['POST'])
@token_required
def upload_resume():
    if 'file' not in request.files:
        return jsonify({'message': 'No file part in request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'message': 'Only PDF files are supported'}), 400
        
    try:
        # Create uploads folder if not exists
        uploads_dir = os.path.join(current_app.root_path, 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        
        filename = secure_filename(file.filename)
        # Append timestamp to filename to prevent collisions
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(uploads_dir, unique_filename)
        
        # Save file
        file.save(file_path)
        
        # Extract text
        raw_text = extract_text_from_pdf(file_path)
        if not raw_text.strip():
            return jsonify({'message': 'Failed to extract text from the PDF file (it might be scanned or empty)'}), 400
            
        # Analyze resume using Groq
        skills_analysis = analyze_resume(raw_text)
        
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file_path,
            resource_type="auto",
            folder="resumes",
            use_filename=True,
            unique_filename=True
        )
        file_url = upload_result.get("secure_url")
        if file_url and '/upload/' in file_url:
            file_url = file_url.replace('/upload/', '/upload/fl_attachment/')
            
        cloudinary_public_id = upload_result.get("public_id")
        
        # Clean up local file since it is now in Cloudinary
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Store in MongoDB
        db = get_db()
        
        resume_doc = {
            'user_id': ObjectId(g.user['_id']),
            'filename': filename,
            'storage_url': file_url,
            'cloudinary_public_id': cloudinary_public_id,
            'raw_text': raw_text,
            'skills_analysis': skills_analysis,
            'uploaded_at': datetime.utcnow()
        }
        
        result = db.resumes.insert_one(resume_doc)
        resume_id = str(result.inserted_id)
        
        return jsonify({
            'message': 'Resume uploaded and analyzed successfully',
            'resume_id': resume_id,
            'skills_analysis': skills_analysis
        }), 201
        
    except Exception as e:
        print(f"Error in upload_resume: {str(e)}")
        return jsonify({'message': f'Failed to process resume: {str(e)}'}), 500

@resume_bp.route('/my-resumes', methods=['GET'])
@token_required
def my_resumes():
    try:
        db = get_db()
        
        resumes = list(db.resumes.find({
            'user_id': ObjectId(g.user['_id']), 
            'is_deleted': {'$ne': True}
        }, {'raw_text': 0, 'storage_path': 0}))
        
        # Convert ObjectId to string
        for res in resumes:
            res['_id'] = str(res['_id'])
            res['user_id'] = str(res['user_id'])
            if 'uploaded_at' in res:
                res['uploaded_at'] = res['uploaded_at'].isoformat()
                
        # Inject settings for the dashboard UI
        settings = db.settings.find_one() or {}
        enable_practice_interview = settings.get('enable_practice_interview', True)
                
        return jsonify({
            'resumes': resumes,
            'enable_practice_interview': enable_practice_interview
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve resumes: {str(e)}'}), 500

@resume_bp.route('/analysis/<resume_id>', methods=['GET'])
@token_required
def get_analysis(resume_id):
    try:
        db = get_db()
        
        resume = db.resumes.find_one({'_id': ObjectId(resume_id)})
        
        if not resume:
            return jsonify({'message': 'Resume not found'}), 404
            
        # Security: Candidates can only access their own resumes. Admins can access any.
        if g.user['role'] != 'admin' and str(resume['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to view this analysis'}), 403
            
        return jsonify({
            'resume_id': str(resume['_id']),
            'filename': resume['filename'],
            'skills_analysis': resume['skills_analysis'],
            'uploaded_at': resume['uploaded_at'].isoformat() if 'uploaded_at' in resume else None
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve analysis: {str(e)}'}), 500

@resume_bp.route('/<resume_id>', methods=['DELETE'])
@token_required
def delete_resume(resume_id):
    try:
        db = get_db()
        
        resume = db.resumes.find_one({'_id': ObjectId(resume_id)})
        
        if not resume:
            return jsonify({'message': 'Resume not found'}), 404
            
        # Security: Candidates can only access their own resumes. Admins can access any.
        if g.user['role'] != 'admin' and str(resume['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to delete this resume'}), 403
            
        # Soft delete instead of physical deletion so admins can still view it
        db.resumes.update_one(
            {'_id': ObjectId(resume_id)},
            {'$set': {'is_deleted': True, 'deleted_at': datetime.utcnow()}}
        )
        
        return jsonify({'message': 'Resume deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to delete resume: {str(e)}'}), 500
