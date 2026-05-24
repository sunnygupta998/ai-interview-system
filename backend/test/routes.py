from flask import Blueprint, request, jsonify, current_app, g
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
from auth.middleware import token_required
from test.generator import generate_questions
from test.grader import grade_test

test_bp = Blueprint('test', __name__)

@test_bp.route('/generate/<resume_id>', methods=['POST'])
@token_required
def create_test(resume_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        # Check if resume exists and belongs to user
        resume = db.resumes.find_one({'_id': ObjectId(resume_id)})
        if not resume:
            return jsonify({'message': 'Resume not found'}), 404
            
        if g.user['role'] != 'admin' and str(resume['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to use this resume'}), 403
            
        # Check if candidate already has a test for this resume (One attempt only)
        existing_test = db.tests.find_one({
            'user_id': ObjectId(g.user['_id']),
            'resume_id': ObjectId(resume_id)
        })
        if existing_test:
            # If test is completed, candidate cannot retake
            if existing_test.get('status') == 'completed':
                return jsonify({
                    'message': 'You have already taken the test for this resume. Retakes are not allowed.',
                    'test_id': str(existing_test['_id']),
                    'status': 'completed'
                }), 400
            else:
                # If pending or in progress, return the existing test_id
                return jsonify({
                    'message': 'Test already exists for this resume',
                    'test_id': str(existing_test['_id']),
                    'status': existing_test.get('status')
                }), 200
        
        # Get settings (or default)
        settings = db.settings.find_one()
        if not settings:
            settings = {
                'questions_per_test': 20,
                'time_limit_minutes': 30,
                'pass_percentage': 60,
                'difficulty_mix': {'easy': 30, 'medium': 50, 'hard': 20}
            }
            
        # Generate MCQs using AI
        questions = generate_questions(resume['skills_analysis'], settings)
        
        test_doc = {
            'user_id': ObjectId(g.user['_id']),
            'resume_id': ObjectId(resume_id),
            'questions': questions,
            'time_limit_minutes': settings.get('time_limit_minutes', 30),
            'pass_percentage': settings.get('pass_percentage', 60),
            'status': 'pending',
            'created_at': datetime.utcnow()
        }
        
        result = db.tests.insert_one(test_doc)
        test_id = str(result.inserted_id)
        
        return jsonify({
            'message': 'Test generated successfully',
            'test_id': test_id,
            'question_count': len(questions),
            'time_limit_minutes': test_doc['time_limit_minutes']
        }), 201
        
    except Exception as e:
        print(f"Error in create_test: {str(e)}")
        return jsonify({'message': f'Failed to generate test: {str(e)}'}), 500

@test_bp.route('/start/<test_id>', methods=['POST'])
@token_required
def start_test(test_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        test = db.tests.find_one({'_id': ObjectId(test_id)})
        if not test:
            return jsonify({'message': 'Test not found'}), 404
            
        if g.user['role'] != 'admin' and str(test['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to take this test'}), 403
            
        if test.get('status') == 'completed':
            return jsonify({'message': 'This test has already been completed.'}), 400
            
        # Update test status and start time if not already in progress
        update_data = {}
        if test.get('status') == 'pending':
            update_data = {
                'status': 'in_progress',
                'started_at': datetime.utcnow()
            }
            db.tests.update_one({'_id': ObjectId(test_id)}, {'$set': update_data})
            started_at = update_data['started_at']
        else:
            started_at = test.get('started_at')
            
        # Sanitize questions (Remove correct_answer and explanation to prevent cheating)
        sanitized_questions = []
        for q in test.get('questions', []):
            sanitized_q = {
                'id': q.get('id'),
                'question': q.get('question'),
                'options': q.get('options'),
                'difficulty': q.get('difficulty'),
                'skill_category': q.get('skill_category')
            }
            sanitized_questions.append(sanitized_q)
            
        return jsonify({
            'test_id': test_id,
            'questions': sanitized_questions,
            'time_limit_minutes': test.get('time_limit_minutes', 30),
            'started_at': started_at.isoformat() if started_at else None
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to start test: {str(e)}'}), 500

@test_bp.route('/submit/<test_id>', methods=['POST'])
@token_required
def submit_test(test_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        test = db.tests.find_one({'_id': ObjectId(test_id)})
        if not test:
            return jsonify({'message': 'Test not found'}), 404
            
        if g.user['role'] != 'admin' and str(test['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to submit this test'}), 403
            
        if test.get('status') == 'completed':
            return jsonify({'message': 'This test has already been submitted.'}), 400
            
        # Read candidate answers and proctoring from request body
        # Expected format: { "answers": { "1": "A", "2": "C", ... }, "proctoring": { "tab_switches": 2 } }
        data = request.get_json() or {}
        submitted_answers = data.get('answers', {})
        proctoring_data = data.get('proctoring', {'tab_switches': 0})
        
        # Check if time expired (allow 2-minute buffer)
        started_at = test.get('started_at')
        if started_at:
            time_limit = timedelta(minutes=test.get('time_limit_minutes', 30))
            buffer = timedelta(minutes=2)
            if datetime.utcnow() > (started_at + time_limit + buffer):
                # Optionally auto-submit or log warning, let's process anyway but mark it
                print("Submission received after time limit expired.")
                
        # Grade the test or bypass if cheating detected
        if proctoring_data.get('cheating_detected'):
            grading = {
                'score': 0,
                'total': len(test.get('questions', [])),
                'percentage': 0,
                'passed': False,
                'topic_breakdown': {},
                'details': "Terminated automatically due to strict violation of proctoring rules (switched tabs too many times)."
            }
            print(f"Test {test_id} terminated due to cheating.")
        else:
            grading = grade_test(
                questions=test.get('questions', []),
                submitted_answers=submitted_answers,
                pass_percentage=test.get('pass_percentage', 60)
            )
        
        # Save results to DB
        result_doc = {
            'test_id': ObjectId(test_id),
            'user_id': ObjectId(g.user['_id']),
            'answers': submitted_answers,
            'proctoring': proctoring_data,
            'score': grading['score'],
            'total': grading['total'],
            'percentage': grading['percentage'],
            'passed': grading['passed'],
            'topic_breakdown': grading['topic_breakdown'],
            'details': grading['details'],
            'submitted_at': datetime.utcnow()
        }
        
        result_insert = db.results.insert_one(result_doc)
        result_id = str(result_insert.inserted_id)
        
        # Update test document
        db.tests.update_one(
            {'_id': ObjectId(test_id)},
            {'$set': {
                'status': 'completed',
                'completed_at': datetime.utcnow(),
                'result_id': ObjectId(result_id)
            }}
        )
        
        return jsonify({
            'message': 'Test submitted and graded successfully',
            'result_id': result_id,
            'score': grading['score'],
            'total': grading['total'],
            'percentage': grading['percentage'],
            'passed': grading['passed']
        }), 200
        
    except Exception as e:
        print(f"Error in submit_test: {str(e)}")
        return jsonify({'message': f'Failed to submit test: {str(e)}'}), 500

@test_bp.route('/results/<test_id>', methods=['GET'])
@token_required
def get_test_results(test_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        test = db.tests.find_one({'_id': ObjectId(test_id)})
        if not test:
            return jsonify({'message': 'Test not found'}), 404
            
        if g.user['role'] != 'admin' and str(test['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized to view this test result'}), 403
            
        result = db.results.find_one({'test_id': ObjectId(test_id)})
        if not result:
            return jsonify({'message': 'Results not found for this test'}), 404
            
        # Convert IDs to strings
        result['_id'] = str(result['_id'])
        result['test_id'] = str(result['test_id'])
        result['user_id'] = str(result['user_id'])
        result['submitted_at'] = result['submitted_at'].isoformat()
        
        # Get associated interview decision if it exists
        interview = db.interviews.find_one({'test_id': ObjectId(test_id)})
        if interview:
            result['interview_decision'] = interview.get('decision', 'Pending')
            result['interview_score'] = interview.get('score', 0)
            result['interview_technical_score'] = interview.get('technical_score', 0)
            result['interview_communication_score'] = interview.get('communication_score', 0)
            result['interview_confidence_score'] = interview.get('confidence_score', 0)
            result['interview_strengths'] = interview.get('strengths', [])
            result['interview_weaknesses'] = interview.get('weaknesses', [])
            result['interview_feedback'] = interview.get('feedback', '')
            result['interview_proctoring'] = interview.get('proctoring', {'tab_switches': 0})
        else:
            result['interview_decision'] = 'Not Started'
            result['interview_score'] = 0
            result['interview_technical_score'] = 0
            result['interview_communication_score'] = 0
            result['interview_confidence_score'] = 0
            result['interview_strengths'] = []
            result['interview_weaknesses'] = []
            result['interview_feedback'] = ''
            result['interview_proctoring'] = {'tab_switches': 0}
        
        # Also append basic test info
        result['time_limit_minutes'] = test.get('time_limit_minutes')
        result['pass_percentage'] = test.get('pass_percentage')
        
        return jsonify({'results': result}), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve results: {str(e)}'}), 500

@test_bp.route('/my-tests', methods=['GET'])
@token_required
def my_tests():
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        # Fetch tests with result information
        tests = list(db.tests.find({'user_id': ObjectId(g.user['_id'])}))
        
        sanitized_tests = []
        for t in tests:
            test_id = str(t['_id'])
            
            # Fetch score if completed
            score_data = None
            if t.get('status') == 'completed':
                res = db.results.find_one({'test_id': t['_id']}, {'score': 1, 'total': 1, 'percentage': 1, 'passed': 1})
                if res:
                    score_data = {
                        'score': res.get('score'),
                        'total': res.get('total'),
                        'percentage': res.get('percentage'),
                        'passed': res.get('passed')
                    }
                    
            # Get associated resume filename
            resume = db.resumes.find_one({'_id': t.get('resume_id')}, {'filename': 1})
            filename = resume.get('filename', 'Unknown Resume') if resume else 'Deleted Resume'
            
            # Fetch interview decision
            interview = db.interviews.find_one({'test_id': t['_id']})
            interview_decision = interview.get('decision') if interview else 'Not Started'
            
            sanitized_tests.append({
                'test_id': test_id,
                'resume_id': str(t.get('resume_id')),
                'resume_filename': filename,
                'status': t.get('status'),
                'time_limit_minutes': t.get('time_limit_minutes'),
                'created_at': t.get('created_at').isoformat() if t.get('created_at') else None,
                'results': score_data,
                'interview_decision': interview_decision
            })
            
        return jsonify({'tests': sanitized_tests}), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve tests: {str(e)}'}), 500
