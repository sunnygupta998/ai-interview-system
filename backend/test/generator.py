from groq import Groq
import json
from flask import current_app

def generate_questions(skills_analysis, settings):
    """
    Generates a set of multiple-choice questions based on candidate's skills analysis and settings.
    Calls Groq API with llama-3.3-70b-versatile.
    """
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in backend settings.")

    client = Groq(api_key=api_key)
    
    questions_per_test = settings.get('questions_per_test', 20)
    difficulty_mix = settings.get('difficulty_mix', {'easy': 30, 'medium': 50, 'hard': 20})
    
    # Calculate target counts
    easy_count = int(round(questions_per_test * difficulty_mix.get('easy', 30) / 100))
    medium_count = int(round(questions_per_test * difficulty_mix.get('medium', 50) / 100))
    hard_count = questions_per_test - easy_count - medium_count
    
    # Format skills for prompt
    skills_list = []
    for skill in skills_analysis.get('skills', []):
        skills_list.append(f"{skill.get('name')} ({skill.get('proficiency', 'intermediate')})")
    
    skills_str = ", ".join(skills_list) if skills_list else "General Software Development"
    domain = skills_analysis.get('domain', 'Software Development')
    experience_years = skills_analysis.get('experience_years', 2)
    suggested_topics = ", ".join(skills_analysis.get('suggested_topics', []))

    system_prompt = (
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
        "        \"correct_answer\": \"A\", // MUST be A, B, C, or D\n"
        "        \"explanation\": \"Explanation of why this answer is correct...\",\n"
        "        \"difficulty\": \"easy|medium|hard\",\n"
        "        \"skill_category\": \"The name of the skill tested (e.g. React, Python, Docker)\"\n"
        "     }\n"
        "  ]\n"
        "}"
    )

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the technical MCQ question set now."}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_completion_tokens=4096,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        generated_data = json.loads(result_text)
        return generated_data.get('questions', [])
        
    except Exception as e:
        print(f"Error during Groq MCQ generation: {str(e)}")
        # Provide fallback question set if API fails, so the user can test the system flow
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
