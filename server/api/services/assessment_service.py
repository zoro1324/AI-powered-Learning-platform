"""
Assessment and Personalized Learning Path Service

This service handles:
1. Initial diagnostic MCQ generation
2. Knowledge level assessment
3. Personalized roadmap generation
4. Topic content generation
5. Topic quiz generation and evaluation
"""

import json
import logging
import re
from typing import Dict, List, Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class AssessmentService:
    """Service for AI-powered assessment and personalized learning path generation."""
    
    def __init__(self, ollama_url: str = None, ollama_model: str = None):
        """
        Initialize the assessment service.
        
        Args:
            ollama_url: Ollama API URL (defaults to settings.OLLAMA_API_URL)
            ollama_model: Ollama model name (defaults to settings.OLLAMA_MODEL)
        """
        # Use chat endpoint instead of generate
        base_url = ollama_url or settings.OLLAMA_API_URL
        self.ollama_url = base_url.replace('/api/generate', '/api/chat')
        self.ollama_model = ollama_model or settings.OLLAMA_MODEL
    
    def _call_ollama(self, prompt: str, system_prompt: str = None) -> str:
        """
        Make a request to Ollama API.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            
        Returns:
            The model's response text
            
        Raises:
            RuntimeError: If the API call fails
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False
        }
        
        try:
            response = requests.post(
                self.ollama_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
            return data.get('message', {}).get('content', '')
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API error: {e}")
            raise RuntimeError(f"Failed to get response from Ollama: {e}")
    
    def _extract_json(self, text: str) -> Dict[str, Any]:
        """
        Extract JSON from model response.
        
        Args:
            text: Response text that may contain JSON
            
        Returns:
            Parsed JSON object
            
        Raises:
            ValueError: If no valid JSON found
        """
        # Try to find JSON in the response
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                raise ValueError(f"Invalid JSON in response: {e}")
        else:
            raise ValueError("No valid JSON found in model response")
    
    def generate_initial_mcq(self, course_name: str) -> Dict[str, Any]:
        """
        Generate initial diagnostic MCQ questions for a course.
        
        Args:
            course_name: Name of the course
            
        Returns:
            Dictionary with 'questions' list containing MCQ questions
        """
        prompt = f"""
Generate 5 MCQ questions for the course: {course_name}

Rules:
Q1: Study method preference (options: Reading / Watching Video / Voice Conversation)
Q2: Self knowledge level (options: Beginner / Intermediate / Advanced)
Q3-5: Basic conceptual questions from the course
Q3-5 must include correct_answer field.

Return strictly in JSON format:

{{
  "questions": [
    {{
      "question": "What is your preferred study method?",
      "options": ["Reading", "Watching Video", "Voice Conversation", "Interactive Practice"],
      "correct_answer": null
    }},
    {{
      "question": "How would you rate your current knowledge?",
      "options": ["Beginner", "Intermediate", "Advanced", "Expert"],
      "correct_answer": null
    }},
    {{
      "question": "Actual course question here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }}
  ]
}}
"""
        
        response = self._call_ollama(prompt)
        return self._extract_json(response)
    
    def evaluate_initial_assessment(
        self,
        mcq_data: Dict[str, Any],
        user_answers: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluate user answers to initial assessment.
        
        Args:
            mcq_data: The MCQ questions data
            user_answers: List of user's answers
            
        Returns:
            Dictionary with evaluation results including:
            - study_method: Preferred study method
            - knowledge_level: Self-assessed knowledge level
            - score: Score on conceptual questions
            - weak_areas: List of weak areas identified
        """
        prompt = f"""
Evaluate the user answers to the diagnostic assessment.

Questions:
{json.dumps(mcq_data, indent=2)}

User Answers:
{json.dumps(user_answers, indent=2)}

Instructions:
- Extract selected study method from Q1 (answer index 0)
- Extract knowledge level from Q2 (answer index 1)
- Score only Q3-5 (questions with correct_answer field)
- Ignore any skipped answers
- Identify weak areas from wrong answers (extract topic names, not full questions)

Return strictly JSON:

{{
  "study_method": "Reading",
  "knowledge_level": "Beginner",
  "score": "2/3",
  "weak_areas": ["Topic 1", "Topic 2"]
}}
"""
        
        response = self._call_ollama(prompt)
        return self._extract_json(response)
    
    def generate_personalized_roadmap(
        self,
        course_name: str,
        evaluation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a personalized learning roadmap based on assessment.
        
        Args:
            course_name: Name of the course
            evaluation: Evaluation results from initial assessment
            
        Returns:
            Dictionary with 'topics' list containing roadmap topics
        """
        prompt = f"""
Create a personalized learning roadmap for the course: {course_name}

Based on this evaluation:
{json.dumps(evaluation, indent=2)}

Rules:
- Topic 1 must be a common introduction for all learners
- Remaining topics must adapt to the knowledge level ({evaluation.get('knowledge_level', 'Beginner')})
- If weak_areas exist, add reinforcement topics for those areas
- Provide 5-8 topics total
- Each topic should have a clear name and difficulty level
- NO static roadmap - adapt to user's level
- NO placeholders

Return strictly JSON:

{{
  "topics": [
    {{
      "topic_name": "Introduction to {course_name}",
      "level": "beginner"
    }},
    {{
      "topic_name": "Topic 2 name",
      "level": "intermediate"
    }}
  ]
}}
"""
        
        response = self._call_ollama(prompt)
        return self._extract_json(response)
    
    def generate_topic_content(
        self,
        course_name: str,
        topic_name: str,
        study_method: str
    ) -> str:
        """
        Generate detailed educational content for a specific topic.
        
        Args:
            course_name: Name of the course
            topic_name: Name of the topic
            study_method: User's preferred study method
            
        Returns:
            Generated content as markdown text
        """
        prompt = f"""
Generate detailed educational content for:

Course: {course_name}
Topic: {topic_name}
Study Method: {study_method}

Requirements:
- Write in clear, engaging paragraphs
- Provide comprehensive explanation with examples
- Use conceptual flow that builds understanding
- Adapt tone to be beginner-friendly if needed
- Use markdown formatting for better readability
- Include relevant examples and analogies
- NO bullet lists - only paragraphs and code examples if relevant
- Aim for 300-500 words

Generate the content:
"""
        
        response = self._call_ollama(prompt)
        return response
    
    def generate_topic_quiz(
        self,
        topic_name: str,
        topic_content: str
    ) -> Dict[str, Any]:
        """
        Generate quiz questions based on topic content.
        
        Args:
            topic_name: Name of the topic
            topic_content: The educational content for the topic
            
        Returns:
            Dictionary with 'questions' list containing quiz questions
        """
        # Truncate content if too long to fit in context
        max_content_length = 2000
        if len(topic_content) > max_content_length:
            topic_content = topic_content[:max_content_length] + "..."
        
        prompt = f"""
Generate 5 MCQ questions based ONLY on this content for topic "{topic_name}":

{topic_content}

Rules:
- Questions must test understanding of the content above
- Each question should have 4 options
- Include the correct_answer field
- Make questions clear and unambiguous
- Test different aspects of the topic

Return strictly JSON:

{{
  "questions": [
    {{
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }}
  ]
}}
"""
        
        response = self._call_ollama(prompt)
        return self._extract_json(response)
    
    def evaluate_topic_quiz(
        self,
        quiz_data: Dict[str, Any],
        user_answers: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluate user's answers to topic quiz.
        
        Args:
            quiz_data: The quiz questions data
            user_answers: List of user's answers
            
        Returns:
            Dictionary with evaluation results:
            - score: Score as "correct/total"
            - weak_areas: List of concepts where user struggled
        """
        questions = quiz_data.get('questions', [])
        correct = 0
        weak = []
        
        for i, question in enumerate(questions):
            if i < len(user_answers):
                user_answer = user_answers[i].strip()
                correct_answer = question.get('correct_answer', '').strip()
                
                if user_answer.upper() == correct_answer.upper():
                    correct += 1
                else:
                    # Extract concept from question (simplified approach)
                    weak.append(question.get('question', '')[:100])
        
        score = f"{correct}/{len(questions)}"
        
        return {
            "score": score,
            "correct_count": correct,
            "total_questions": len(questions),
            "score_percent": (correct / len(questions) * 100) if questions else 0,
            "weak_areas": weak
        }
    
    def refine_roadmap(
        self,
        course_name: str,
        remaining_topics: List[Dict[str, str]],
        weak_areas: List[str]
    ) -> Dict[str, Any]:
        """
        Refine remaining roadmap based on quiz performance.
        
        Args:
            course_name: Name of the course
            remaining_topics: List of remaining topics in roadmap
            weak_areas: Areas where user struggled
            
        Returns:
            Dictionary with refined 'topics' list
        """
        if not remaining_topics:
            return {"topics": []}
        
        prompt = f"""
Refine the remaining learning roadmap for the course: {course_name}

Remaining Topics:
{json.dumps(remaining_topics, indent=2)}

Weak Areas from Recent Quiz:
{json.dumps(weak_areas, indent=2)}

Instructions:
- Do NOT include completed topics
- Do NOT use full question sentences as topic names
- Convert weak areas into proper concise topic titles (2-5 words)
- Add reinforcement topics if weak_areas exist
- Maintain logical learning progression
- Keep topics relevant to the course

Return strictly JSON:

{{
  "topics": [
    {{
      "topic_name": "Topic name here",
      "level": "beginner|intermediate|advanced"
    }}
  ]
}}
"""
        
        response = self._call_ollama(prompt)
        return self._extract_json(response)


# Singleton instance
_assessment_service = None


def get_assessment_service() -> AssessmentService:
    """Get or create the singleton assessment service instance."""
    global _assessment_service
    if _assessment_service is None:
        _assessment_service = AssessmentService()
    return _assessment_service
