import google.generativeai as genai
from groq import Groq
import json
from flask import current_app

def _get_gemini_model():
    """Returns a configured Gemini model, or None if key is missing."""
    api_key = current_app.config.get('GEMINI_API_KEY')
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-2.0-flash')

def _get_groq_client():
    """Returns a configured Groq client, or None if key is missing."""
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key:
        return None
    return Groq(api_key=api_key)

def _build_mcq_prompt(skills_analysis, settings):
    """Build the MCQ generation prompt from skills and settings."""
    questions_per_test = settings.get('questions_per_test', 20)
    difficulty_mix = settings.get('difficulty_mix', {'easy': 30, 'medium': 50, 'hard': 20})
    
    easy_count = int(round(questions_per_test * difficulty_mix.get('easy', 30) / 100))
    medium_count = int(round(questions_per_test * difficulty_mix.get('medium', 50) / 100))
    hard_count = questions_per_test - easy_count - medium_count
    
    skills_list = []
    for skill in skills_analysis.get('skills', []):
        skills_list.append(f"{skill.get('name')} ({skill.get('proficiency', 'intermediate')})")
    
    skills_str = ", ".join(skills_list) if skills_list else "General Software Development"
    domain = skills_analysis.get('domain', 'Software Development')
    experience_years = skills_analysis.get('experience_years', 2)
    suggested_topics = ", ".join(skills_analysis.get('suggested_topics', []))

    return (
        "You are an expert technical interviewer. Your task is to generate high-quality, professional multiple-choice questions (MCQs) "
        "to test a candidate's technical skills.\n\n"
        f"Candidate Domain: {domain}\n"
        f"Candidate Experience Level: {experience_years} years\n"
        f"Candidate Skills: {skills_str}\n"
        f"Suggested Topics: {suggested_topics}\n\n"
        f"You must generate EXACTLY {questions_per_test} questions in total with the following difficulty breakdown:\n"
        f"- {easy_count} Easy questions\n"
        f"- {medium_count} Medium questions\n"
        f"- {hard_count} Hard questions\n\n"
        "Ensure all questions are directly relevant to the candidate's skills and the suggested topics. "
        "For each question, provide 4 options (A, B, C, D), indicate the correct answer, give a clear explanation, and categorize it by skill and difficulty.\n\n"
        "You must return ONLY a valid JSON object. Do not include any introductory or concluding text, and do not use markdown code block wrappers (like ```json). "
        "The JSON object must have exactly the following structure:\n"
        "{\n"
        "  \"questions\": [\n"
        "     {\n"
        "        \"id\": 1,\n"
        "        \"question\": \"Question text here...\",\n"
        "        \"options\": {\n"
        "           \"A\": \"Option A text\",\n"
        "           \"B\": \"Option B text\",\n"
        "           \"C\": \"Option C text\",\n"
        "           \"D\": \"Option D text\"\n"
        "        },\n"
        "        \"correct_answer\": \"A\",\n"
        "        \"explanation\": \"Explanation of why this answer is correct...\",\n"
        "        \"difficulty\": \"easy|medium|hard\",\n"
        "        \"skill_category\": \"The name of the skill tested (e.g. React, Python, Docker)\"\n"
        "     }\n"
        "  ]\n"
        "}"
    )

def _generate_with_gemini(prompt):
    """Try generating questions with Gemini (higher quality)."""
    model = _get_gemini_model()
    if not model:
        raise ValueError("GEMINI_API_KEY not configured, skipping to Groq.")
    
    response = model.generate_content(
        f"{prompt}\n\nGenerate the technical MCQ question set now.",
        generation_config=genai.types.GenerationConfig(
            temperature=0.5,
            max_output_tokens=8192,
            response_mime_type="application/json"
        )
    )
    return json.loads(response.text).get('questions', [])

def _generate_with_groq(prompt):
    """Fallback: generate questions with Groq Llama (ultra-fast)."""
    client = _get_groq_client()
    if not client:
        raise ValueError("GROQ_API_KEY not configured either. Cannot generate questions.")
    
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Generate the technical MCQ question set now."}
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.5,
        max_completion_tokens=4096,
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content).get('questions', [])

def _get_fallback_questions(questions_per_test):
    """Return fallback questions if both APIs fail."""
    fallback_questions = []
    for i in range(1, questions_per_test + 1):
        fallback_questions.append({
            "id": i,
            "question": f"Sample Technical Question {i} - What is the purpose of a database index?",
            "options": {
                "A": "To compress data size on disk",
                "B": "To secure data from external threats",
                "C": "To speed up retrieval of data rows from tables",
                "D": "To perform database backups automatically"
            },
            "correct_answer": "C",
            "explanation": "A database index is a data structure that improves the speed of data retrieval operations on a database table.",
            "difficulty": "medium" if i % 2 == 0 else "easy",
            "skill_category": "Database"
        })
    return fallback_questions

def generate_questions(skills_analysis, settings):
    """
    Generates MCQ questions using AI. Tries Gemini first for quality,
    falls back to Groq if Gemini hits rate limits or errors.
    """
    prompt = _build_mcq_prompt(skills_analysis, settings)
    questions_per_test = settings.get('questions_per_test', 20)
    
    # Try Gemini first
    try:
        questions = _generate_with_gemini(prompt)
        print("[OK] MCQs generated with Gemini")
        return questions
    except Exception as gemini_err:
        print(f"[WARN] Gemini failed ({str(gemini_err)}), falling back to Groq...")
    
    # Fallback to Groq
    try:
        questions = _generate_with_groq(prompt)
        print("[OK] MCQs generated with Groq (fallback)")
        return questions
    except Exception as groq_err:
        print(f"[ERROR] Groq also failed: {str(groq_err)}")
        return _get_fallback_questions(questions_per_test)
