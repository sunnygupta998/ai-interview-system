import os
import io
from flask_socketio import emit
from flask import request
from extensions import socketio, get_db
from bson import ObjectId
from interview.bot import transcribe_audio, generate_speech, _get_client

# Store active connections to map socket to interview
# Key: socket.id, Value: interview_id
active_interviews = {}

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    if request.sid in active_interviews:
        del active_interviews[request.sid]

@socketio.on('join_interview')
def handle_join(data):
    interview_id = data.get('interview_id')
    if interview_id:
        active_interviews[request.sid] = interview_id
        print(f"Socket {request.sid} joined interview {interview_id}")

@socketio.on('submit_audio')
def handle_submit_audio(data):
    """
    Receives an audio blob, transcribes it, generates an AI response via streaming,
    and returns the TTS audio.
    """
    interview_id = data.get('interview_id')
    audio_data = data.get('audio') # Bytes
    
    if not interview_id or not audio_data:
        emit('error', {'message': 'Missing data'})
        return
        
    db = get_db()
    
    interview = db.interviews.find_one({'_id': ObjectId(interview_id)})
    if not interview:
        emit('error', {'message': 'Interview not found'})
        return
        
    language = interview.get('language', 'English')
    target_question_count = data.get('target_question_count', 5)
    
    # 1. Transcribe directly from bytes
    try:
        emit('status_update', {'status': 'transcribing'})
        transcription = transcribe_audio(audio_data, language)
        if not transcription:
            transcription = "[Unintelligible audio]"
            
        emit('transcript_update', {'text': transcription, 'role': 'user'})
        
        # Append to transcript
        db.interviews.update_one(
            {'_id': ObjectId(interview_id)},
            {'$push': {'transcript': {'role': 'user', 'content': transcription}}}
        )
        
        # Reload transcript for LLM context
        interview = db.interviews.find_one({'_id': ObjectId(interview_id)})
        transcript = interview.get('transcript', [])
        
        # Calculate if we should wrap up
        user_responses = sum(1 for msg in transcript if msg['role'] == 'user')
        is_closing = user_responses >= target_question_count
        
        # 3. Stream LLM Response
        emit('status_update', {'status': 'thinking'})
        
        # Build LLM Messages
        system_prompt = (
            f"You are conducting a technical interview in {language}. "
            "Keep your responses concise and conversational (1-2 sentences). "
        )
        if is_closing:
            system_prompt += "This is the final turn. Thank the candidate and conclude the interview."
        else:
            system_prompt += "Ask the next technical question based on their previous answers."

        messages = [{"role": "system", "content": system_prompt}]
        for msg in transcript:
            messages.append({"role": "assistant" if msg['role'] == 'ai' else "user", "content": msg['content']})

        groq_client = _get_client()
        stream = groq_client.chat.completions.create(
            messages=messages,
            model="qwen/qwen3.6-27b",
            temperature=0.5,
            max_completion_tokens=2048,
            stream=True,
            reasoning_format="hidden"
        )
        
        full_response = ""
        emit('llm_start', {})
        for chunk in stream:
            if chunk.choices[0].delta.content:
                text_chunk = chunk.choices[0].delta.content
                full_response += text_chunk
                emit('llm_token', {'token': text_chunk})
                
        emit('llm_end', {'full_text': full_response})
        
        # Append AI response to DB
        db.interviews.update_one(
            {'_id': ObjectId(interview_id)},
            {'$push': {'transcript': {'role': 'ai', 'content': full_response}}}
        )
        
        # 4. Generate TTS
        emit('status_update', {'status': 'speaking'})
        # Notice we still attempt TTS (it falls back if Groq doesn't support it)
        audio_content = generate_speech(full_response, language)
        
        if audio_content:
            import base64
            b64_audio = base64.b64encode(audio_content).decode('utf-8')
            emit('tts_audio', {'audio': b64_audio})
        else:
            # Fallback to browser TTS via event
            emit('tts_browser_fallback', {'text': full_response})
            
        emit('status_update', {'status': 'idle'})
        
    except Exception as e:
        print(f"Error in submit_audio socket: {str(e)}")
        emit('error', {'message': str(e)})
