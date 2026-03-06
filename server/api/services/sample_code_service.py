import json
import logging
import re
from typing import Any, Dict

from api.services.ai_client import generate_text

logger = logging.getLogger(__name__)


class SampleCodeService:
    """Generate editable, runnable sample code for learning (no test cases)."""

    def _extract_json(self, text: str) -> Dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in model response")
        return json.loads(match.group(0))

    def generate_sample(self, course_title: str, topic_name: str, topic_content: str = "") -> Dict[str, Any]:
        prompt = f"""Generate a Python teaching sample for the topic below.

Course: {course_title}
Topic: {topic_name}
Context: {topic_content[:1200] if topic_content else 'N/A'}

Return only valid JSON:
{{
  "title": "string",
  "explanation": "short teaching explanation",
  "starter_code": "python code defining solve(raw_input: str) -> str",
  "sample_input": "optional input string"
}}

Requirements:
- Code must be runnable and editable by learners.
- No test cases.
- Keep code concise and educational.
"""

        try:
            raw = generate_text(prompt, json_mode=True)
            data = self._extract_json(raw)
            starter = data.get("starter_code") or "def solve(raw_input: str) -> str:\n    return raw_input\n"
            return {
                "title": str(data.get("title") or f"Sample Code: {topic_name}"),
                "explanation": str(data.get("explanation") or f"Experiment with this {topic_name} sample and edit it."),
                "starter_code": str(starter),
                "sample_input": str(data.get("sample_input") or ""),
            }
        except Exception as exc:
            logger.error("Failed to generate sample code: %s", exc, exc_info=True)
            return {
                "title": f"Sample Code: {topic_name}",
                "explanation": f"Experiment with this {topic_name} sample and edit it.",
                "starter_code": "def solve(raw_input: str) -> str:\n    # Try editing this function\n    return raw_input.strip()\n",
                "sample_input": "hello world",
            }


_sample_code_service: SampleCodeService | None = None


def get_sample_code_service() -> SampleCodeService:
    global _sample_code_service
    if _sample_code_service is None:
        _sample_code_service = SampleCodeService()
    return _sample_code_service
