from flask import Blueprint, request, jsonify, current_app, g
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from auth.middleware import token_required
from interview.bot import generate_first_question, generate_next_question, evaluate_interview, transcribe_audio, generate_speech
from utils.email_service import send_candidate_results_email

interview_bp = Blueprint('interview', __name__)

@interview_bp.route('/start/<test_id>', methods=['POST'])
@token_required
def start_interview(test_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        # Verify test
        test = db.tests.find_one({'_id': ObjectId(test_id)})
        if not test:
            return jsonify({'message': 'Test not found'}), 404
            
        if g.user['role'] != 'admin' and str(test['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized'}), 403
            
        # Get settings for language and question count
        settings = db.settings.find_one() or {}
        language = settings.get('interview_language', 'English')
        target_question_count = settings.get('interview_question_count', 3)
        
        # Get resume details
        resume = db.resumes.find_one({'_id': test.get('resume_id')})
        if not resume:
            return jsonify({'message': 'Resume not found for this test'}), 404
            
        skills_analysis = resume.get('skills_analysis', {})
        domain = skills_analysis.get('domain', 'Software Development')
        
        # Check if interview already exists
        existing_interview = db.interviews.find_one({'test_id': ObjectId(test_id)})
        if existing_interview:
            if existing_interview.get('status') == 'completed':
                return jsonify({'message': 'Interview already completed', 'interview_id': str(existing_interview['_id']), 'status': 'completed'}), 400
            
            # Resume existing interview
            return jsonify({
                'interview_id': str(existing_interview['_id']),
                'transcript': existing_interview.get('transcript', []),
                'language': language,
                'target_question_count': target_question_count
            }), 200
            
        # Generate first question
        first_question = generate_first_question(skills_analysis, domain, language)
        
        transcript = [
            {'role': 'ai', 'content': first_question, 'timestamp': datetime.utcnow().isoformat()}
        ]
        
        interview_doc = {
            'user_id': ObjectId(g.user['_id']),
            'test_id': ObjectId(test_id),
            'transcript': transcript,
            'status': 'in_progress',
            'decision': 'Pending',
            'feedback': '',
            'language': language,
            'target_question_count': target_question_count,
            'ai_questions_asked': 1,
            'created_at': datetime.utcnow()
        }
        
        result = db.interviews.insert_one(interview_doc)
        interview_id = str(result.inserted_id)
        
        return jsonify({
            'interview_id': interview_id,
            'transcript': transcript,
            'language': language,
            'target_question_count': target_question_count,
            'first_question': first_question
        }), 201
        
    except Exception as e:
        print(f"Error starting interview: {str(e)}")
        return jsonify({'message': f'Failed to start interview: {str(e)}'}), 500

@interview_bp.route('/respond/<interview_id>', methods=['POST'])
@token_required
def respond_interview(interview_id):
    try:
        data = request.get_json() or {}
        candidate_message = data.get('message')
        
        if not candidate_message:
            return jsonify({'message': 'Message is required'}), 400
            
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        interview = db.interviews.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Interview not found'}), 404
            
        if interview.get('status') == 'completed':
            return jsonify({'message': 'Interview is already completed'}), 400
            
        transcript = interview.get('transcript', [])
        language = interview.get('language', 'English')
        target_count = interview.get('target_question_count', 3)
        questions_asked = interview.get('ai_questions_asked', 0)
        
        # Add candidate message
        transcript.append({'role': 'candidate', 'content': candidate_message, 'timestamp': datetime.utcnow().isoformat()})
        
        # Check if we should end the interview
        if questions_asked >= target_count:
            if interview.get('is_practice', False):
                score = 0
                decision = 'Practice Completed'
                feedback = 'Practice interview completed successfully. No formal evaluation generated.'
            else:
                # Evaluate the interview
                evaluation = evaluate_interview(transcript, language)
                score = evaluation.get('score', 0)
                decision = evaluation.get('decision', 'Not Selected')
                feedback = evaluation.get('feedback', '')
            
            final_message = "Thank you for your time. The interview is now complete."
            if language.lower() == 'hindi':
                final_message = "अपना समय देने के लिए धन्यवाद। साक्षात्कार अब समाप्त हो गया है।"
            elif language.lower() == 'both':
                final_message = "Thank you for your time. Interview complete हो गया है।"
                
            transcript.append({'role': 'ai', 'content': final_message, 'timestamp': datetime.utcnow().isoformat()})
            
            db.interviews.update_one(
                {'_id': ObjectId(interview_id)},
                {'$set': {
                    'transcript': transcript,
                    'status': 'completed',
                    'score': score,
                    'decision': decision,
                    'feedback': feedback,
                    'completed_at': datetime.utcnow()
                }}
            )
            
            # Send Email if not practice
            if not interview.get('is_practice', False):
                user = db.users.find_one({'_id': ObjectId(g.user['_id'])})
                if user and user.get('email'):
                    try:
                        send_candidate_results_email(
                            to_email=user.get('email'),
                            to_name=user.get('name', 'Candidate'),
                            score=score,
                            decision=decision,
                            feedback=feedback
                        )
                    except Exception as email_err:
                        print(f"Failed to send email: {email_err}")
            
            return jsonify({
                'is_complete': True,
                'final_message': final_message,
                'decision': decision,
                'feedback': feedback,
                'transcript': transcript
            }), 200
            
        else:
            # Generate next question
            next_question = generate_next_question(transcript, language)
            transcript.append({'role': 'ai', 'content': next_question, 'timestamp': datetime.utcnow().isoformat()})
            questions_asked += 1
            
            db.interviews.update_one(
                {'_id': ObjectId(interview_id)},
                {'$set': {
                    'transcript': transcript,
                    'ai_questions_asked': questions_asked
                }}
            )
            
            return jsonify({
                'is_complete': False,
                'next_message': next_question,
                'transcript': transcript
            }), 200
            
    except Exception as e:
        print(f"Error responding to interview: {str(e)}")
        return jsonify({'message': f'Failed to process response: {str(e)}'}), 500

@interview_bp.route('/transcribe', methods=['POST'])
@token_required
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'message': 'No audio file provided'}), 400
        
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
        
    try:
        audio_bytes = file.read()
        filename = file.filename
        
        # In case the blob doesn't have a specific filename, default to a webm
        if filename == 'blob':
            filename = 'recording.webm'
            
        transcription = transcribe_audio(audio_bytes, filename)
        
        return jsonify({
            'text': transcription
        }), 200
    except Exception as e:
        print(f"Error in transcribe route: {str(e)}")
        return jsonify({'message': f'Failed to transcribe audio: {str(e)}'}), 500

@interview_bp.route('/tts', methods=['GET'])
@token_required
def text_to_speech():
    text = request.args.get('text')
    lang = request.args.get('lang', 'English')
    if not text:
        return jsonify({'message': 'Text is required'}), 400
        
    try:
        audio_data = generate_speech(text, lang)
        if not audio_data:
            return jsonify({'message': 'Failed to generate audio'}), 500
            
        import io
        from flask import send_file
        return send_file(
            io.BytesIO(audio_data),
            mimetype='audio/wav'
        )
    except Exception as e:
        print(f"TTS Error: {str(e)}")
        return jsonify({'message': f'Failed to generate TTS: {str(e)}'}), 500


@interview_bp.route('/end/<interview_id>', methods=['POST'])
@token_required
def end_interview(interview_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        interview = db.interviews.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Interview not found'}), 404
            
        if interview.get('status') == 'completed':
            return jsonify({'message': 'Interview is already completed'}), 400
            
        transcript = interview.get('transcript', [])
        language = interview.get('language', 'English')
        
        # Read proctoring data from request if available
        data = request.get_json(silent=True) or {}
        proctoring_data = data.get('proctoring', {'tab_switches': 0})
        
        target_count = interview.get('target_question_count', 3)
        user_responses = sum(1 for msg in transcript if msg['role'] in ['user', 'candidate'])
        is_practice = interview.get('is_practice', False)
        
        if proctoring_data.get('cheating_detected'):
            # Skip evaluation and give 0 score
            overall_score = 0
            technical_score = 0
            communication_score = 0
            confidence_score = 0
            strengths = ["None"]
            weaknesses = ["Failed to adhere to academic integrity guidelines (tab-switching violation)."]
            decision = "Not Selected"
            feedback = "Interview terminated automatically due to strict violation of proctoring rules (switched tabs too many times)."
            print(f"Interview {interview_id} terminated due to cheating.")
        elif is_practice or user_responses < target_count:
            # Skip evaluation
            overall_score = 0
            technical_score = 0
            communication_score = 0
            confidence_score = 0
            strengths = ["Not evaluated (practice mode or ended early)"]
            weaknesses = ["Not evaluated (practice mode or ended early)"]
            decision = "Practice Completed" if is_practice else "Incomplete"
            feedback = "Practice interview completed successfully. No formal evaluation generated." if is_practice else "Interview was ended early and not fully completed."
        else:
            # Evaluate the interview
            evaluation = evaluate_interview(transcript, language)
            technical_score = evaluation.get('technical_score', 0)
            communication_score = evaluation.get('communication_score', 0)
            confidence_score = evaluation.get('confidence_score', 0)
            overall_score = evaluation.get('overall_score', 0)
            strengths = evaluation.get('strengths', [])
            weaknesses = evaluation.get('weaknesses', [])
            decision = evaluation.get('decision', 'Not Selected')
            feedback = evaluation.get('feedback', '')
        
        db.interviews.update_one(
            {'_id': ObjectId(interview_id)},
            {'$set': {
                'status': 'completed',
                'score': overall_score,
                'technical_score': technical_score,
                'communication_score': communication_score,
                'confidence_score': confidence_score,
                'strengths': strengths,
                'weaknesses': weaknesses,
                'decision': decision,
                'feedback': feedback,
                'proctoring': proctoring_data,
                'completed_at': datetime.utcnow()
            }}
        )
        
        # Send Email if not practice and fully evaluated
        if not is_practice and decision not in ["Incomplete", "Practice Completed"]:
            user = db.users.find_one({'_id': ObjectId(g.user['_id'])})
            if user and user.get('email'):
                try:
                    send_candidate_results_email(
                        to_email=user.get('email'),
                        to_name=user.get('name', 'Candidate'),
                        score=overall_score,
                        decision=decision,
                        feedback=feedback
                    )
                except Exception as email_err:
                    print(f"Failed to send email: {email_err}")
        
        return jsonify({'message': 'Interview evaluated and completed successfully.'}), 200
    except Exception as e:
        print(f"Error manually ending interview: {str(e)}")
        return jsonify({'message': f'Failed to end interview: {str(e)}'}), 500


@interview_bp.route('/practice/start/<resume_id>', methods=['POST'])
@token_required
def start_practice_interview(resume_id):
    try:
        client = MongoClient(current_app.config['MONGODB_URI'])
        db = client[current_app.config['DB_NAME']]
        
        # Get settings for language and question count
        settings = db.settings.find_one() or {}
        if not settings.get('enable_practice_interview', True):
            return jsonify({'message': 'Practice interviews are disabled'}), 403
            
        language = settings.get('interview_language', 'English')
        target_question_count = settings.get('interview_question_count', 3)
        
        # Get resume details
        resume = db.resumes.find_one({'_id': ObjectId(resume_id)})
        if not resume:
            return jsonify({'message': 'Resume not found'}), 404
            
        if g.user['role'] != 'admin' and str(resume['user_id']) != g.user['_id']:
            return jsonify({'message': 'Unauthorized'}), 403
            
        skills_analysis = resume.get('skills_analysis', {})
        domain = skills_analysis.get('domain', 'Software Development')
        
        # Generate first question
        first_question = generate_first_question(skills_analysis, domain, language)
        
        transcript = [
            {'role': 'ai', 'content': first_question, 'timestamp': datetime.utcnow().isoformat()}
        ]
        
        interview_doc = {
            'user_id': ObjectId(g.user['_id']),
            'resume_id': ObjectId(resume_id),
            'is_practice': True,
            'transcript': transcript,
            'status': 'in_progress',
            'decision': 'Pending',
            'feedback': '',
            'language': language,
            'target_question_count': target_question_count,
            'ai_questions_asked': 1,
            'created_at': datetime.utcnow()
        }
        
        result = db.interviews.insert_one(interview_doc)
        interview_id = str(result.inserted_id)
        
        return jsonify({
            'interview_id': interview_id,
            'transcript': transcript,
            'language': language,
            'target_question_count': target_question_count,
            'first_question': first_question
        }), 201
        
    except Exception as e:
        print(f"Error starting practice interview: {str(e)}")
        return jsonify({'message': f'Failed to start practice interview: {str(e)}'}), 500

