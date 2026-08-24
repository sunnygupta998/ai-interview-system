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

def _build_mcq_prompt(skills_analysis, settings, existing_questions=None):
    """Build the MCQ generation prompt from skills and settings.
    
    Args:
        skills_analysis: The candidate's skills analysis from resume parsing.
        settings: Admin settings with question count, difficulty mix, etc.
        existing_questions: Optional list of already-generated question texts to avoid duplicates
                           when generating supplementary questions.
    """
    questions_per_test = settings.get('questions_per_test', 20)
    difficulty_mix = settings.get('difficulty_mix', {'easy': 30, 'medium': 50, 'hard': 20})
    
    easy_count = int(round(questions_per_test * difficulty_mix.get('easy', 30) / 100))
    medium_count = int(round(questions_per_test * difficulty_mix.get('medium', 50) / 100))
    hard_count = questions_per_test - easy_count - medium_count
    
    skills_list = []
    for skill in skills_analysis.get('skills', [])[:15]:  # Limit to top 15 skills to control prompt size
        skills_list.append(f"{skill.get('name')} ({skill.get('proficiency', 'intermediate')})")
    
    skills_str = ", ".join(skills_list) if skills_list else "General Software Development"
    domain = skills_analysis.get('domain', 'Software Development')
    experience_years = skills_analysis.get('experience_years', 2)
    suggested_topics = ", ".join(skills_analysis.get('suggested_topics', [])[:10])  # Limit topics

    # Build the exclusion clause if we have existing questions to avoid
    exclusion_clause = ""
    if existing_questions and len(existing_questions) > 0:
        exclusion_clause = (
            "\n\nIMPORTANT: The following questions have ALREADY been generated. "
            "You MUST NOT repeat or rephrase any of them. Generate completely NEW and DIFFERENT questions:\n"
        )
        for i, q_text in enumerate(existing_questions, 1):
            exclusion_clause += f"  Already used {i}: \"{q_text}\"\n"

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
        "CRITICAL UNIQUENESS RULES:\n"
        "- Every single question MUST be unique. No two questions should test the same concept, use similar wording, or cover the same topic.\n"
        "- Spread questions across ALL of the candidate's skills — do NOT focus on just one or two skills.\n"
        "- Each question must test a distinctly different concept, even within the same skill category.\n"
        "- Vary question styles: definitional, scenario-based, code-output, debugging, best-practices, and comparison questions.\n\n"
        "Ensure all questions are directly relevant to the candidate's skills and the suggested topics. "
        "For each question, provide 4 options (A, B, C, D), indicate the correct answer, give a clear explanation, and categorize it by skill and difficulty.\n\n"
        f"REMEMBER: You MUST generate EXACTLY {questions_per_test} questions. Not fewer, not more.\n\n"
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
        + exclusion_clause
    )

def _generate_with_gemini(prompt):
    """Try generating questions with Gemini (higher quality)."""
    model = _get_gemini_model()
    if not model:
        raise ValueError("GEMINI_API_KEY not configured, skipping to Groq.")
    
    response = model.generate_content(
        f"{prompt}\n\nGenerate the technical MCQ question set now.",
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=16384,
            response_mime_type="application/json"
        )
    )
    return json.loads(response.text).get('questions', [])

def _generate_with_groq(prompt):
    """Fallback: generate questions with Groq (ultra-fast)."""
    client = _get_groq_client()
    if not client:
        raise ValueError("GROQ_API_KEY not configured either. Cannot generate questions.")
    
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Generate the technical MCQ question set now."}
        ],
        model="qwen/qwen3.6-27b",
        temperature=0.7,
        max_completion_tokens=8192,
        response_format={"type": "json_object"},
        reasoning_format="hidden"
    )
    return json.loads(response.choices[0].message.content).get('questions', [])

def _deduplicate_questions(questions):
    """Remove duplicate questions by comparing normalized question text.
    
    Returns a list of unique questions (keeps the first occurrence).
    """
    seen_texts = set()
    unique_questions = []
    
    for q in questions:
        # Normalize: lowercase, strip whitespace, remove punctuation for comparison
        q_text = q.get('question', '').strip().lower()
        # Create a simplified key by removing extra spaces
        q_key = ' '.join(q_text.split())
        
        if q_key and q_key not in seen_texts:
            seen_texts.add(q_key)
            unique_questions.append(q)
    
    return unique_questions

def _renumber_questions(questions):
    """Re-number question IDs sequentially starting from 1."""
    for i, q in enumerate(questions, 1):
        q['id'] = i
    return questions

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

def _generate_supplementary_questions(skills_analysis, settings, existing_questions, needed_count):
    """Generate additional questions to fill the gap when AI returned fewer than expected.
    
    Args:
        skills_analysis: The candidate's skills analysis.
        settings: Admin settings, overridden to request only the needed count.
        existing_questions: List of already-generated question dicts (to avoid duplicates).
        needed_count: How many more questions are needed.
    
    Returns:
        List of newly generated question dicts.
    """
    # Build a modified settings dict asking for exactly the needed count
    supplementary_settings = dict(settings)
    supplementary_settings['questions_per_test'] = needed_count
    
    # Extract existing question texts for exclusion
    existing_texts = [q.get('question', '') for q in existing_questions]
    
    prompt = _build_mcq_prompt(skills_analysis, supplementary_settings, existing_questions=existing_texts)
    
    # Try Gemini first
    try:
        new_questions = _generate_with_gemini(prompt)
        if new_questions:
            print(f"[OK] Generated {len(new_questions)} supplementary questions with Gemini")
            return new_questions
    except Exception as e:
        print(f"[WARN] Gemini supplementary generation failed: {e}")
    
    # Fallback to Groq
    try:
        new_questions = _generate_with_groq(prompt)
        if new_questions:
            print(f"[OK] Generated {len(new_questions)} supplementary questions with Groq")
            return new_questions
    except Exception as e:
        print(f"[WARN] Groq supplementary generation also failed: {e}")
    
    return []

def generate_questions(skills_analysis, settings):
    """
    Generates MCQ questions using AI. Tries Gemini first for quality,
    falls back to Groq if Gemini hits rate limits or errors.
    
    Includes validation to ensure:
    - Exact question count matches admin settings
    - All questions are unique (no duplicates)
    - Questions are re-numbered sequentially
    """
    prompt = _build_mcq_prompt(skills_analysis, settings)
    questions_per_test = settings.get('questions_per_test', 20)
    questions = []
    
    # ── Step 1: Initial generation ──
    # Try Gemini first
    try:
        questions = _generate_with_gemini(prompt)
        print(f"[OK] MCQs generated with Gemini: {len(questions)} questions")
    except Exception as gemini_err:
        print(f"[WARN] Gemini failed ({str(gemini_err)}), falling back to Groq...")
    
    # Fallback to Groq if Gemini failed or returned nothing
    if not questions:
        try:
            questions = _generate_with_groq(prompt)
            print(f"[OK] MCQs generated with Groq (fallback): {len(questions)} questions")
        except Exception as groq_err:
            print(f"[ERROR] Groq also failed: {str(groq_err)}")
            return _get_fallback_questions(questions_per_test)
    
    # ── Step 2: Deduplicate ──
    original_count = len(questions)
    questions = _deduplicate_questions(questions)
    deduped_count = len(questions)
    
    if deduped_count < original_count:
        print(f"[WARN] Removed {original_count - deduped_count} duplicate questions ({original_count} -> {deduped_count})")
    
    # ── Step 3: Validate count and fill gaps ──
    if len(questions) < questions_per_test:
        needed = questions_per_test - len(questions)
        print(f"[RETRY] Got {len(questions)}/{questions_per_test} questions. Generating {needed} more...")
        
        supplementary = _generate_supplementary_questions(
            skills_analysis, settings, questions, needed
        )
        
        # Deduplicate supplementary against existing
        all_existing_texts = {' '.join(q.get('question', '').strip().lower().split()) for q in questions}
        for sq in supplementary:
            sq_key = ' '.join(sq.get('question', '').strip().lower().split())
            if sq_key and sq_key not in all_existing_texts:
                questions.append(sq)
                all_existing_texts.add(sq_key)
                if len(questions) >= questions_per_test:
                    break
        
        print(f"[INFO] After supplementary generation: {len(questions)}/{questions_per_test} questions")
    
    # ── Step 4: Final fallback padding if still short ──
    if len(questions) < questions_per_test:
        shortfall = questions_per_test - len(questions)
        print(f"[WARN] Still short by {shortfall} questions after retry. Padding with fallback questions.")
        fallback = _get_fallback_questions(shortfall)
        questions.extend(fallback)
    
    # ── Step 5: Trim if AI returned too many ──
    if len(questions) > questions_per_test:
        print(f"[INFO] Trimming excess questions: {len(questions)} -> {questions_per_test}")
        questions = questions[:questions_per_test]
    
    # ── Step 6: Re-number IDs sequentially ──
    questions = _renumber_questions(questions)
    
    print(f"[DONE] Final question set: {len(questions)} questions delivered")
    return questions
