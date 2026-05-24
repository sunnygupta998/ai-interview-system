def grade_test(questions, submitted_answers, pass_percentage):
    """
    Grades a test submission.
    
    questions: list of question dictionaries (complete with correct_answer, etc.)
    submitted_answers: dict mapping question ID (as string or int) to candidate's answer letter (A/B/C/D)
    pass_percentage: minimum percentage required to pass
    """
    total = len(questions)
    correct = 0
    topic_breakdown = {}
    details = []
    
    for q in questions:
        q_id = q.get('id')
        q_id_str = str(q_id)
        
        # Get selected answer
        # Supports keys as string or int
        selected_answer = submitted_answers.get(q_id_str)
        if selected_answer is None:
            selected_answer = submitted_answers.get(q_id)
            
        correct_answer = q.get('correct_answer')
        category = q.get('skill_category', 'General')
        
        is_correct = False
        if selected_answer and selected_answer.strip().upper() == correct_answer.strip().upper():
            is_correct = True
            correct += 1
            
        # Update topic breakdown
        if category not in topic_breakdown:
            topic_breakdown[category] = {'correct': 0, 'total': 0}
            
        topic_breakdown[category]['total'] += 1
        if is_correct:
            topic_breakdown[category]['correct'] += 1
            
        # Build detail record
        details.append({
            'question_id': q_id,
            'question': q.get('question'),
            'options': q.get('options'),
            'correct_answer': correct_answer,
            'submitted_answer': selected_answer,
            'is_correct': is_correct,
            'explanation': q.get('explanation'),
            'difficulty': q.get('difficulty'),
            'skill_category': category
        })
        
    # Finalize percentages for topic breakdown
    for cat, stats in topic_breakdown.items():
        stats['percentage'] = round((stats['correct'] / stats['total']) * 100, 2)
        
    percentage = round((correct / total) * 100, 2) if total > 0 else 0.0
    passed = percentage >= pass_percentage
    
    return {
        'score': correct,
        'total': total,
        'percentage': percentage,
        'passed': passed,
        'topic_breakdown': topic_breakdown,
        'details': details
    }
