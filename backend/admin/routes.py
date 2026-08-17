from flask import Blueprint, request, jsonify, current_app, g
from extensions import get_db
from bson import ObjectId
from auth.middleware import token_required, admin_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/settings', methods=['GET'])
@token_required
@admin_required
def get_settings():
    try:
        db = get_db()
        
        settings = db.settings.find_one()
        if not settings:
            # Seed defaults
            settings = {
                'questions_per_test': 20,
                'time_limit_minutes': 30,
                'pass_percentage': 60,
                'difficulty_mix': {'easy': 30, 'medium': 50, 'hard': 20},
                'interview_question_count': 3,
                'interview_language': 'English',
                'enable_practice_interview': True
            }
            db.settings.insert_one(settings)
            
        settings['_id'] = str(settings['_id'])
        return jsonify({'settings': settings}), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve settings: {str(e)}'}), 500

@admin_bp.route('/settings', methods=['PUT'])
@token_required
@admin_required
def update_settings():
    try:
        data = request.get_json() or {}
        
        # Validations
        questions_per_test = data.get('questions_per_test')
        time_limit_minutes = data.get('time_limit_minutes')
        pass_percentage = data.get('pass_percentage')
        difficulty_mix = data.get('difficulty_mix')
        interview_question_count = data.get('interview_question_count')
        interview_language = data.get('interview_language')
        enable_practice_interview = data.get('enable_practice_interview')
        
        update_fields = {}
        
        if questions_per_test is not None:
            update_fields['questions_per_test'] = int(questions_per_test)
        if time_limit_minutes is not None:
            update_fields['time_limit_minutes'] = int(time_limit_minutes)
        if pass_percentage is not None:
            update_fields['pass_percentage'] = int(pass_percentage)
        if interview_question_count is not None:
            update_fields['interview_question_count'] = int(interview_question_count)
        if interview_language is not None:
            update_fields['interview_language'] = str(interview_language)
        if enable_practice_interview is not None:
            update_fields['enable_practice_interview'] = bool(enable_practice_interview)
            
        if difficulty_mix is not None:
            easy = int(difficulty_mix.get('easy', 0))
            medium = int(difficulty_mix.get('medium', 0))
            hard = int(difficulty_mix.get('hard', 0))
            
            if easy + medium + hard != 100:
                return jsonify({'message': 'Difficulty mix percentages must sum to 100.'}), 400
                
            update_fields['difficulty_mix'] = {
                'easy': easy,
                'medium': medium,
                'hard': hard
            }
            
        db = get_db()
        
        # Check if settings exists
        settings = db.settings.find_one()
        if not settings:
            db.settings.insert_one(update_fields)
        else:
            db.settings.update_one({'_id': settings['_id']}, {'$set': update_fields})
            
        # Retrieve updated settings
        updated = db.settings.find_one()
        updated['_id'] = str(updated['_id'])
        
        return jsonify({
            'message': 'Settings updated successfully',
            'settings': updated
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to update settings: {str(e)}'}), 500

@admin_bp.route('/results', methods=['GET'])
@token_required
@admin_required
def get_all_results():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        skip = (page - 1) * per_page
        
        db = get_db()
        
        total_results = db.results.count_documents({})
        
        # Join user details & resume details manually (simulate populate)
        results = list(db.results.find().sort('submitted_at', -1).skip(skip).limit(per_page))
        
        formatted_results = []
        for r in results:
            user = db.users.find_one({'_id': r.get('user_id')}, {'name': 1, 'email': 1})
            
            # Find the test to get resume ID
            test = db.tests.find_one({'_id': r.get('test_id')}, {'resume_id': 1})
            resume_filename = "Deleted"
            resume_url = None
            if test:
                resume = db.resumes.find_one({'_id': test.get('resume_id')}, {'filename': 1, 'storage_url': 1})
                if resume:
                    resume_filename = resume.get('filename')
                    resume_url = resume.get('storage_url')
                    
            # Get interview decision and score
            interview = db.interviews.find_one({'test_id': r.get('test_id')}, {'decision': 1, 'score': 1})
            interview_decision = interview.get('decision', 'Pending') if interview else 'Not Started'
            interview_score = interview.get('score', 0) if interview else 0
            
            formatted_results.append({
                'result_id': str(r['_id']),
                'test_id': str(r['test_id']),
                'candidate': {
                    'id': str(r['user_id']),
                    'name': user.get('name') if user else 'Unknown',
                    'email': user.get('email') if user else 'Unknown'
                },
                'resume_filename': resume_filename,
                'resume_url': resume_url,
                'score': r.get('score'),
                'total': r.get('total'),
                'percentage': r.get('percentage'),
                'passed': r.get('passed'),
                'interview_decision': interview_decision,
                'interview_score': interview_score,
                'submitted_at': r.get('submitted_at').isoformat() if r.get('submitted_at') else None
            })
            
        return jsonify({
            'results': formatted_results,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_results + per_page - 1) // per_page,
            'total_records': total_results
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve results: {str(e)}'}), 500

@admin_bp.route('/results/candidate/<candidate_id>', methods=['GET'])
@token_required
@admin_required
def get_candidate_results(candidate_id):
    try:
        db = get_db()
        
        results = list(db.results.find({'user_id': ObjectId(candidate_id)}).sort('submitted_at', -1))
        
        formatted_results = []
        for r in results:
            test = db.tests.find_one({'_id': r.get('test_id')}, {'resume_id': 1})
            resume_filename = "Deleted"
            resume_url = None
            if test:
                resume = db.resumes.find_one({'_id': test.get('resume_id')}, {'filename': 1, 'storage_url': 1})
                if resume:
                    resume_filename = resume.get('filename')
                    resume_url = resume.get('storage_url')
                    
            interview = db.interviews.find_one({'test_id': r.get('test_id')}, {'decision': 1, 'score': 1})
            interview_decision = interview.get('decision', 'Pending') if interview else 'Not Started'
            interview_score = interview.get('score', 0) if interview else 0
                    
            formatted_results.append({
                'result_id': str(r['_id']),
                'test_id': str(r['test_id']),
                'score': r.get('score'),
                'total': r.get('total'),
                'percentage': r.get('percentage'),
                'passed': r.get('passed'),
                'resume_filename': resume_filename,
                'resume_url': resume_url,
                'interview_decision': interview_decision,
                'interview_score': interview_score,
                'submitted_at': r.get('submitted_at').isoformat() if r.get('submitted_at') else None
            })
            
        return jsonify({'results': formatted_results}), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve candidate results: {str(e)}'}), 500

@admin_bp.route('/dashboard', methods=['GET'])
@token_required
@admin_required
def get_dashboard_stats():
    try:
        db = get_db()
        
        # Calculate stats
        total_candidates = db.users.count_documents({'role': 'candidate'})
        total_tests = db.tests.count_documents({})
        total_completed = db.results.count_documents({})
        
        # Average Score
        pipeline_avg = [{"$group": {"_id": None, "avg_percentage": {"$avg": "$percentage"}}}]
        avg_res = list(db.results.aggregate(pipeline_avg))
        avg_score = round(avg_res[0]['avg_percentage'], 2) if avg_res else 0.0
        
        # Pass Rate
        passed_count = db.results.count_documents({'passed': True})
        pass_rate = round((passed_count / total_completed) * 100, 2) if total_completed > 0 else 0.0
        
        # Recent Results (last 5)
        recent = list(db.results.find().sort('submitted_at', -1).limit(5))
        recent_results = []
        for r in recent:
            user = db.users.find_one({'_id': r.get('user_id')}, {'name': 1, 'email': 1})
            interview = db.interviews.find_one({'test_id': r.get('test_id')}, {'decision': 1, 'score': 1})
            interview_decision = interview.get('decision', 'Pending') if interview else 'Not Started'
            interview_score = interview.get('score', 0) if interview else 0

            recent_results.append({
                'result_id': str(r['_id']),
                'test_id': str(r['test_id']),
                'candidate_name': user.get('name') if user else 'Unknown',
                'percentage': r.get('percentage'),
                'passed': r.get('passed'),
                'interview_decision': interview_decision,
                'interview_score': interview_score,
                'submitted_at': r.get('submitted_at').isoformat() if r.get('submitted_at') else None
            })
            
        return jsonify({
            'stats': {
                'total_candidates': total_candidates,
                'total_tests': total_tests,
                'total_completed': total_completed,
                'avg_score': avg_score,
                'pass_rate': pass_rate
            },
            'recent_results': recent_results
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve dashboard stats: {str(e)}'}), 500
