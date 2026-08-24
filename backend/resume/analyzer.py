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
    return genai.GenerativeModel('gemini-3.6-flash')

def _get_groq_client():
    """Returns a configured Groq client, or None if key is missing."""
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key:
        return None
    return Groq(api_key=api_key)

RESUME_SYSTEM_PROMPT = (
    "You are an expert recruitment AI assistant. Your task is to analyze candidate resumes and extract technical information "
    "to assist with screening and creating custom assessments. "
    "Analyze the provided resume text and extract the details requested in JSON format. "
    "You must return ONLY a valid JSON object. Do not include any introductory or concluding text, and do not use markdown code block wrappers (like ```json). "
    "The JSON object must have exactly the following structure:\n"
    "{\n"
    "  \"name\": \"Candidate Full Name or empty string\",\n"
    "  \"email\": \"Candidate Email or empty string\",\n"
    "  \"phone\": \"Candidate Phone number or empty string\",\n"
    "  \"skills\": [\n"
    "     { \"name\": \"Skill Name\", \"category\": \"Category name (e.g. Programming Languages, Frameworks, Databases, Tools)\", \"proficiency\": \"beginner|intermediate|advanced\" }\n"
    "  ],\n"
    "  \"experience_years\": 5,\n"
    "  \"education\": [ \"degree, major, university, year\" ],\n"
    "  \"domain\": \"Primary technical domain (e.g. Web Development, Frontend Development, Backend Development, Mobile Development, Data Science, DevOps, Cloud Engineering, QA Automation)\",\n"
    "  \"summary\": \"Brief professional profile summary based on their experience\",\n"
    "  \"suggested_topics\": [ \"Topic Name 1\", \"Topic Name 2\" ]\n"
    "}"
)

FALLBACK_RESULT = {
    "name": "Unknown Candidate",
    "email": "",
    "phone": "",
    "skills": [],
    "experience_years": 0,
    "education": [],
    "domain": "Software Development",
    "summary": "Error analyzing resume. Please check your API keys.",
    "suggested_topics": ["General Programming"]
}

def _analyze_with_gemini(resume_text):
    """Try analyzing with Gemini first (higher quality)."""
    model = _get_gemini_model()
    if not model:
        raise ValueError("GEMINI_API_KEY not configured, skipping to Groq.")
    
    response = model.generate_content(
        f"{RESUME_SYSTEM_PROMPT}\n\nHere is the resume text to analyze:\n\n{resume_text}",
        generation_config=genai.types.GenerationConfig(
            temperature=0.3,
            max_output_tokens=4096,
            response_mime_type="application/json"
        )
    )
    return json.loads(response.text)

def _analyze_with_groq(resume_text):
    """Fallback: analyze with Groq Llama (ultra-fast)."""
    client = _get_groq_client()
    if not client:
        raise ValueError("GROQ_API_KEY not configured either. Cannot analyze resume.")
    
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": RESUME_SYSTEM_PROMPT},
            {"role": "user", "content": f"Here is the resume text to analyze:\n\n{resume_text}"}
        ],
        model="qwen/qwen3.6-27b",
        temperature=0.3,
        max_completion_tokens=4096,
        response_format={"type": "json_object"},
        reasoning_format="hidden"
    )
    return json.loads(response.choices[0].message.content)

def analyze_resume(resume_text):
    """
    Analyzes resume text using AI. Tries Gemini first for quality,
    falls back to Groq if Gemini hits rate limits or errors.
    """
    # Try Gemini first
    try:
        result = _analyze_with_gemini(resume_text)
        print("[OK] Resume analyzed with Gemini")
        return result
    except Exception as gemini_err:
        print(f"[WARN] Gemini failed ({str(gemini_err)}), falling back to Groq...")
    
    # Fallback to Groq
    try:
        result = _analyze_with_groq(resume_text)
        print("[OK] Resume analyzed with Groq (fallback)")
        return result
    except Exception as groq_err:
        print(f"[ERROR] Groq also failed: {str(groq_err)}")
        return FALLBACK_RESULT
