import json
import logging
import re
from typing import Any, Dict, List, Optional

from api.services.ai_client import generate_text

logger = logging.getLogger(__name__)


class DynamicScriptService:
    """Generate an interactive learning script as typed blocks."""

    ALLOWED_TYPES = {"text", "code", "video", "mind_map", "quiz"}

    def _extract_json(self, text: str) -> Dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in model response")
        return json.loads(match.group(0))

    def _normalize_block_type(self, raw: str) -> str:
        value = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
        if value == "mindmap":
            value = "mind_map"
        return value

    def _fallback_script(self, topic_name: str) -> Dict[str, Any]:
        return {
            "schema_version": "1.0",
            "title": f"Interactive Script: {topic_name}",
            "overview": f"A guided interactive script for {topic_name}.",
            "blocks": [
                {
                    "type": "text",
                    "prompt": f"Explain the core idea of {topic_name} in simple terms.",
                    "payload": {
                        "markdown": f"## {topic_name}\n\nStart by understanding the key ideas, then move into practice."
                    },
                },
                {
                    "type": "code",
                    "prompt": f"Write a beginner-friendly Python exercise for {topic_name}.",
                    "payload": {
                        "title": f"Practice: {topic_name}",
                        "language": "python",
                        "starter_code": "def solve(raw_input: str) -> str:\n    # TODO: implement\n    return ''\n",
                        "instructions": "Implement solve(raw_input) and return the expected output string.",
                    },
                },
                {
                    "type": "quiz",
                    "prompt": f"Create a short 3-question check for {topic_name}.",
                    "payload": {
                        "questions": [
                            {
                                "question": f"What is the main goal when learning {topic_name}?",
                                "options": [
                                    "Memorize without practice",
                                    "Understand and apply concepts",
                                    "Skip fundamentals",
                                    "Avoid exercises",
                                ],
                                "correct_answer": "Understand and apply concepts",
                                "explanation": "Conceptual understanding plus application leads to mastery.",
                            }
                        ]
                    },
                },
            ],
        }

    def _sanitize_blocks(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        sanitized: List[Dict[str, Any]] = []

        for block in blocks:
            block_type = self._normalize_block_type(str(block.get("type", "")))
            prompt = str(block.get("prompt", "")).strip()
            payload = block.get("payload") or {}

            if block_type not in self.ALLOWED_TYPES:
                continue
            if not prompt:
                continue
            if not isinstance(payload, dict):
                payload = {"value": payload}

            sanitized.append(
                {
                    "type": block_type,
                    "prompt": prompt,
                    "payload": payload,
                }
            )

        return sanitized

    def generate_script(
        self,
        course_title: str,
        topic_name: str,
        topic_description: str = "",
        lesson_content: str = "",
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        instruction = f"""Generate an interactive learning script for the topic below.

Course: {course_title}
Topic: {topic_name}
Topic description: {topic_description or 'N/A'}
Existing lesson content excerpt: {lesson_content[:1800] if lesson_content else 'N/A'}

Return ONLY JSON with this exact structure:
{{
  "schema_version": "1.0",
  "title": "string",
  "overview": "string",
  "blocks": [
    {{
      "type": "text | code | video | mind_map | quiz",
      "prompt": "Describe what this block should do for the learner",
      "payload": {{}}
    }}
  ]
}}

Requirements:
- Include at least one `text` block and one `quiz` block.
- Include `code` block when topic benefits from hands-on coding.
- Keep blocks in a sensible learning sequence.
- `payload` guidance by block type:
  - text: {{"markdown": "..."}}
  - code: {{"title": "...", "language": "python", "starter_code": "...", "instructions": "..."}}
  - video: {{"title": "...", "description": "...", "key_points": ["..."]}}
  - mind_map: {{"root": "...", "nodes": [{{"id":"1","label":"...","parent_id":null}}]}}
  - quiz: {{"questions": [{{"question":"...","options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}}]}}
- Keep the response concise and valid JSON.
"""

        try:
            response = generate_text(
                instruction,
                system_prompt=system_prompt,
                json_mode=True,
            )
            parsed = self._extract_json(response)
            blocks = self._sanitize_blocks(parsed.get("blocks") or [])

            if not blocks:
                return self._fallback_script(topic_name)

            return {
                "schema_version": str(parsed.get("schema_version") or "1.0"),
                "title": str(parsed.get("title") or f"Interactive Script: {topic_name}"),
                "overview": str(parsed.get("overview") or f"Interactive learning path for {topic_name}."),
                "blocks": blocks,
            }
        except Exception as exc:
            logger.error("Failed to generate dynamic script: %s", exc, exc_info=True)
            return self._fallback_script(topic_name)


_dynamic_script_service: Optional[DynamicScriptService] = None


def get_dynamic_script_service() -> DynamicScriptService:
    global _dynamic_script_service
    if _dynamic_script_service is None:
        _dynamic_script_service = DynamicScriptService()
    return _dynamic_script_service
