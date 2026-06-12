from groq import Groq
import google.generativeai as genai
import json
from flask import current_app

def _get_client():
    """Returns a configured Groq client for real-time interview functions."""
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in backend settings.")
    return Groq(api_key=api_key)

def _get_gemini_model():
    """Returns a configured Gemini model for quality-critical functions."""
    api_key = current_app.config.get('GEMINI_API_KEY')
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-2.0-flash')

def transcribe_audio(audio_bytes, language='English'):
    """
    Transcribes an audio file using Groq's Whisper API.
    Stays on Groq for ultra-fast real-time transcription.
    """
    client = _get_client()
    try:
        lang_code = "en"
        if language.lower() == 'hindi':
            lang_code = "hi"
            
        # Ensure audio_bytes is strictly bytes
        if isinstance(audio_bytes, dict) and 'data' in audio_bytes:
            audio_bytes = bytes(audio_bytes['data'])
        elif not isinstance(audio_bytes, (bytes, bytearray)):
            audio_bytes = bytes(audio_bytes)
            
        transcription = client.audio.transcriptions.create(
            file=("audio.webm", audio_bytes),
            model="whisper-large-v3",
            response_format="json",
            language=lang_code
        )
        
        # Whisper tends to hallucinate "Thank you." or "Thanks for watching" on silent audio
        text = transcription.text.strip()
        lower_text = text.lower()
        if lower_text in ["thank you.", "thank you", "thanks for watching.", "thanks for watching"]:
            text = "[Unintelligible audio / Silence detected]"
            
        return text
    except Exception as e:
        print(f"Error transcribing audio: {str(e)}")
        return f"Transcription error: {str(e)}"

def generate_first_question(resume_skills, domain, language='English'):
    """
    Generates the first question for the live interview.
    Stays on Groq for ultra-fast real-time response.
    """
    client = _get_client()
    
    lang_instruction = "Respond entirely in English."
    if language.lower() == 'hindi':
        lang_instruction = "Respond entirely in Hindi (written in Devanagari script)."
    elif language.lower() == 'both':
        lang_instruction = "Respond in a mix of Hindi and English (Hinglish, conversational)."

    skills_str = ", ".join([s.get('name', '') for s in resume_skills.get('skills', [])])
    
    system_prompt = (
        "You are an expert technical interviewer conducting a live voice interview with a candidate. "
        "The candidate has just joined the call. You need to greet them briefly and ask the first technical question "
        f"based on their domain ({domain}) and skills ({skills_str}).\n\n"
        f"CRITICAL INSTRUCTION: {lang_instruction}\n\n"
        "Keep your response concise and conversational (under 3 sentences). Do not provide answers, just the question. "
        "Do not include any placeholders like [Candidate Name]."
    )

    try:
        response = client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_completion_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating first question: {str(e)}")
        if language.lower() == 'hindi':
            return "नमस्ते! कृपया मुझे अपने पिछले प्रोजेक्ट के बारे में बताएं।"
        return "Hello! Please tell me about your most recent technical project."

def generate_next_question(transcript, language='English'):
    """
    Generates the next question based on the interview transcript.
    Stays on Groq for ultra-fast real-time conversation.
    """
    client = _get_client()
    
    lang_instruction = "Respond entirely in English."
    if language.lower() == 'hindi':
        lang_instruction = "Respond entirely in Hindi (written in Devanagari script)."
    elif language.lower() == 'both':
        lang_instruction = "Respond in a mix of Hindi and English (Hinglish, conversational)."

    # Format transcript for prompt
    formatted_transcript = ""
    for msg in transcript[-6:]:  # Only send the last few messages for context window efficiency
        role = "Interviewer" if msg['role'] == 'ai' else "Candidate"
        formatted_transcript += f"{role}: {msg['content']}\n"

    system_prompt = (
        "You are an expert technical interviewer conducting a live voice interview. "
        "Below is the recent transcript of the conversation.\n"
        "Evaluate the candidate's last answer. If it was good, acknowledge it briefly and ask a follow-up question or move to a new topic. "
        "If it was incorrect, politely correct them and move on.\n\n"
        f"CRITICAL INSTRUCTION: {lang_instruction}\n\n"
        "Keep your response concise and conversational (under 3 sentences). Ask exactly ONE clear question at the end."
    )

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcript:\n{formatted_transcript}\n\nGenerate your next response/question:"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.6,
            max_completion_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating next question: {str(e)}")
        if language.lower() == 'hindi':
            return "धन्यवाद। आपका अगला सवाल क्या है?"
        return "Thank you. Let's move on to the next topic. Can you explain your experience with databases?"

def _evaluate_with_gemini(formatted_transcript, system_prompt):
    """Try evaluating with Gemini (higher quality grading)."""
    model = _get_gemini_model()
    if not model:
        raise ValueError("GEMINI_API_KEY not configured, skipping to Groq.")
    
    response = model.generate_content(
        f"{system_prompt}\n\nInterview Transcript:\n{formatted_transcript}",
        generation_config=genai.types.GenerationConfig(
            temperature=0.3,
            max_output_tokens=1000,
            response_mime_type="application/json"
        )
    )
    return json.loads(response.text)

def _evaluate_with_groq(formatted_transcript, system_prompt):
    """Fallback: evaluate with Groq Llama."""
    client = _get_client()
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Interview Transcript:\n{formatted_transcript}"}
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_completion_tokens=1000,
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

def evaluate_interview(transcript, language='English'):
    """
    Evaluates the full interview transcript and makes a hiring decision.
    Tries Gemini first (smarter grading), falls back to Groq if rate limited.
    """
    # Format full transcript
    formatted_transcript = ""
    for msg in transcript:
        role = "Interviewer" if msg['role'] == 'ai' else "Candidate"
        formatted_transcript += f"{role}: {msg['content']}\n"

    system_prompt = (
        "You are an expert technical recruiter evaluating a candidate's live voice interview performance. "
        "Review the following interview transcript and decide if the candidate should be 'Selected' or 'Not Selected'. "
        "Provide a comprehensive grading rubric based on their technical accuracy, communication skills, and confidence.\n\n"
        "You MUST return ONLY a valid JSON object with EXACTLY the following structure:\n"
        "{\n"
        "  \"technical_score\": 85,\n"
        "  \"communication_score\": 90,\n"
        "  \"confidence_score\": 80,\n"
        "  \"overall_score\": 85,\n"
        "  \"strengths\": [\"string\", \"string\", \"string\"],\n"
        "  \"weaknesses\": [\"string\", \"string\", \"string\"],\n"
        "  \"decision\": \"Selected\" or \"Not Selected\",\n"
        "  \"feedback\": \"Your detailed feedback paragraph here (in English)...\"\n"
        "}\n"
        "Ensure all scores are integers between 0 and 100. Always provide exactly 3 bullet points for strengths and weaknesses."
    )

    # Try Gemini first (higher quality evaluation)
    try:
        result = _evaluate_with_gemini(formatted_transcript, system_prompt)
        print("[OK] Interview evaluated with Gemini")
        return result
    except Exception as gemini_err:
        print(f"[WARN] Gemini failed ({str(gemini_err)}), falling back to Groq...")

    # Fallback to Groq
    try:
        result = _evaluate_with_groq(formatted_transcript, system_prompt)
        print("[OK] Interview evaluated with Groq (fallback)")
        return result
    except Exception as groq_err:
        print(f"[ERROR] Groq also failed: {str(groq_err)}")
        return {
            "technical_score": 0,
            "communication_score": 0,
            "confidence_score": 0,
            "overall_score": 0,
            "strengths": ["Data unavailable"],
            "weaknesses": ["Data unavailable"],
            "decision": "Pending",
            "feedback": "An error occurred during evaluation."
        }


def generate_speech(text, language='English'):
    """
    Generates speech audio from text using Groq TTS.
    Stays on Groq for real-time voice generation.
    """
    client = _get_client()
    try:
        response = client.audio.speech.create(
            model="canopylabs/orpheus-v1-english",
            voice="canopylabs/orpheus-v1-english",
            input=text
        )
        return response.content
    except Exception as e:
        print(f"Error generating speech: {str(e)}")
        return None
