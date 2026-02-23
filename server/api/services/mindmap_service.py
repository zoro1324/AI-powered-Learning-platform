import json
import logging
import re
from typing import Dict, Any

from django.conf import settings
from .ai_client import generate_text

logger = logging.getLogger(__name__)

class MindMapService:
    @staticmethod
    def _extract_json(text: str) -> Dict[str, Any]:
        """Extracts JSON from an LLM response."""
        text = text.strip()
        json_match = re.search(r'\{.*\}', text, re.DOTALL)

        if not json_match:
            logger.error(f"Failed to find JSON in output. Raw output: {text[:200]}...")
            raise ValueError("No valid JSON structure found in the AI response.")

        json_text = json_match.group()
        
        try:
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extracted JSON: {e}. Extracted string: {json_text[:200]}...")
            raise ValueError("AI produced invalid JSON syntax.")

    @staticmethod
    def generate_course_mindmap(course_title: str, user_level: str) -> Dict[str, Any]:
        """
        Generates a hierarchical mind map structure for a course.
        """
        prompt = f"""
You are a senior curriculum architect.

Generate a COMPLETE adaptive roadmap (mind map) for the course: {course_title}.

User Level: {user_level}

Adaptation Rules:

If Beginner:
- Include full fundamentals
- Slow progression
- Concept clarity focus
- More foundational branches

If Intermediate:
- Assume basic knowledge
- Skip very basic HTML/CSS intro
- Add practical projects
- Add architecture concepts

If Advanced:
- Skip fundamentals
- Focus on system design
- Optimization
- Security
- Scalability
- DevOps
- Performance engineering

Important Requirements:
- Topic 1 MUST be Introduction to {course_title}
- 6–10 main branches
- Each branch must have 4–7 subtopics
- Cover the entire ecosystem of the course
- DO NOT INCLUDE ANY EXPLANATION TEXT OR MARKDOWN OUTSIDE THE JSON.
- ONLY return a valid JSON object.

Return format EXACTLY like this (ensure it is valid JSON):
{{
  "title": "{course_title}",
  "level": "{user_level}",
  "branches": [
    {{
      "name": "Main Domain",
      "subtopics": [
        "Subtopic 1",
        "Subtopic 2"
      ]
    }}
  ]
}}
"""
        
        system_prompt = "You are a curriculum expert that outputs valid JSON only. Do not use markdown like ```json."
        
        try:
            logger.info(f"Generating mind map for {course_title} ({user_level})")
            raw_response = generate_text(prompt, system_prompt=system_prompt, json_mode=True)
            return MindMapService._extract_json(raw_response)
        except Exception as e:
            logger.exception("Error generating mind map")
            raise Exception(f"Failed to generate mind map: {str(e)}")

    @staticmethod
    def generate_topic_mindmap(topic_name: str, content: str) -> Dict[str, Any]:
        """
        Generates a detailed mind map structure for a specific topic strictly based on the provided content.
        """
        prompt = f"""
Analyze the following topic content and extract its core concepts to form a hierarchical mind map.
The mind map MUST be strictly based ONLY on the provided content. Do not add external information.

Topic: {topic_name}

Content:
{content[:8000]}

Rules:
- Identify 3–6 main branches representing the core concepts explicitly explained in the content.
- For each main branch, extract 2–5 subtopics providing finer details actually mentioned in the text.
- DO NOT INCLUDE ANY EXPLANATION TEXT OR MARKDOWN OUTSIDE THE JSON.
- ONLY return a valid JSON object.

Return format EXACTLY like this (ensure it is valid JSON):
{{
  "title": "{topic_name}",
  "level": "Content Mind Map",
  "branches": [
    {{
      "name": "Core Concept (from text)",
      "subtopics": [
        "Detail 1 (from text)",
        "Detail 2 (from text)"
      ]
    }}
  ]
}}
"""
        
        system_prompt = "You are a content analyzer that strictly extracts hierarchical information from text and outputs valid JSON only. Do not use markdown like ```json."
        
        try:
            logger.info(f"Generating strict content mind map for topic: {topic_name}")
            raw_response = generate_text(prompt, system_prompt=system_prompt, json_mode=True)
            return MindMapService._extract_json(raw_response)
        except Exception as e:
            logger.exception(f"Error generating content mind map for {topic_name}")
            raise Exception(f"Failed to generate content mind map: {str(e)}")
