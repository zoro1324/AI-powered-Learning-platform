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
        print("\n=== AssessmentService.__init__ CALLED ===")
        print(f"  ollama_url parameter: {ollama_url}")
        print(f"  ollama_model parameter: {ollama_model}")
        # Use chat endpoint instead of generate
        base_url = ollama_url or settings.OLLAMA_API_URL
        self.ollama_url = base_url.replace('/api/generate', '/api/chat')
        self.ollama_model = ollama_model or settings.OLLAMA_MODEL
        print(f"  Final ollama_url: {self.ollama_url}")
        print(f"  Final ollama_model: {self.ollama_model}")
        print("=== AssessmentService initialized ===")
    
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
        print("\n=== _call_ollama CALLED ===")
        print(f"  URL: {self.ollama_url}")
        print(f"  Model: {self.ollama_model}")
        print(f"  Prompt length: {len(prompt)} chars")
        print(f"  Has system prompt: {system_prompt is not None}")
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": 2048,  # Increase token limit for complete responses
                "temperature": 0.7,
                "top_p": 0.9
            }
        }
        
        try:
            print("  Sending request to Ollama...")
            response = requests.post(
                self.ollama_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60
            )
            print(f"  Response status code: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            content = data.get('message', {}).get('content', '')
            print(f"  Response content length: {len(content)} chars")
            print("=== _call_ollama SUCCESS ===")
            return content
        except requests.exceptions.RequestException as e:
            print(f"  ERROR in _call_ollama: {e}")
            logger.error(f"Ollama API error: {e}")
            print("=== _call_ollama FAILED ===")
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
        print(f"  Attempting to extract JSON from {len(text)} chars of text")
        print(f"  First 200 chars: {text[:200]}")
        print(f"  Last 200 chars: {text[-200:]}")
        
        # Try to find JSON in the response - look for both {...} and [...]
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            print(f"  Found JSON block of {len(json_str)} chars")
            
            try:
                result = json.loads(json_str)
                print(f"  ✓ Successfully parsed JSON")
                return result
            except json.JSONDecodeError as e:
                print(f"  ✗ JSON decode error: {e}")
                logger.error(f"JSON decode error: {e}")
                logger.error(f"Problematic JSON string: {json_str[:500]}")
                
                # Try to repair incomplete JSON
                print("  Attempting to repair JSON...")
                repaired_json = self._repair_json(json_str)
                if repaired_json:
                    try:
                        result = json.loads(repaired_json)
                        print(f"  ✓ Successfully repaired and parsed JSON")
                        return result
                    except json.JSONDecodeError:
                        print(f"  ✗ Repair failed")
                        pass
                
                # Try to fix common JSON issues
                try:
                    # Replace single quotes with double quotes
                    fixed_json = json_str.replace("'", '"')
                    result = json.loads(fixed_json)
                    print(f"  ✓ Fixed with quote replacement")
                    return result
                except json.JSONDecodeError:
                    pass
                
                raise ValueError(f"Invalid JSON in response: {e}")
        else:
            # If no JSON found, try to extract just the text and structure it
            print("  ✗ No JSON block found in response")
            logger.warning("No JSON found in response, attempting to parse raw text")
            raise ValueError("No valid JSON found in model response")
    
    def _repair_json(self, json_str: str) -> str:
        """
        Attempt to repair incomplete/malformed JSON.
        
        Args:
            json_str: The malformed JSON string
            
        Returns:
            Repaired JSON string or empty string if repair failed
        """
        try:
            # Count opening and closing braces/brackets
            open_braces = json_str.count('{')
            close_braces = json_str.count('}')
            open_brackets = json_str.count('[')
            close_brackets = json_str.count(']')
            
            print(f"    Braces: {open_braces} open, {close_braces} close")
            print(f"    Brackets: {open_brackets} open, {close_brackets} close")
            
            # Add missing closing braces/brackets
            repaired = json_str
            if close_braces < open_braces:
                repaired += '}' * (open_braces - close_braces)
                print(f"    Added {open_braces - close_braces} closing braces")
            if close_brackets < open_brackets:
                repaired += ']' * (open_brackets - close_brackets)
                print(f"    Added {open_brackets - close_brackets} closing brackets")
            
            # Try to fix incomplete last field by removing it
            # Look for patterns like: "field_nam or "field":
            incomplete_field = re.search(r',\s*"[^"]*$', repaired)
            if incomplete_field:
                print(f"    Removing incomplete field at end")
                repaired = repaired[:incomplete_field.start()] + repaired[incomplete_field.end():]
            
            return repaired
        except Exception as e:
            print(f"    Repair error: {e}")
            return ""
    
    def generate_initial_mcq(self, course_name: str) -> Dict[str, Any]:
        """
        Generate initial diagnostic MCQ questions for a course.
        
        Generates 10 questions total:
        - Question 1: Knowledge level assessment
        - Questions 2-10: Topic-related conceptual questions
        
        Args:
            course_name: Name of the course
            
        Returns:
            Dictionary with 'questions' list containing 10 MCQ questions
        """
        print("\n========================================")
        print("=== generate_initial_mcq CALLED ===")
        print(f"  Course name: {course_name}")
        print("========================================")
        system_prompt = "You are a helpful assistant that generates educational content. Always respond with valid JSON only, no additional text."
        
        prompt = f"""Generate exactly 10 multiple choice questions for the course: {course_name}

IMPORTANT: Respond with ONLY valid JSON, no other text before or after.

Rules:
- Question 1: Ask about current knowledge level with options: ["Beginner", "Intermediate", "Advanced", "Expert"]
- Questions 2-10: Create conceptual and practical questions about {course_name} with 4 options each
- Questions 2-10 MUST include the "correct_answer" field with the exact text of the correct option
- Question 1 should have "correct_answer": null
- Cover various aspects: fundamentals, key concepts, applications, best practices
- Make questions progressively more challenging (easier to harder)

Use this EXACT JSON structure (use double quotes, not single quotes):

{{
  "questions": [
    {{
      "question": "How would you rate your current knowledge of {course_name}?",
      "options": ["Beginner", "Intermediate", "Advanced", "Expert"],
      "correct_answer": null
    }},
    {{
      "question": "Your conceptual question about fundamentals here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }},
    {{
      "question": "Your question about key concepts here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B"
    }}
  ]
}}

Generate JSON with exactly 10 questions now:"""
        
        try:
            response = self._call_ollama(prompt, system_prompt)
            result = self._extract_json(response)
            print(f"  Generated {len(result.get('questions', []))} questions")
            print("=== generate_initial_mcq SUCCESS ===")
            return result
        except (ValueError, KeyError) as e:
            print(f"  ⚠️ JSON parsing failed, using fallback questions: {e}")
            # Fallback: Create basic assessment questions
            fallback_questions = {
                "questions": [
                    {
                        "question": f"How would you rate your current knowledge of {course_name}?",
                        "options": ["Beginner", "Intermediate", "Advanced", "Expert"],
                        "correct_answer": None
                    },
                    {
                        "question": f"What best describes the fundamentals of {course_name}?",
                        "options": ["A programming language", "A methodology or framework", "A set of tools and practices", "All of the above"],
                        "correct_answer": "All of the above"
                    },
                    {
                        "question": f"Which is a key concept in {course_name}?",
                        "options": ["Understanding core principles", "Ignoring best practices", "Copying code without understanding", "Avoiding documentation"],
                        "correct_answer": "Understanding core principles"
                    },
                    {
                        "question": f"What is the primary goal when learning {course_name}?",
                        "options": ["Memorizing syntax", "Building practical skills", "Just passing tests", "Avoiding challenges"],
                        "correct_answer": "Building practical skills"
                    },
                    {
                        "question": f"Which approach is most effective for mastering {course_name}?",
                        "options": ["Theory only", "Practice only", "Combining theory and practice", "Neither theory nor practice"],
                        "correct_answer": "Combining theory and practice"
                    },
                    {
                        "question": f"What interests you most about {course_name}?",
                        "options": ["Theory and Concepts", "Practical Applications", "Problem Solving", "All of the above"],
                        "correct_answer": "All of the above"
                    },
                    {
                        "question": f"What is a common challenge when learning {course_name}?",
                        "options": ["Understanding basic concepts", "Finding resources", "Staying motivated", "All of the above"],
                        "correct_answer": "All of the above"
                    },
                    {
                        "question": f"Which skill is most valuable in {course_name}?",
                        "options": ["Critical thinking", "Memorization", "Speed reading", "Guessing"],
                        "correct_answer": "Critical thinking"
                    },
                    {
                        "question": f"What is your main goal for learning {course_name}?",
                        "options": ["Career Development", "Personal Interest", "Academic Requirement", "Skill Enhancement"],
                        "correct_answer": "Skill Enhancement"
                    },
                    {
                        "question": f"How important is hands-on practice in {course_name}?",
                        "options": ["Not important", "Somewhat important", "Very important", "Essential"],
                        "correct_answer": "Essential"
                    }
                ]
            }
            print(f"  Using fallback with {len(fallback_questions['questions'])} questions")
            print("=== generate_initial_mcq SUCCESS (fallback) ===")
            return fallback_questions
    
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
            - knowledge_level: Self-assessed knowledge level
            - score: Score on conceptual questions (e.g., "7/9")
            - weak_areas: List of weak areas identified
        """
        print("\n========================================")
        print("=== evaluate_initial_assessment CALLED ===")
        print(f"  Number of questions: {len(mcq_data.get('questions', []))}")
        print(f"  Number of answers: {len(user_answers)}")
        print(f"  User answers: {user_answers}")
        print("========================================")
        system_prompt = "You are a helpful assistant that evaluates assessments. Always respond with valid JSON only, no additional text."
        
        prompt = f"""Evaluate these diagnostic assessment answers.

Questions:
{json.dumps(mcq_data, indent=2)}

User Answers:
{json.dumps(user_answers, indent=2)}

Instructions:
- Extract the knowledge level from answer 0 (index 0) - first question
- Score questions 1-9 (indices 1-9) which have correct_answer field
- Identify weak topic areas from incorrect answers
- Return ONLY valid JSON, no other text

Use this EXACT format:

{{
  "knowledge_level": "Beginner",
  "score": "7/9",
  "weak_areas": ["Topic name 1", "Topic name 2"]
}}

Generate the JSON now:"""
        
        response = self._call_ollama(prompt, system_prompt)
        result = self._extract_json(response)
        print(f"  Evaluation results: {result}")
        print("=== evaluate_initial_assessment SUCCESS ===")
        return result
    
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
        print("\n========================================")
        print("=== generate_personalized_roadmap CALLED ===")
        print(f"  Course name: {course_name}")
        print(f"  Evaluation: {evaluation}")
        print("========================================")
        system_prompt = "You are a helpful assistant that creates learning roadmaps. Always respond with valid JSON only, no additional text."
        
        knowledge_level = evaluation.get('knowledge_level', 'Beginner')
        weak_areas = evaluation.get('weak_areas', [])
        
        prompt = f"""Create a learning roadmap for: {course_name}

Knowledge Level: {knowledge_level}
Weak Areas: {', '.join(weak_areas[:2]) if weak_areas else 'None'}

IMPORTANT: Generate ONLY 3-5 topics. Return ONLY valid JSON.

Required format (copy this structure exactly):

{{
  "topics": [
    {{"topic_name": "Introduction to {course_name}", "level": "beginner"}},
    {{"topic_name": "Core Concepts", "level": "intermediate"}},
    {{"topic_name": "Advanced Applications", "level": "advanced"}}
  ]
}}

Generate JSON now with 3-5 topics:"""
        
        try:
            response = self._call_ollama(prompt, system_prompt)
            result = self._extract_json(response)
            print(f"  Generated {len(result.get('topics', []))} topics")
            print("=== generate_personalized_roadmap SUCCESS ===")
            return result
        except (ValueError, KeyError) as e:
            print(f"  ⚠️ JSON parsing failed, using fallback roadmap: {e}")
            # Fallback: Create a basic roadmap
            fallback_topics = [
                {"topic_name": f"Introduction to {course_name}", "level": "beginner"},
                {"topic_name": "Fundamental Concepts", "level": "beginner"},
                {"topic_name": "Core Principles", "level": "intermediate"},
                {"topic_name": "Practical Applications", "level": "intermediate"},
            ]
            print(f"  Using fallback with {len(fallback_topics)} topics")
            print("=== generate_personalized_roadmap SUCCESS (fallback) ===")
            return {"topics": fallback_topics}

    def generate_personalized_syllabus(
        self,
        course_name: str,
        evaluation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a full personalized syllabus with modules and topics.
        
        After the initial assessment, this creates a structured course
        tailored to the user's knowledge level and weak areas.
        Each module contains multiple topics with descriptions.
        """
        print("\n========================================")
        print("=== generate_personalized_syllabus CALLED ===")
        print(f"  Course name: {course_name}")
        print(f"  Evaluation: {evaluation}")
        print("========================================")
        
        system_prompt = (
            "You are an expert curriculum designer. "
            "Generate a structured course syllabus as valid JSON only, "
            "no additional text before or after the JSON."
        )
        
        knowledge_level = evaluation.get('knowledge_level', 'Beginner')
        score = evaluation.get('score', '0/0')
        weak_areas = evaluation.get('weak_areas', [])
        
        prompt = f"""Design a personalized course syllabus for: {course_name}

Student Profile:
- Knowledge Level: {knowledge_level}
- Assessment Score: {score}
- Weak Areas: {', '.join(weak_areas[:3]) if weak_areas else 'None identified'}

Requirements:
- Decide the number of modules based on course complexity (3-8 modules)
- Each module must have 2-5 topics with short descriptions
- Start with fundamentals if student is a beginner
- Add extra modules for weak areas
- Progress from easier to harder
- Keep module names concise (3-8 words)
- Keep topic descriptions to ONE short sentence (under 15 words)
- Use difficulty_level: "beginner", "intermediate", or "advanced"

Return ONLY this JSON structure:

{{
  "course_name": "{course_name}",
  "knowledge_level": "{knowledge_level}",
  "total_modules": 5,
  "modules": [
    {{
      "module_name": "Getting Started with {course_name}",
      "description": "Foundation concepts and setup",
      "order": 1,
      "difficulty_level": "beginner",
      "estimated_duration_minutes": 30,
      "topics": [
        {{"topic_name": "What is {course_name}", "description": "Overview and importance", "order": 1}},
        {{"topic_name": "Core Terminology", "description": "Key terms and definitions", "order": 2}}
      ]
    }},
    {{
      "module_name": "Core Concepts",
      "description": "Essential principles and techniques",
      "order": 2,
      "difficulty_level": "intermediate",
      "estimated_duration_minutes": 45,
      "topics": [
        {{"topic_name": "Fundamental Principles", "description": "Core ideas explained", "order": 1}},
        {{"topic_name": "Practical Examples", "description": "Hands-on demonstrations", "order": 2}}
      ]
    }}
  ]
}}

Generate the full syllabus JSON now:"""
        
        try:
            response = self._call_ollama(prompt, system_prompt)
            result = self._extract_json(response)
            
            # Validate and normalize the structure
            result = self._normalize_syllabus(result, course_name, knowledge_level)
            
            print(f"  Generated syllabus: {result.get('total_modules')} modules, "
                  f"{sum(len(m.get('topics', [])) for m in result.get('modules', []))} total topics")
            print("=== generate_personalized_syllabus SUCCESS ===")
            return result
            
        except (ValueError, KeyError) as e:
            print(f"  ⚠️ JSON parsing failed, using fallback syllabus: {e}")
            fallback = self._build_fallback_syllabus(course_name, knowledge_level, weak_areas)
            print(f"  Using fallback with {fallback['total_modules']} modules")
            print("=== generate_personalized_syllabus SUCCESS (fallback) ===")
            return fallback
    
    def _normalize_syllabus(
        self, data: Dict[str, Any], course_name: str, knowledge_level: str
    ) -> Dict[str, Any]:
        """Ensure the syllabus JSON has all required fields."""
        modules = data.get('modules', [])
        
        data.setdefault('course_name', course_name)
        data.setdefault('knowledge_level', knowledge_level)
        data['total_modules'] = len(modules)
        
        for idx, mod in enumerate(modules, start=1):
            mod.setdefault('module_name', f'Module {idx}')
            mod.setdefault('description', '')
            mod['order'] = idx
            mod.setdefault('difficulty_level', 'beginner')
            mod.setdefault('estimated_duration_minutes', 30)
            
            topics = mod.get('topics', [])
            if not topics:
                topics = [{"topic_name": mod['module_name'], "description": "Main content", "order": 1}]
                mod['topics'] = topics
            
            for tidx, topic in enumerate(topics, start=1):
                topic.setdefault('topic_name', f'Topic {tidx}')
                topic.setdefault('description', '')
                topic['order'] = tidx
        
        return data
    
    def _build_fallback_syllabus(
        self, course_name: str, knowledge_level: str, weak_areas: List[str]
    ) -> Dict[str, Any]:
        """Build a reasonable fallback syllabus when Ollama fails."""
        modules = [
            {
                "module_name": f"Introduction to {course_name}",
                "description": "Foundation concepts and overview of the subject",
                "order": 1,
                "difficulty_level": "beginner",
                "estimated_duration_minutes": 30,
                "topics": [
                    {"topic_name": f"What is {course_name}", "description": "Overview and importance of the subject", "order": 1},
                    {"topic_name": "History and Background", "description": "How the field evolved over time", "order": 2},
                    {"topic_name": "Key Terminology", "description": "Essential terms and definitions", "order": 3},
                ]
            },
            {
                "module_name": "Core Concepts and Principles",
                "description": "Fundamental ideas that underpin the subject",
                "order": 2,
                "difficulty_level": "beginner",
                "estimated_duration_minutes": 45,
                "topics": [
                    {"topic_name": "Fundamental Principles", "description": "The building blocks of knowledge", "order": 1},
                    {"topic_name": "Key Techniques", "description": "Common methods and approaches", "order": 2},
                    {"topic_name": "Worked Examples", "description": "Step-by-step problem walkthroughs", "order": 3},
                ]
            },
            {
                "module_name": "Intermediate Applications",
                "description": "Applying concepts to real scenarios",
                "order": 3,
                "difficulty_level": "intermediate",
                "estimated_duration_minutes": 45,
                "topics": [
                    {"topic_name": "Real-World Use Cases", "description": "How concepts apply in practice", "order": 1},
                    {"topic_name": "Problem-Solving Strategies", "description": "Approaches to common challenges", "order": 2},
                    {"topic_name": "Tools and Resources", "description": "Essential tools for practitioners", "order": 3},
                ]
            },
            {
                "module_name": "Advanced Topics",
                "description": "Deeper exploration of complex areas",
                "order": 4,
                "difficulty_level": "advanced",
                "estimated_duration_minutes": 60,
                "topics": [
                    {"topic_name": "Advanced Techniques", "description": "Sophisticated methods and strategies", "order": 1},
                    {"topic_name": "Best Practices", "description": "Industry standards and recommendations", "order": 2},
                    {"topic_name": "Current Trends", "description": "Latest developments in the field", "order": 3},
                ]
            },
        ]
        
        # Add weak-area reinforcement module if applicable
        if weak_areas:
            reinforcement_topics = []
            for i, area in enumerate(weak_areas[:3], start=1):
                topic_name = area[:50].rstrip('?').strip()
                if len(topic_name) > 40:
                    topic_name = topic_name[:40].rsplit(' ', 1)[0]
                reinforcement_topics.append({
                    "topic_name": f"Review: {topic_name}",
                    "description": "Reinforcement of identified weak area",
                    "order": i,
                })
            modules.append({
                "module_name": "Reinforcement and Review",
                "description": "Extra practice on topics needing improvement",
                "order": 5,
                "difficulty_level": "intermediate",
                "estimated_duration_minutes": 40,
                "topics": reinforcement_topics,
            })
        
        return {
            "course_name": course_name,
            "knowledge_level": knowledge_level,
            "total_modules": len(modules),
            "modules": modules,
        }

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
        print("\n========================================")
        print("=== generate_topic_content CALLED ===")
        print(f"  Course: {course_name}")
        print(f"  Topic: {topic_name}")
        print(f"  Study method: {study_method}")
        print("========================================")
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
        print(f"  Generated content length: {len(response)} chars")
        print("=== generate_topic_content SUCCESS ===")
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
        print("\n========================================")
        print("=== generate_topic_quiz CALLED ===")
        print(f"  Topic: {topic_name}")
        print(f"  Content length: {len(topic_content)} chars")
        print("========================================")
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
        result = self._extract_json(response)
        print(f"  Generated {len(result.get('questions', []))} quiz questions")
        print("=== generate_topic_quiz SUCCESS ===")
        return result
    
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
        print("\n========================================")
        print("=== evaluate_topic_quiz CALLED ===")
        print(f"  Number of questions: {len(quiz_data.get('questions', []))}")
        print(f"  Number of answers: {len(user_answers)}")
        print("========================================")
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
        
        result = {
            "score": score,
            "correct_count": correct,
            "total_questions": len(questions),
            "score_percent": (correct / len(questions) * 100) if questions else 0,
            "weak_areas": weak
        }
        print(f"  Quiz evaluation result: {result}")
        print("=== evaluate_topic_quiz SUCCESS ===")
        return result
    
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
    print("\n### get_assessment_service() CALLED ###")
    global _assessment_service
    if _assessment_service is None:
        print("  Creating NEW AssessmentService instance")
        _assessment_service = AssessmentService()
    else:
        print("  Returning EXISTING AssessmentService instance")
    return _assessment_service
