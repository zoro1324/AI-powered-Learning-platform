"""
Test script for the new enrollment flow with pre-knowledge assessment and syllabus generation.

Tests:
1. PreKnowledgeAssessment - determine_question_count
2. PreKnowledgeAssessment - generate_questions
3. PreKnowledgeAssessment - evaluate_assessment
4. SyllabusGenerator - generate_syllabus with two-layer validation
"""

import os
import sys
import json
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
django.setup()

from api.services.pre_assessment_service import PreKnowledgeAssessment
from api.services.syllabus_service import SyllabusGenerator


def test_question_count_determination():
    """Test LLM-based question count determination"""
    print("\n" + "="*70)
    print("TEST 1: Question Count Determination")
    print("="*70)
    
    assessment = PreKnowledgeAssessment()
    
    # Test with a simple course
    print("\n[Simple Course: Introduction to Python]")
    result = assessment.determine_question_count(
        course_name="Introduction to Python",
        course_description="Basic Python programming for beginners",
        difficulty="beginner"
    )
    print(f"Recommended questions: {result.recommended_question_count}")
    print(f"Reasoning: {result.reasoning}")
    
    # Test with a complex course
    print("\n[Complex Course: Advanced Machine Learning]")
    result = assessment.determine_question_count(
        course_name="Advanced Machine Learning",
        course_description="Deep learning, neural networks, and advanced ML algorithms",
        difficulty="advanced"
    )
    print(f"Recommended questions: {result.recommended_question_count}")
    print(f"Reasoning: {result.reasoning}")
    
    return True


def test_question_generation():
    """Test MCQ question generation with 'I don't know' option"""
    print("\n" + "="*70)
    print("TEST 2: Question Generation")
    print("="*70)
    
    assessment = PreKnowledgeAssessment()
    
    print("\n[Generating 5 questions for Web Development]")
    question_set = assessment.generate_questions(
        course_name="Web Development Basics",
        course_description="HTML, CSS, JavaScript fundamentals",
        difficulty="beginner",
        question_count=5
    )
    
    print(f"\nGenerated {len(question_set.questions)} questions:")
    for i, q in enumerate(question_set.questions, 1):
        print(f"\nQuestion {i} (Topic: {q.topic}):")
        print(f"  {q.question_text}")
        print(f"  Options:")
        for j, opt in enumerate(q.options):
            marker = "✓" if j == q.correct_answer_index else " "
            print(f"    {j}. {opt} {marker}")
        print(f"  Explanation: {q.explanation}")
    
    # Verify 4th option is "I don't know"
    assert all("don't know" in q.options[3].lower() for q in question_set.questions), \
        "4th option must be 'I don't know...'"
    
    return question_set


def test_assessment_evaluation(question_set):
    """Test assessment evaluation with topic-level breakdown"""
    print("\n" + "="*70)
    print("TEST 3: Assessment Evaluation")
    print("="*70)
    
    assessment = PreKnowledgeAssessment()
    questions = [q.dict() for q in question_set.questions]
    
    # Test case 1: All correct answers
    print("\n[Test Case 1: All Correct Answers]")
    answers = [q.correct_answer_index for q in question_set.questions]
    result = assessment.evaluate_assessment(questions, answers)
    print(f"Knowledge Level: {result.knowledge_level}")
    print(f"Knowledge %: {result.knowledge_percentage:.1f}%")
    print(f"Correct: {result.correct_answers}, Incorrect: {result.incorrect_answers}, Don't Know: {result.dont_know_answers}")
    print(f"Known Topics: {result.known_topics}")
    print(f"Weak Topics: {result.weak_topics}")
    print(f"Unknown Topics: {result.unknown_topics}")
    
    # Test case 2: Mixed answers with some "I don't know"
    print("\n[Test Case 2: Mixed Performance]")
    answers = [
        question_set.questions[0].correct_answer_index,  # Correct
        (question_set.questions[1].correct_answer_index + 1) % 3,  # Wrong
        3,  # I don't know
        question_set.questions[3].correct_answer_index,  # Correct
        3,  # I don't know
    ]
    result = assessment.evaluate_assessment(questions, answers)
    print(f"Knowledge Level: {result.knowledge_level}")
    print(f"Knowledge %: {result.knowledge_percentage:.1f}%")
    print(f"Correct: {result.correct_answers}, Incorrect: {result.incorrect_answers}, Don't Know: {result.dont_know_answers}")
    print(f"Known Topics: {result.known_topics}")
    print(f"Weak Topics: {result.weak_topics}")
    print(f"Unknown Topics: {result.unknown_topics}")
    
    return result


def test_syllabus_generation(assessment_result):
    """Test two-layer syllabus generation"""
    print("\n" + "="*70)
    print("TEST 4: Two-Layer Syllabus Generation")
    print("="*70)
    
    syllabus_gen = SyllabusGenerator()
    assessment_service = PreKnowledgeAssessment()
    
    # Convert assessment result to dict
    assessment_dict = assessment_service.result_to_dict(assessment_result)
    
    print("\n[Generating syllabus with real-world examples focus]")
    syllabus, history = syllabus_gen.generate_syllabus(
        course_name="Web Development Basics",
        course_description="HTML, CSS, JavaScript fundamentals",
        difficulty="beginner",
        study_method="real_world",
        custom_study_method="",
        assessment_result=assessment_dict,
        max_attempts=3
    )
    
    print(f"\nGeneration took {len(history)} attempt(s)")
    for i, attempt in enumerate(history, 1):
        print(f"\nAttempt {i}:")
        print(f"  Approved: {attempt.get('approved', False)}")
        if not attempt.get('approved'):
            print(f"  Feedback: {attempt.get('feedback', 'N/A')}")
    
    print(f"\n{'='*70}")
    print("FINAL SYLLABUS")
    print(f"{'='*70}")
    print(f"Course: {syllabus.course_name}")
    print(f"Study Method: {syllabus.study_method}")
    print(f"Total Modules: {syllabus.total_modules}")
    print(f"Estimated Hours: {syllabus.total_estimated_hours}")
    
    for i, module in enumerate(syllabus.modules, 1):
        print(f"\n{'─'*70}")
        print(f"Module {i}: {module.module_name}")
        print(f"{'─'*70}")
        print(f"Duration: {module.estimated_hours} hours")
        print(f"Description: {module.module_description}")
        print(f"\nTopics ({len(module.topics)}):")
        for j, topic in enumerate(module.topics, 1):
            print(f"  {j}. {topic.topic_name}")
            print(f"     Short: {topic.short_description}")
            print(f"     Detailed: {topic.detailed_description[:100]}...")
    
    # Test with custom study method
    print("\n" + "="*70)
    print("[Generating syllabus with custom study method]")
    print("="*70)
    
    syllabus_custom, history_custom = syllabus_gen.generate_syllabus(
        course_name="Web Development Basics",
        course_description="HTML, CSS, JavaScript fundamentals",
        difficulty="beginner",
        study_method="custom",
        custom_study_method="Focus on accessibility and responsive design patterns",
        assessment_result=assessment_dict,
        max_attempts=3
    )
    
    print(f"\nCustom method took {len(history_custom)} attempt(s)")
    print(f"Study Method: {syllabus_custom.study_method}")
    print(f"Modules: {syllabus_custom.total_modules}")
    
    return syllabus


def main():
    """Run all tests"""
    print("\n" + "#"*70)
    print("# ENROLLMENT FLOW INTEGRATION TEST")
    print("#"*70)
    
    try:
        # Test 1: Question count determination
        if not test_question_count_determination():
            print("\n❌ Test 1 failed!")
            return
        
        # Test 2: Question generation
        question_set = test_question_generation()
        if not question_set:
            print("\n❌ Test 2 failed!")
            return
        
        # Test 3: Assessment evaluation
        result = test_assessment_evaluation(question_set)
        if not result:
            print("\n❌ Test 3 failed!")
            return
        
        # Test 4: Syllabus generation
        syllabus = test_syllabus_generation(result)
        if not syllabus:
            print("\n❌ Test 4 failed!")
            return
        
        print("\n" + "#"*70)
        print("# ✅ ALL TESTS PASSED!")
        print("#"*70)
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    main()
