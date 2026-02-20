"""
Podcast Generation Service

This service handles:
1. Persona option generation
2. Scenario option generation
3. Podcast script generation
4. Audio synthesis using edge-tts
"""

import json
import logging
import uuid
import os
import asyncio
from typing import Dict, List, Any, Optional

import requests
from django.conf import settings
import edge_tts

logger = logging.getLogger(__name__)


class PodcastService:
    """Service for AI-powered podcast generation."""
    
    def __init__(self, ollama_url: str = None, ollama_model: str = None):
        """
        Initialize the podcast service.
        
        Args:
            ollama_url: Ollama API URL (defaults to settings.OLLAMA_API_URL)
            ollama_model: Ollama model name (defaults to settings.OLLAMA_MODEL)
        """
        base_url = ollama_url or settings.OLLAMA_API_URL
        self.ollama_url = base_url.replace('/api/generate', '/api/chat')
        self.ollama_model = ollama_model or settings.OLLAMA_MODEL
        
        # Voice mapping for personas
        self.voice_map = {
            "person1": "en-US-GuyNeural",   # Male voice
            "person2": "en-US-JennyNeural"  # Female voice
        }
        
        logger.info(f"PodcastService initialized with model: {self.ollama_model}")
    
    def _call_ollama(self, prompt: str, system_prompt: str = None) -> str:
        """
        Make a request to Ollama API.
        
        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            
        Returns:
            The response content as string
        """
        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            response = requests.post(
                self.ollama_url,
                json={
                    'model': self.ollama_model,
                    'messages': messages,
                    'format': 'json',
                    'stream': False
                },
                timeout=300
            )
            response.raise_for_status()
            data = response.json()
            return data['message']['content']
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API error: {e}")
            raise Exception(f"Failed to call Ollama API: {str(e)}")
    
    def generate_persona_options(self, text: str) -> List[Dict[str, str]]:
        """
        Analyze content and propose 3 distinct persona pairs.
        
        Args:
            text: The content to analyze
            
        Returns:
            List of persona pair options
        """
        prompt = f"""
        Analyze the following content and propose 3 distinct pairs of personas (Host 1 and Host 2) for an audio conversation about it.
        Each pair should represent a different dynamic or angle (e.g., Skeptic vs Believer, Expert vs Novice, Enthusiast vs Realist).
        
        Content Summary:
        {text[:10000]}... (truncated)

        Return ONLY a JSON object with a key 'options' which is a list of objects.
        Each object must have 'person1' (name/role) and 'person2' (name/role).
        Example: 
        {{
            "options": [
                {{"person1": "Professor X (Expert)", "person2": "Student Y (Curious)"}},
                {{"person1": "Tech Optimist", "person2": "Tech Skeptic"}},
                {{"person1": "Historian", "person2": "Futurist"}}
            ]
        }}
        """
        
        try:
            response = self._call_ollama(prompt)
            data = json.loads(response)
            options = data.get('options', [])
            
            if not options or len(options) == 0:
                # Return default options
                return [
                    {"person1": "Expert", "person2": "Novice"},
                    {"person1": "Skeptic", "person2": "Enthusiast"},
                    {"person1": "Host 1", "person2": "Host 2"}
                ]
            
            return options
            
        except Exception as e:
            logger.error(f"Error generating persona options: {e}")
            # Return default options on error
            return [
                {"person1": "Expert", "person2": "Novice"},
                {"person1": "Skeptic", "person2": "Enthusiast"},
                {"person1": "Host 1", "person2": "Host 2"}
            ]
    
    def generate_scenario_options(self, text: str, personas: Optional[Dict[str, str]] = None) -> List[str]:
        """
        Generate 3 distinct conversational scenarios based on content and selected personas.
        
        Args:
            text: The content to analyze
            personas: Optional selected personas dict with 'person1' and 'person2'
            
        Returns:
            List of scenario options
        """
        persona_context = ""
        if personas:
            persona_context = f"The conversation will be between {personas.get('person1')} and {personas.get('person2')}."

        prompt = f"""
        Analyze the following content and propose 3 distinct, creative conversational scenarios for an audio overview.
        {persona_context}
        Consider the perspectives of the specific personas defined above.
        
        Content Summary:
        {text[:10000]}... (truncated)

        Return ONLY a JSON object with a key 'options' which is a list of strings.
        Example: {{"options": ["Debate on ethics", "Deep dive into history", "Practical application discussion"]}}
        """
        
        try:
            response = self._call_ollama(prompt)
            data = json.loads(response)
            options = data.get('options', [])
            
            if not options or len(options) == 0:
                return ["Deep Dive", "Critical Analysis", "Casual Overview"]
            
            return options
            
        except Exception as e:
            logger.error(f"Error generating scenario options: {e}")
            return ["Deep Dive", "Critical Analysis", "Casual Overview"]
    
    def generate_podcast(
        self,
        text: str,
        instruction: Optional[str] = None,
        person1: Optional[str] = None,
        person2: Optional[str] = None,
        output_dir: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Optional[str]:
        """
        Main method to generate an audio overview from text.
        
        Args:
            text: The content to create podcast from
            instruction: Optional scenario/instruction
            person1: Optional persona 1 name/role
            person2: Optional persona 2 name/role
            output_dir: Optional output directory path
            system_prompt: Optional personalized system prompt from enrollment learning style
            
        Returns:
            Path to the generated audio file or None on failure
        """
        try:
            # 1. Determine Roles
            roles = self._determine_roles(text, instruction, person1, person2)
            logger.info(f"Selected Roles: {roles}")
            
            # 2. Generate Script (with personalized system prompt if available)
            script = self._generate_script(text, roles, instruction, system_prompt=system_prompt)
            logger.info(f"Generated Script with {len(script)} turns")
            
            if not script:
                logger.error("Script generation failed or returned empty script")
                return None
            
            # 3. Generate Audio
            audio_file = self._generate_audio(script, roles, output_dir)
            
            return audio_file
            
        except Exception as e:
            logger.error(f"Error in generate_podcast: {e}")
            return None
    
    def _determine_roles(
        self,
        text: str,
        instruction: Optional[str] = None,
        person1: Optional[str] = None,
        person2: Optional[str] = None
    ) -> Dict[str, str]:
        """Determine suitable roles for the conversation"""
        
        # If roles are explicitly provided, use them
        if person1 and person2:
            return {"person1": person1, "person2": person2}

        instruction_context = f"User Instruction/Theme: {instruction}" if instruction else ""
        
        role_prompt = f"""
        Analyze the following content and determine the two most suitable roles for a conversation about it.
        {instruction_context}
        
        If the instruction suggests specific personas (e.g. "Student and Teacher"), USE THEM.
        Otherwise, infer the best roles from the content.
        
        Examples:
        - Instruction: "Casual chat" -> Person 1: "Sarah", Person 2: "Naveen"
        - Instruction: "Academic explanation" -> Person 1: "Professor", Person 2: "Student"
        - Content is Technical -> Person 1: "Expert", Person 2: "Novice"

        Content:
        {text[:10000]}... (truncated)

        Return ONLY a JSON object with keys 'person1' (the lead speaker) and 'person2' (the second speaker). 
        Do not add any other text.
        Example format: {{"person1": "...", "person2": "..."}}
        """
        
        try:
            response = self._call_ollama(role_prompt)
            roles = json.loads(response)
            
            # Ensure keys exist
            if 'person1' not in roles:
                roles['person1'] = roles.get('host', 'Speaker 1')
            if 'person2' not in roles:
                roles['person2'] = roles.get('guest', 'Speaker 2')
            
            return roles
            
        except Exception as e:
            logger.error(f"Error determining roles: {e}")
            return {"person1": "Speaker 1", "person2": "Speaker 2"}
    
    def _generate_script(
        self,
        text: str,
        roles: Dict[str, str],
        instruction: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Generate the podcast script"""
        
        instruction_text = f"Focus on this specific theme/format: {instruction}" if instruction else "Cover the key points naturally."
        
        # Prepend personalized system prompt context if available
        style_context = ""
        if system_prompt:
            style_context = f"\n\nIMPORTANT - Presentation style guidance:\n{system_prompt}\n"
        
        podcast_prompt = f"""
        Generate a natural conversation between {roles.get('person1', 'Speaker 1')} and {roles.get('person2', 'Speaker 2')} based on the following content.
        Make it engaging, authentic, and easy to follow.
        Make it a comprehensive deep dive. Do not limit the conversation length. 
        {instruction_text}{style_context}

        Content:
        {text[:12000]}... (truncated if too long)

        Return the output as a JSON object with a key 'conversation' which is a list of objects.
        Each object in the list should have 'speaker' and 'text' keys.
        Ensure the 'speaker' field matches exactly one of the roles: "{roles.get('person1', 'Speaker 1')}" or "{roles.get('person2', 'Speaker 2')}".
        Example format:
        {{
          "conversation": [
            {{"speaker": "{roles.get('person1', 'Speaker 1')}", "text": "Hello..."}},
            {{"speaker": "{roles.get('person2', 'Speaker 2')}", "text": "Hi there..."}}
          ]
        }}
        """
        
        try:
            response = self._call_ollama(podcast_prompt)
            data = json.loads(response)
            
            # Extract conversation list safely
            if 'conversation' in data:
                return data['conversation']
            elif isinstance(data, list):
                return data
            else:
                # Try to find a list in values
                for v in data.values():
                    if isinstance(v, list):
                        return v
            
            logger.warning("No conversation found in script response")
            return []
            
        except Exception as e:
            logger.error(f"Error generating script: {e}")
            return []
    
    def _generate_audio(
        self,
        script: List[Dict[str, str]],
        roles: Dict[str, str],
        output_dir: Optional[str] = None
    ) -> Optional[str]:
        """Convert script to audio"""
        
        if not script:
            logger.warning("Script is empty, cannot generate audio")
            return None
        
        # Determine output directory
        if output_dir is None:
            output_dir = os.path.join(settings.MEDIA_ROOT, 'podcasts')
        
        # Create directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        async def _generate_segment(text: str, voice: str, filename: str):
            """Generate a single audio segment"""
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filename)
        
        async def _process_script():
            """Process all script segments"""
            segments = []
            person1_role = roles.get('person1', 'Speaker 1')
            
            for i, turn in enumerate(script):
                speaker = turn.get('speaker', '')
                text = turn.get('text', '')
                
                if not text:
                    continue
                
                # Determine voice based on speaker
                if speaker == person1_role or person1_role in speaker:
                    voice = self.voice_map['person1']
                else:
                    voice = self.voice_map['person2']
                
                filename = os.path.join(output_dir, f"segment_{i}_{uuid.uuid4().hex[:8]}.mp3")
                await _generate_segment(text, voice, filename)
                segments.append(filename)
            
            return segments
        
        try:
            # Generate all segments
            segment_files = asyncio.run(_process_script())
            
            if not segment_files:
                logger.error("No audio segments were generated")
                return None
            
            # Combine segments
            final_filename = f"podcast_{uuid.uuid4().hex[:8]}.mp3"
            final_path = os.path.join(output_dir, final_filename)
            
            with open(final_path, 'wb') as outfile:
                for segment_file in segment_files:
                    with open(segment_file, 'rb') as infile:
                        outfile.write(infile.read())
                    # Clean up segment
                    try:
                        os.remove(segment_file)
                    except Exception as e:
                        logger.warning(f"Could not remove segment file {segment_file}: {e}")
            
            logger.info(f"Podcast generated successfully: {final_path}")
            return final_path
            
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            return None


# Singleton instance
_podcast_service = None


def get_podcast_service() -> PodcastService:
    """Get or create singleton instance of PodcastService"""
    global _podcast_service
    if _podcast_service is None:
        _podcast_service = PodcastService()
    return _podcast_service
