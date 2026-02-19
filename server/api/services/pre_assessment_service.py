"""
Pre-Knowledge Assessment Service

This service handles AI-powered pre-knowledge assessment for course enrollment:
1. Determines optimal number of questions based on course complexity
2. Generates MCQ questions with "I don't know" option
3. Evaluates student answers locally (no LLM needed for grading)
4. Tracks topic-level knowledge gaps
5. Calculates knowledge level (None, Basic, Intermediate, Advanced)
"""

import logging
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from django.conf import settings

logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models for Structured Output
# ============================================================================

class Question(BaseModel):
    """Represents a single MCQ question with answer."""
    question_text: str = Field(..., description="The question to ask")
    topic: str = Field(..., description="The specific topic this question tests (e.g., 'Python basics', 'Data cleaning')")
    options: List[str] = Field(..., description="List of 4 answer options (including 'I don't know about this course')")
    correct_answer_index: int = Field(..., description="Index of the correct answer (0-3)", ge=0, lt=4)
    explanation: str = Field(..., description="Explanation of the correct answer")
    difficulty_hint: str = Field(..., description="What level this question tests: Beginner, Intermediate, or Advanced")
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v: List[str]) -> List[str]:
        """Ensure exactly 4 options with 'I don't know' as last option."""
        dont_know_text = "I don't know about this course"
        
        # Check if we have exactly 4 options
        if len(v) < 3 or len(v) > 4:
            raise ValueError(f'Must have 3-4 options, got {len(v)}')
        
        # Find and remove "I don't know" if it exists
        options_without_dont_know = [opt for opt in v if opt != dont_know_text]
        
        # Ensure we have exactly 3 regular options
        if len(options_without_dont_know) > 3:
            options_without_dont_know = options_without_dont_know[:3]
        
        # Add "I don't know" as the last option
        return options_without_dont_know + [dont_know_text]


class QuestionSet(BaseModel):
    """Represents a set of assessment questions for a course."""
    course_name: str = Field(..., description="Name of the course being assessed")
    questions: List[Question] = Field(..., description="List of assessment questions")
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v: List[Question]) -> List[Question]:
        """Ensure at least 5 questions."""
        if len(v) < 5:
            raise ValueError('Must have at least 5 questions')
        return v


class AssessmentResult(BaseModel):
    """Represents the result of a pre-knowledge assessment."""
    course_name: str = Field(..., description="Name of the course")
    total_questions: int = Field(..., description="Total number of questions")
    correct_answers: int = Field(..., description="Number of correct answers")
    incorrect_answers: int = Field(..., description="Number of incorrect answers")
    dont_know_answers: int = Field(..., description="Number of 'I don't know' responses")
    knowledge_percentage: float = Field(..., description="Percentage of correct answers (0-100)")
    knowledge_level: str = Field(..., description="Assessed knowledge level: None, Basic, Intermediate, or Advanced")
    known_topics: List[str] = Field(default_factory=list, description="Topics the user answered correctly")
    weak_topics: List[str] = Field(default_factory=list, description="Topics the user answered incorrectly")
    unknown_topics: List[str] = Field(default_factory=list, description="Topics the user selected 'I don't know' for")
    
    @field_validator('knowledge_level')
    @classmethod
    def validate_knowledge_level(cls, v: str) -> str:
        """Ensure knowledge level is valid."""
        allowed = ['None', 'Basic', 'Intermediate', 'Advanced']
        if v not in allowed:
            raise ValueError(f'Knowledge level must be one of {allowed}')
        return v


class QuestionCountDecision(BaseModel):
    """LLM decision on how many questions to generate based on course complexity."""
    question_count: int = Field(..., description="Number of questions to generate (5-15)", ge=5, le=15)
    reasoning: str = Field(..., description="Brief explanation of why this number was chosen")


# ============================================================================
# Pre-Knowledge Assessment Service
# ============================================================================

class PreKnowledgeAssessment:
    """Generates and administers MCQ-based pre-knowledge assessments."""
    
    def __init__(self, model_name: str = None, temperature: float = 0.7):
        """
        Initialize the assessment generator.
        
        Args:
            model_name: Name of the Ollama model to use (defaults to settings.OLLAMA_MODEL or "llama3:8b")
            temperature: Temperature for response generation (0.0-1.0)
        """
        self.model_name = model_name or getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
        self.temperature = temperature
        self.llm = ChatOllama(model=self.model_name, temperature=self.temperature)
        logger.info(f"PreKnowledgeAssessment initialized with model: {self.model_name}")
    
    def determine_question_count(self, course_name: str, course_description: str, difficulty: str) -> Dict[str, Any]:
        """
        Use LLM to determine optimal number of questions based on course complexity.
        
        Args:
            course_name: Name of the course
            course_description: Description of the course
            difficulty: Course difficulty level
            
        Returns:
            Dictionary with 'question_count' and 'reasoning'
        """
        logger.info(f"Determining question count for course: {course_name}")
        
        structured_llm = self.llm.with_structured_output(QuestionCountDecision)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert educational assessment designer.

Analyze the given course and decide how many pre-knowledge assessment questions should be generated.

GUIDELINES:
- Simple, focused courses: 5-7 questions
- Moderate complexity courses: 8-10 questions  
- Complex, broad courses: 11-15 questions

FACTORS TO CONSIDER:
- Course scope (how many topics/concepts to cover)
- Difficulty level
- Prerequisites and depth
- Whether it's a foundational or advanced course

Return a number between 5 and 15, with reasoning."""),
            ("user", """Determine the optimal number of pre-assessment questions for:

Course: {course_name}
Description: {course_description}
Difficulty: {difficulty}

How many questions should we generate to effectively assess pre-knowledge?""")
        ])
        
        chain = prompt | structured_llm
        
        try:
            decision = chain.invoke({
                "course_name": course_name,
                "course_description": course_description,
                "difficulty": difficulty
            })
            
            logger.info(f"Question count decision: {decision.question_count} questions - {decision.reasoning}")
            return {
                "question_count": decision.question_count,
                "reasoning": decision.reasoning
            }
        except Exception as e:
            logger.error(f"Error determining question count: {str(e)}", exc_info=True)
            # Default to 8 questions on error
            default_count = 8
            logger.warning(f"Using default question count: {default_count}")
            return {
                "question_count": default_count,
                "reasoning": "Default fallback due to LLM error"
            }
    
    def generate_questions(self, course_name: str, course_description: str, difficulty: str, num_questions: int) -> QuestionSet:
        """
        Generate MCQ questions to assess pre-knowledge of a course.
        
        Args:
            course_name: Name of the course
            course_description: Description of the course
            difficulty: Course difficulty level
            num_questions: Number of questions to generate
            
        Returns:
            QuestionSet with generated questions
        """
        logger.info(f"Generating {num_questions} pre-assessment questions for: {course_name}")
        
        structured_llm = self.llm.with_structured_output(QuestionSet)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert educator creating pre-assessment questions.

TASK: Generate {num_questions} multiple-choice questions to evaluate a student's existing knowledge about this course BEFORE they start learning.

CRITICAL REQUIREMENTS FOR OPTIONS:
1. Each question MUST have EXACTLY 4 options in this order:
   - Option at index 0: A plausible answer (may be correct or incorrect)
   - Option at index 1: A plausible answer (may be correct or incorrect)  
   - Option at index 2: A plausible answer (may be correct or incorrect)
   - Option at index 3: MUST BE EXACTLY this text: "I don't know about this course"

2. ONE of the first 3 options (index 0, 1, or 2) must be the correct answer
3. The correct_answer_index must be 0, 1, or 2 (NOT 3, since option 3 is always "I don't know")
4. DO NOT put "I don't know about this course" anywhere except as the 4th option

TOPIC FIELD REQUIREMENTS:
- Each question must have a "topic" field identifying the specific concept being tested
- Topics should be concise (2-5 words) and specific (e.g., "Python data types", "Data cleaning methods")
- Topics help identify knowledge gaps so the syllabus can focus on areas needing attention
- Different questions can test different aspects of the same topic

QUESTION DISTRIBUTION:
- Distribute questions across difficulty levels appropriately
- For {num_questions} questions, aim for roughly:
  * 40% Beginner-level (basic concepts, terminology)
  * 40% Intermediate-level (understanding, application)
  * 20% Advanced-level (analysis, complex scenarios)

QUESTION DESIGN:
- Questions should test EXISTING knowledge, not learning ability
- Include a mix of:
  * Conceptual understanding
  * Terminology definitions
  * Practical applications
  * Problem-solving scenarios
- Ensure incorrect options are plausible but clearly wrong to someone who knows the topic
- Provide clear, educational explanations for correct answers

DIFFICULTY HINTS:
- Beginner: Tests basic awareness and terminology
- Intermediate: Tests understanding and application
- Advanced: Tests deep knowledge and complex scenarios

Generate questions that will accurately assess if the student already knows this material."""),
            ("user", """Generate {num_questions} pre-assessment questions for:

Course: {course_name}
Description: {course_description}
Difficulty Level: {difficulty}

Remember: 
- EXACTLY 4 options per question
- Last option (index 3) MUST be "I don't know about this course"
- Cover appropriate difficulty distribution
- Questions test EXISTING knowledge before the course starts""")
        ])
        
        chain = prompt | structured_llm
        
        try:
            question_set = chain.invoke({
                "num_questions": num_questions,
                "course_name": course_name,
                "course_description": course_description,
                "difficulty": difficulty
            })
            
            logger.info(f"Successfully generated {len(question_set.questions)} questions")
            return question_set
            
        except Exception as e:
            logger.error(f"Error generating questions: {str(e)}", exc_info=True)
            raise
    
    def evaluate_assessment(self, questions: List[Dict[str, Any]], user_answers: List[int]) -> AssessmentResult:
        """
        Evaluate student's answers locally (no LLM needed).
        
        Args:
            questions: List of question dictionaries with correct_answer_index and topic
            user_answers: List of user's answer indices (0-3)
            
        Returns:
            AssessmentResult with performance metrics and topic breakdown
        """
        if len(questions) != len(user_answers):
            raise ValueError(f"Questions count ({len(questions)}) must match answers count ({len(user_answers)})")
        
        logger.info(f"Evaluating assessment with {len(questions)} questions")
        
        correct = 0
        incorrect = 0
        dont_know = 0
        known_topics = []
        weak_topics = []
        unknown_topics = []
        
        # Get course name from first question
        course_name = questions[0].get('course_name', 'Unknown Course')
        
        for question, user_answer in zip(questions, user_answers):
            correct_idx = question['correct_answer_index']
            topic = question.get('topic', 'Unknown Topic')
            
            # Check if it's "I don't know" (always index 3)
            if user_answer == 3:
                dont_know += 1
                unknown_topics.append(topic)
            elif user_answer == correct_idx:
                correct += 1
                known_topics.append(topic)
            else:
                incorrect += 1
                weak_topics.append(topic)
        
        # Calculate knowledge metrics
        total = len(questions)
        answered_questions = total - dont_know
        
        if answered_questions > 0:
            knowledge_pct = (correct / answered_questions) * 100
        else:
            knowledge_pct = 0.0
        
        # Determine knowledge level
        if dont_know >= total * 0.6 or knowledge_pct < 30:
            knowledge_level = "None"
        elif knowledge_pct < 50:
            knowledge_level = "Basic"
        elif knowledge_pct < 80:
            knowledge_level = "Intermediate"
        else:
            knowledge_level = "Advanced"
        
        result = AssessmentResult(
            course_name=course_name,
            total_questions=total,
            correct_answers=correct,
            incorrect_answers=incorrect,
            dont_know_answers=dont_know,
            knowledge_percentage=knowledge_pct,
            knowledge_level=knowledge_level,
            known_topics=known_topics,
            weak_topics=weak_topics,
            unknown_topics=unknown_topics
        )
        
        logger.info(f"Assessment evaluation complete: {knowledge_level} level ({knowledge_pct:.1f}%)")
        logger.info(f"Known topics: {len(known_topics)}, Weak: {len(weak_topics)}, Unknown: {len(unknown_topics)}")
        
        return result
    
    def result_to_dict(self, result: AssessmentResult) -> dict:
        """
        Convert AssessmentResult to dictionary for JSON serialization.
        
        Args:
            result: AssessmentResult object
            
        Returns:
            Dictionary representation
        """
        return result.model_dump()
