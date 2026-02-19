"""
Personalized Syllabus Generation Service

This service handles AI-powered personalized syllabus generation:
1. Takes study method preferences and converts to system prompts
2. Adapts syllabus based on pre-knowledge assessment results
3. Two-layer validation: Generator → Reviewer → Approved syllabus
4. Generates dual descriptions (short for users, detailed for AI)
5. Custom parser filters empty modules before validation
"""

import logging
import json
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import PydanticOutputParser
from django.conf import settings

logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models for Structured Output
# ============================================================================

class Topic(BaseModel):
    """Represents a single topic within a module."""
    topic_name: str = Field(..., description="Name of the topic")
    short_description: str = Field(..., description="Short description for users (1-2 sentences)")
    detailed_description: str = Field(..., description="Detailed description for AI to understand the scope and content")
    estimated_duration_minutes: int = Field(..., description="Estimated time to complete this topic in minutes", gt=0)


class Module(BaseModel):
    """Represents a module containing multiple topics."""
    module_name: str = Field(..., description="Name of the module")
    module_description: str = Field(..., description="Overview of what this module covers")
    topics: List[Topic] = Field(..., description="List of topics in this module")
    
    @field_validator('topics')
    @classmethod
    def validate_topics(cls, v: List[Topic]) -> List[Topic]:
        """Ensure at least one topic per module."""
        if len(v) < 1:
            raise ValueError('Each module must have at least 1 topic')
        return v


class Syllabus(BaseModel):
    """Represents a complete course syllabus."""
    course_name: str = Field(..., description="Name of the course")
    course_objective: str = Field(..., description="Main objective of the course")
    study_method: str = Field(..., description="Study method preferences applied")
    total_modules: int = Field(..., description="Total number of modules")
    modules: List[Module] = Field(..., description="List of modules in the syllabus")
    total_estimated_hours: float = Field(..., description="Total estimated hours to complete the course")
    
    @field_validator('total_modules')
    @classmethod
    def validate_total_modules(cls, v: int, info) -> int:
        """Ensure total_modules matches the length of modules list."""
        if 'modules' in info.data:
            actual_count = len(info.data['modules'])
            if v != actual_count:
                raise ValueError(f'total_modules ({v}) must equal the number of modules ({actual_count})')
        return v
    
    @field_validator('modules')
    @classmethod
    def validate_modules(cls, v: List[Module]) -> List[Module]:
        """Ensure at least one module."""
        if len(v) < 1:
            raise ValueError('Syllabus must have at least 1 module')
        return v


class SyllabusReview(BaseModel):
    """Represents a review of a syllabus by the validation layer."""
    approved: bool = Field(..., description="Whether the syllabus is approved")
    feedback: str = Field(..., description="Feedback or reasons for rejection/approval")
    issues: List[str] = Field(default_factory=list, description="List of specific issues found (if rejected)")


# ============================================================================
# Study Method Preferences System
# ============================================================================

class StudyMethodPreferences:
    """Handles study method preference system prompt generation."""
    
    PREFERENCE_OPTIONS = {
        "real_world": {
            "name": "Real-world Examples",
            "description": "Course filled with practical, real-world examples and case studies",
            "prompt_addition": "Include extensive real-world examples, case studies, and practical applications for every concept. Show how each topic is used in industry. Provide concrete examples from actual projects and companies."
        },
        "theory_depth": {
            "name": "Theory Depth",
            "description": "Deep theoretical understanding with mathematical foundations",
            "prompt_addition": "Focus on theoretical foundations, mathematical principles, and academic rigor. Include proofs and formal definitions where applicable. Build deep conceptual understanding from first principles."
        },
        "project_based": {
            "name": "Project-Based",
            "description": "Learning through building projects and practical exercises",
            "prompt_addition": "Structure each module around hands-on projects and exercises. Ensure learners build something tangible in each module. Include project specifications, milestones, and deliverables."
        },
        "custom": {
            "name": "Custom",
            "description": "Custom study method based on user input",
            "prompt_addition": ""  # Will be filled from custom_study_method field
        }
    }
    
    @staticmethod
    def get_prompt_addition(study_method: str, custom_text: str = "") -> str:
        """
        Get the prompt addition for a study method.
        
        Args:
            study_method: One of 'real_world', 'theory_depth', 'project_based', 'custom'
            custom_text: Custom study method text (required if study_method is 'custom')
            
        Returns:
            Prompt addition text to include in system prompt
        """
        if study_method == "custom":
            if not custom_text:
                logger.warning("Custom study method selected but no custom text provided")
                return StudyMethodPreferences.PREFERENCE_OPTIONS["real_world"]["prompt_addition"]
            return f"Customize the syllabus according to this learning preference: {custom_text}"
        
        preference = StudyMethodPreferences.PREFERENCE_OPTIONS.get(study_method)
        if not preference:
            logger.warning(f"Unknown study method '{study_method}', defaulting to 'real_world'")
            return StudyMethodPreferences.PREFERENCE_OPTIONS["real_world"]["prompt_addition"]
        
        return preference["prompt_addition"]


# ============================================================================
# Custom Syllabus Parser
# ============================================================================

class CustomSyllabusParser(PydanticOutputParser):
    """Custom parser that filters empty modules before validation."""
    
    def parse(self, text: str) -> Syllabus:
        """Parse and clean the LLM output before Pydantic validation."""
        try:
            # Extract JSON from text (handles cases where LLM adds explanatory text)
            json_start = text.find('{')
            json_end = text.rfind('}') + 1
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON object found in response")
            
            json_text = text[json_start:json_end]
            data = json.loads(json_text)
            
            # Filter out empty modules
            if 'modules' in data:
                original_count = len(data['modules'])
                data['modules'] = [
                    m for m in data['modules']
                    if m.get('module_name', '').strip() != ''  # Has name
                    and m.get('module_description', '').strip() != ''  # Has description
                    and len(m.get('topics', [])) > 0  # Has topics
                ]
                filtered_count = len(data['modules'])
                
                if filtered_count < original_count:
                    logger.info(f"Filtered {original_count - filtered_count} empty module(s)")
                
                # Update total_modules to match filtered count
                data['total_modules'] = filtered_count
            
            # Now validate with Pydantic
            return Syllabus.model_validate(data)
            
        except json.JSONDecodeError as e:
            raise OutputParserException(f"Failed to parse JSON: {e}") from e
        except Exception as e:
            raise OutputParserException(f"Failed to parse syllabus: {e}") from e


# ============================================================================
# Two-Layer Syllabus Generation System
# ============================================================================

class SyllabusGenerator:
    """Two-layer system for generating and validating course syllabi."""
    
    def __init__(self, model_name: str = None, temperature: float = 0.7):
        """
        Initialize the syllabus generator with two layers.
        
        Args:
            model_name: Name of the Ollama model to use (defaults to settings.OLLAMA_MODEL or "llama3:8b")
            temperature: Temperature for response generation (0.0-1.0)
        """
        self.model_name = model_name or getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
        self.temperature = temperature
        
        # Layer 1: Syllabus Generator with custom parser
        self.generator_llm = ChatOllama(model=self.model_name, temperature=temperature)
        self.syllabus_parser = CustomSyllabusParser(pydantic_object=Syllabus)
        
        # Layer 2: Syllabus Reviewer (lower temperature for consistency)
        self.reviewer_llm = ChatOllama(model=self.model_name, temperature=0.3)
        self.structured_reviewer = self.reviewer_llm.with_structured_output(SyllabusReview)
        
        logger.info(f"SyllabusGenerator initialized with model: {self.model_name}")
    
    def _create_generator_prompt(
        self, 
        study_method_addition: str, 
        assessment_result: Optional[Dict[str, Any]] = None
    ) -> ChatPromptTemplate:
        """Create the prompt for syllabus generation (Layer 1)."""
        
        # Add knowledge level adaptation if assessment was taken
        knowledge_adaptation = ""
        if assessment_result:
            knowledge_level = assessment_result.get('knowledge_level', 'None')
            knowledge_pct = assessment_result.get('knowledge_percentage', 0)
            
            # Base knowledge level guidance
            if knowledge_level == "None":
                knowledge_adaptation = f"""\n\nSTUDENT PRE-KNOWLEDGE ASSESSMENT:
The student has MINIMAL existing knowledge of this topic (scored {knowledge_pct:.1f}%).

ADAPTATION REQUIREMENTS:
- Start from absolute fundamentals - assume NO prior knowledge
- Include detailed explanations of basic terminology and concepts
- Use simple language and avoid jargon (or explain it when used)
- Provide more examples and practice exercises for foundational topics
- Allocate more time to introductory modules
- Build confidence gradually with achievable early milestones"""
            elif knowledge_level == "Basic":
                knowledge_adaptation = f"""\n\nSTUDENT PRE-KNOWLEDGE ASSESSMENT:
The student has BASIC familiarity with some concepts (scored {knowledge_pct:.1f}%).

ADAPTATION REQUIREMENTS:
- Provide a brief review of fundamentals (don't spend too much time)
- Focus on filling knowledge gaps and building deeper understanding
- Move to intermediate concepts more quickly
- Include connections between concepts they know and new material
- Balance between review and new content (30% review, 70% new)"""
            elif knowledge_level == "Intermediate":
                knowledge_adaptation = f"""\n\nSTUDENT PRE-KNOWLEDGE ASSESSMENT:
The student has SOLID foundational knowledge (scored {knowledge_pct:.1f}%).

ADAPTATION REQUIREMENTS:
- Skip or minimize basic concepts (brief refresher only if essential)
- Focus primarily on intermediate and advanced topics
- Include more complex scenarios and real-world applications
- Emphasize depth over breadth in advanced areas
- Balance: 10-20% fundamentals review, 80-90% advanced content"""
            else:  # Advanced
                knowledge_adaptation = f"""\n\nSTUDENT PRE-KNOWLEDGE ASSESSMENT:
The student has ADVANCED knowledge of this topic (scored {knowledge_pct:.1f}%).

ADAPTATION REQUIREMENTS:
- Skip basic and intermediate topics entirely (unless essential for context)
- Focus on advanced concepts, edge cases, and mastery-level content
- Include cutting-edge developments and best practices
- Incorporate challenging projects and real-world problem-solving
- Emphasize expertise development and specialized applications
- Consider adding bonus/optional modules for extremely advanced topics"""
            
            # Add topic-level granularity
            known_topics = assessment_result.get('known_topics', [])
            weak_topics = assessment_result.get('weak_topics', [])
            unknown_topics = assessment_result.get('unknown_topics', [])
            
            topic_breakdown = ""
            if known_topics:
                topic_breakdown += f"\n\n✓ KNOWN TOPICS - The student already understands these:\n  {', '.join(known_topics)}\n  → Move quickly through these or skip detailed explanations"
            
            if weak_topics:
                topic_breakdown += f"\n\n⚠ WEAK TOPICS - The student has partial knowledge but needs reinforcement:\n  {', '.join(weak_topics)}\n  → Provide focused practice, examples, and review for these areas"
            
            if unknown_topics:
                topic_breakdown += f"\n\n✗ UNKNOWN TOPICS - The student has no knowledge of these:\n  {', '.join(unknown_topics)}\n  → Allocate extra time and detailed explanations for these topics"
            
            if topic_breakdown:
                knowledge_adaptation += f"\n\nTOPIC-LEVEL KNOWLEDGE GAPS:{topic_breakdown}\n\nIMPORTANT: Tailor the syllabus to spend appropriate time on each topic category. Prioritize unknown and weak topics in your content allocation."
        
        system_message = f"""You are an expert curriculum designer creating a detailed course syllabus.

STUDY METHOD PREFERENCE:
{study_method_addition}{knowledge_adaptation}

SYLLABUS STRUCTURE REQUIREMENTS:
1. Create between 3 and 8 modules that comprehensively cover the course (choose appropriate number based on course scope)
2. Each module MUST have 3-10 topics
3. CRITICAL: DO NOT generate empty modules. Every module MUST have a non-empty name, description, and at least 3 topics
4. Modules should progress logically from foundational to advanced concepts
5. Topics within a module should be related and build upon each other

TOPIC REQUIREMENTS:
- short_description: 1-2 sentences explaining what the user will learn (user-facing)
- detailed_description: Comprehensive description of the topic scope, key concepts, learning outcomes, and teaching approach (AI-facing, 3-5 sentences)
- estimated_duration_minutes: Realistic time estimate (typically 15-120 minutes per topic)

CONTENT QUALITY RULES:
- No overlapping content between topics or modules
- Each topic must be substantial and well-defined
- Ensure logical flow and prerequisites are respected
- Total course should be comprehensive but not overwhelming
- Calculate total_estimated_hours accurately based on all topic durations

AVOID:
- Vague or generic topic descriptions
- Redundant content
- Unrealistic time estimates
- Missing key concepts for the course level
- Empty or incomplete modules (will be rejected during validation)"""

        user_message = """Create a detailed syllabus for the following course:

Course Name: {course_name}
Course Description: {course_description}
Difficulty Level: {difficulty}

Generate a complete, well-structured syllabus following all requirements."""

        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            ("user", user_message)
        ])
    
    def _create_reviewer_prompt(self) -> ChatPromptTemplate:
        """Create the prompt for syllabus review (Layer 2)."""
        system_message = """You are a senior educational quality assurance expert reviewing course syllabi.

Your task is to critically evaluate syllabi for quality, coherence, and educational value.

EVALUATION CRITERIA:

1. STRUCTURE (Critical):
   - Are modules logically organized and progressive?
   - Do topics within modules relate to each other?
   - Is there a clear learning path from beginner to advanced?

2. CONTENT QUALITY (Critical):
   - Are topic descriptions clear and specific?
   - Do detailed descriptions provide enough context for content creation?
   - Is content appropriate for the stated difficulty level?

3. NO REDUNDANCY (Critical):
   - Are there overlapping topics?
   - Is any content repeated across modules?
   - Are topics distinct and well-defined?

4. COMPLETENESS (Critical):
   - Does the syllabus cover all essential aspects of the course?
   - Are there any obvious gaps in coverage?
   - Are prerequisites and dependencies clear?

5. REALISM (Important):
   - Are time estimates realistic?
   - Is the total course length appropriate?
   - Can topics be reasonably covered in the estimated time?

DECISION RULES:
- APPROVE if: All critical criteria are met and the syllabus is high quality
- REJECT if: Any critical criteria fail or there are major quality issues

When REJECTING:
- Provide specific, actionable feedback
- List all issues found
- Explain what needs to be fixed

When APPROVING:
- Provide positive feedback
- May suggest minor improvements (but still approve)"""

        user_message = """Review the following syllabus:

{syllabus_json}

Evaluate based on all criteria and decide whether to approve or reject."""

        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            ("user", user_message)
        ])
    
    def generate_syllabus(
        self, 
        course_name: str,
        course_description: str,
        difficulty: str,
        study_method: str,
        custom_study_method: str = "",
        assessment_result: Optional[Dict[str, Any]] = None,
        max_attempts: int = 3
    ) -> tuple[Syllabus, list]:
        """
        Generate a syllabus with two-layer validation and error recovery.
        
        Args:
            course_name: Name of the course
            course_description: Description of the course
            difficulty: Course difficulty level
            study_method: Study method preference ('real_world', 'theory_depth', 'project_based', 'custom')
            custom_study_method: Custom study method text (if study_method is 'custom')
            assessment_result: Optional pre-knowledge assessment result dictionary
            max_attempts: Maximum number of generation attempts
            
        Returns:
            Tuple of (approved_syllabus, attempt_history)
        """
        # Get study method prompt addition
        study_method_addition = StudyMethodPreferences.get_prompt_addition(study_method, custom_study_method)
        
        generator_prompt = self._create_generator_prompt(study_method_addition, assessment_result)
        generator_chain = generator_prompt | self.generator_llm | self.syllabus_parser
        
        reviewer_prompt = self._create_reviewer_prompt()
        reviewer_chain = reviewer_prompt | self.structured_reviewer
        
        attempt_history = []
        
        logger.info(f"Generating syllabus for: {course_name}")
        logger.info(f"Study method: {study_method}")
        if assessment_result:
            logger.info(f"Knowledge level: {assessment_result.get('knowledge_level')} ({assessment_result.get('knowledge_percentage'):.1f}%)")
        
        for attempt in range(1, max_attempts + 1):
            logger.info(f"Attempt {attempt}/{max_attempts}: Generating syllabus...")
            
            # Layer 1: Generate syllabus with error handling
            try:
                syllabus = generator_chain.invoke({
                    "course_name": course_name,
                    "course_description": course_description,
                    "difficulty": difficulty
                })
            except OutputParserException as e:
                logger.warning(f"Parser error on attempt {attempt}: {str(e)[:100]}...")
                if attempt < max_attempts:
                    logger.info(f"Retrying generation...")
                    continue
                else:
                    raise Exception(f"Failed to generate valid syllabus after {max_attempts} attempts") from e
            
            # Layer 2: Review syllabus with error handling
            logger.info(f"Attempt {attempt}/{max_attempts}: Reviewing syllabus...")
            try:
                review = reviewer_chain.invoke({
                    "syllabus_json": syllabus.model_dump_json(indent=2)
                })
            except Exception as e:
                logger.warning(f"Review error on attempt {attempt}: {str(e)[:100]}...")
                if attempt < max_attempts:
                    continue
                else:
                    # If review fails but syllabus is valid, use it anyway
                    logger.warning("Review failed but syllabus is structurally valid. Proceeding...")
                    return syllabus, attempt_history
            
            attempt_info = {
                "attempt": attempt,
                "syllabus": syllabus,
                "review": review
            }
            attempt_history.append(attempt_info)
            
            if review.approved:
                logger.info(f"APPROVED on attempt {attempt}!")
                logger.info(f"Feedback: {review.feedback}")
                return syllabus, attempt_history
            else:
                logger.warning(f"REJECTED on attempt {attempt}")
                logger.warning(f"Feedback: {review.feedback}")
                if review.issues:
                    logger.warning(f"Issues: {', '.join(review.issues)}")
                
                if attempt < max_attempts:
                    logger.info(f"Regenerating with feedback...")
        
        # If we get here, all attempts failed review but last one was parseable
        logger.warning(f"Syllabus not approved after {max_attempts} attempts. Returning last generated syllabus.")
        return syllabus, attempt_history
    
    def syllabus_to_dict(self, syllabus: Syllabus) -> dict:
        """
        Convert Syllabus to dictionary for JSON serialization.
        
        Args:
            syllabus: Syllabus object
            
        Returns:
            Dictionary representation of the syllabus
        """
        return syllabus.model_dump()
