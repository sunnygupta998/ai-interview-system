from groq import Groq
import json
from flask import current_app

def analyze_resume(resume_text):
    """
    Analyzes resume text using the Groq API Llama-3.3-70b model and returns structured analysis.
    """
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in backend settings.")

    client = Groq(api_key=api_key)

    system_prompt = (
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
        "  \"experience_years\": 5, // estimated total years of technical experience as an integer\n"
        "  \"education\": [ \"degree, major, university, year\" ],\n"
        "  \"domain\": \"Primary technical domain (e.g. Web Development, Frontend Development, Backend Development, Mobile Development, Data Science, DevOps, Cloud Engineering, QA Automation)\",\n"
        "  \"summary\": \"Brief professional profile summary based on their experience\",\n"
        "  \"suggested_topics\": [ \"Topic Name 1\", \"Topic Name 2\" ] // 3 to 6 technical topics extracted from their resume that would be suitable to generate technical multiple-choice questions on\n"
        "}"
    )

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the resume text to analyze:\n\n{resume_text}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_completion_tokens=4096,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        analysis_data = json.loads(result_text)
        return analysis_data
        
    except Exception as e:
        print(f"Error during Groq resume analysis: {str(e)}")
        # Return a fallback structured dictionary if API call fails, so the system doesn't crash completely.
        return {
            "name": "Unknown Candidate",
            "email": "",
            "phone": "",
            "skills": [],
            "experience_years": 0,
            "education": [],
            "domain": "Software Development",
            "summary": "Error analyzing resume. Please configure a valid GROQ_API_KEY.",
            "suggested_topics": ["General Programming"]
        }
