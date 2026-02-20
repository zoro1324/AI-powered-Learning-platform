"""
Course Planning Service with LangChain Integration

This service handles AI-powered course planning:
1. Analyzes whether a topic is broad or narrow
2. Generates single course for narrow topics
3. Splits broad topics into multiple logically structured courses (max 8)
4. Orders courses from beginner to advanced
5. Ensures no overlap between courses
"""

import logging
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from langchain_core.prompts import ChatPromptTemplate
from django.conf import settings
from api.services.ai_client import get_langchain_llm

logger = logging.getLogger(__name__)


# Pydantic Models for Structured Output
class CourseModel(BaseModel):
    """Represents a single course in the learning path."""
    course_name: str = Field(..., description="Name of the course")
    description: str = Field(..., description="Detailed description of the course")
    difficulty: str = Field(..., description="Difficulty level: Beginner, Intermediate, or Advanced")
    prerequisites: List[str] = Field(default_factory=list, description="List of prerequisite courses")
    
    @field_validator('difficulty')
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        """Ensure difficulty is one of the allowed values."""
        allowed = ['Beginner', 'Intermediate', 'Advanced']
        if v not in allowed:
            raise ValueError(f'Difficulty must be one of {allowed}')
        return v


class CoursePlan(BaseModel):
    """Represents a complete course plan with one or more courses."""
    is_broad: bool = Field(..., description="Whether the topic is broad and requires multiple courses")
    total_courses: int = Field(..., description="Total number of courses in the plan")
    courses: List[CourseModel] = Field(..., description="List of courses in the plan")
    
    @field_validator('total_courses')
    @classmethod
    def validate_total_courses(cls, v: int, info) -> int:
        """Ensure total_courses matches the length of courses list."""
        if 'courses' in info.data:
            actual_count = len(info.data['courses'])
            if v != actual_count:
                raise ValueError(f'total_courses ({v}) must equal the number of courses ({actual_count})')
        return v
    
    @field_validator('courses')
    @classmethod
    def validate_max_courses(cls, v: List[CourseModel]) -> List[CourseModel]:
        """Ensure at least one course."""
        if len(v) < 1:
            raise ValueError('At least 1 course is required')
        return v


class CoursePlanningService:
    """LangChain-based course planning service."""
    
    def __init__(self, model_name: str = None, temperature: float = 0.7):
        """
        Initialize the course planning service.

        In production (IS_PRODUCTION=True), uses Gemini via LangChain.
        In development, uses Ollama via LangChain.
        The model_name parameter is ignored; configure via GEMINI_MODEL / OLLAMA_MODEL env vars.
        """
        backend = "Gemini" if getattr(settings, 'IS_PRODUCTION', False) else "Ollama"
        logger.info("CoursePlanningService initialising — AI backend: %s", backend)

        self.temperature = temperature

        # Initialize LangChain components
        self.llm = get_langchain_llm(temperature=self.temperature)
        self.structured_llm = self.llm.with_structured_output(CoursePlan)
        self.prompt = self._create_prompt()
        self.chain = self.prompt | self.structured_llm

        logger.info("=== CoursePlanningService initialized ===")
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """Create the prompt template for course planning."""
        system_message = """You are an expert curriculum designer and educational consultant.

Your task is to analyze a given topic and create a structured course plan.

ANALYSIS RULES:
1. Determine if the topic is BROAD or NARROW:
   - NARROW: A specific, focused topic that can be covered in a single comprehensive course
     Examples: "Introduction to Python Lists", "CSS Flexbox", "Linear Regression in Machine Learning"
   
   - BROAD: A wide-ranging topic that requires multiple courses to cover comprehensively
     Examples: "Machine Learning", "Web Development", "Data Science", "Artificial Intelligence"

2. For NARROW topics:
   - Create exactly 1 course
   - Set is_broad = false
   - Provide a comprehensive course covering the entire topic
   
3. For BROAD topics:
   - Create as many courses as needed to cover the topic comprehensively
   - Set is_broad = true
   - Split the topic into logical, non-overlapping courses
   - Order courses from Beginner → Intermediate → Advanced
   - Ensure each course builds upon previous ones
   - Assign appropriate prerequisites

COURSE STRUCTURE RULES:
- Each course must have: course_name, description, difficulty, prerequisites
- Difficulty MUST be EXACTLY one of these three values: "Beginner", "Intermediate", or "Advanced"
- DO NOT use combinations like "Beginner-Intermediate" or "Intermediate-Advanced"
- DO NOT create custom difficulty levels - use ONLY the three allowed values
- Prerequisites should reference course names from earlier courses in the plan
- First course should typically be "Beginner" with no prerequisites
- Courses should progress logically in difficulty
- Courses must NOT overlap in content
- Each course should cover a distinct subset of the broader topic

OUTPUT RULES:
- total_courses MUST equal the actual number of courses
- Do NOT add any extra fields
- Ensure all required fields are present
- difficulty field accepts ONLY: "Beginner", "Intermediate", or "Advanced" - no other values allowed"""

        user_message = """Create a course plan for the following topic:

Course Title: {course_title}
Course Description: {course_description}

Analyze whether this topic is broad or narrow, then create an appropriate course plan."""

        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            ("user", user_message)
        ])
    
    def create_course_plan(self, course_title: str, course_description: str) -> CoursePlan:
        """
        Generate a course plan based on the input.
        
        Args:
            course_title: The title of the topic
            course_description: A description of what should be covered
            
        Returns:
            CoursePlan object with structured course information
            
        Raises:
            Exception: If LLM call fails or validation fails
        """
        logger.info(f"Creating course plan for: {course_title}")
        
        try:
            result = self.chain.invoke({
                "course_title": course_title,
                "course_description": course_description
            })
            
            logger.info(f"Course plan generated successfully: "
                       f"is_broad={result.is_broad}, "
                       f"total_courses={result.total_courses}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating course plan: {str(e)}", exc_info=True)
            raise
    
    def plan_to_dict(self, plan: CoursePlan) -> dict:
        """
        Convert CoursePlan to dictionary for JSON serialization.
        
        Args:
            plan: CoursePlan object
            
        Returns:
            Dictionary representation of the course plan
        """
        return plan.model_dump()
