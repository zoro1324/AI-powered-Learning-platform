import json
import logging
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from .ai_client import generate_text

logger = logging.getLogger(__name__)


@dataclass
class GeneratedCodingProblem:
    title: str
    problem_statement: str
    starter_code: str
    reference_solution: str
    difficulty: str
    constraints: dict[str, Any]
    hints: list[str]
    visible_tests: list[dict[str, Any]]
    hidden_tests: list[dict[str, Any]]


class CodeProblemService:
    """Generates Python coding exercises tied to a lesson topic."""

    def generate_problem(self, course_name: str, topic_name: str, topic_context: str = "") -> GeneratedCodingProblem:
        prompt = self._build_prompt(course_name=course_name, topic_name=topic_name, topic_context=topic_context)
        system_prompt = (
            "You generate coding practice for learners. "
            "Return strict JSON only and keep problem statements concise and beginner-friendly."
        )

        coding_model = getattr(settings, 'CODING_MODEL', 'qwen2.5-coder:7b')
        raw = generate_text(
            prompt,
            system_prompt=system_prompt,
            json_mode=True,
            model=coding_model,
        )
        parsed = self._safe_parse_json(raw)
        if parsed is None:
            logger.warning("Falling back to template coding problem for topic=%s", topic_name)
            return self._fallback_problem(topic_name)

        return self._normalize_problem(parsed, topic_name)

    def _build_prompt(self, course_name: str, topic_name: str, topic_context: str) -> str:
        return (
            f"Course: {course_name}\n"
            f"Topic: {topic_name}\n"
            f"Context: {topic_context[:2000]}\n\n"
            "Generate ONE Python coding problem where the learner writes a function solve(raw_input: str) -> str.\n"
            "Output JSON object with fields:\n"
            "title (string), problem_statement (string), starter_code (string), reference_solution (string),\n"
            "difficulty (easy|intermediate|difficult), constraints (object), hints (array of strings),\n"
            "visible_tests (array of objects: input_data, expected_output, explanation),\n"
            "hidden_tests (array of objects: input_data, expected_output, explanation).\n"
            "At least 2 visible tests and 2 hidden tests.\n"
            "No markdown fences. JSON only."
        )

    def _safe_parse_json(self, raw: str) -> dict[str, Any] | None:
        if not raw:
            return None

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        try:
            return json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            return None

    def _normalize_problem(self, payload: dict[str, Any], topic_name: str) -> GeneratedCodingProblem:
        visible_tests = self._normalize_tests(payload.get("visible_tests", []), hidden=False)
        hidden_tests = self._normalize_tests(payload.get("hidden_tests", []), hidden=True)

        if len(visible_tests) < 2 or len(hidden_tests) < 2:
            fallback = self._fallback_problem(topic_name)
            visible_tests = visible_tests if len(visible_tests) >= 2 else fallback.visible_tests
            hidden_tests = hidden_tests if len(hidden_tests) >= 2 else fallback.hidden_tests

        difficulty = str(payload.get("difficulty") or "intermediate").strip().lower()
        if difficulty not in {"easy", "intermediate", "difficult"}:
            difficulty = "intermediate"

        starter_code = str(payload.get("starter_code") or "").strip()
        if "def solve" not in starter_code:
            starter_code = self._default_starter_code()

        reference_solution = str(payload.get("reference_solution") or "").strip()
        if "def solve" not in reference_solution:
            reference_solution = self._default_reference_solution()

        constraints = payload.get("constraints")
        if not isinstance(constraints, dict):
            constraints = {"input": "Single line input", "output": "Single line output"}

        hints = payload.get("hints")
        if not isinstance(hints, list):
            hints = ["Parse the input carefully.", "Return output exactly as expected."]

        return GeneratedCodingProblem(
            title=str(payload.get("title") or f"{topic_name} Practice").strip(),
            problem_statement=str(payload.get("problem_statement") or "Write solve(raw_input) to produce correct output.").strip(),
            starter_code=starter_code,
            reference_solution=reference_solution,
            difficulty=difficulty,
            constraints=constraints,
            hints=[str(h).strip() for h in hints if str(h).strip()],
            visible_tests=visible_tests,
            hidden_tests=hidden_tests,
        )

    def _normalize_tests(self, tests: Any, hidden: bool) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        if not isinstance(tests, list):
            return normalized

        for idx, item in enumerate(tests, start=1):
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    "input_data": str(item.get("input_data", "")),
                    "expected_output": str(item.get("expected_output", "")),
                    "explanation": str(item.get("explanation", "")).strip(),
                    "is_hidden": hidden,
                    "order": idx,
                    "weight": 1.0,
                }
            )
        return normalized

    def _fallback_problem(self, topic_name: str) -> GeneratedCodingProblem:
        title = f"{topic_name} - Sum Integers"
        statement = (
            "Given space-separated integers in one line, return their sum as a string. "
            "Implement solve(raw_input: str) -> str."
        )
        starter_code = self._default_starter_code()
        solution = self._default_reference_solution()

        visible_tests = [
            {
                "input_data": "1 2 3",
                "expected_output": "6",
                "explanation": "Basic positive integers.",
                "is_hidden": False,
                "order": 1,
                "weight": 1.0,
            },
            {
                "input_data": "10 -2 5",
                "expected_output": "13",
                "explanation": "Includes negative number.",
                "is_hidden": False,
                "order": 2,
                "weight": 1.0,
            },
        ]
        hidden_tests = [
            {
                "input_data": "",
                "expected_output": "0",
                "explanation": "Empty input means zero.",
                "is_hidden": True,
                "order": 3,
                "weight": 1.0,
            },
            {
                "input_data": "100",
                "expected_output": "100",
                "explanation": "Single value.",
                "is_hidden": True,
                "order": 4,
                "weight": 1.0,
            },
        ]

        return GeneratedCodingProblem(
            title=title,
            problem_statement=statement,
            starter_code=starter_code,
            reference_solution=solution,
            difficulty="easy",
            constraints={"input": "Space separated integers", "output": "Single integer sum"},
            hints=["Split input by spaces.", "Handle empty input."],
            visible_tests=visible_tests,
            hidden_tests=hidden_tests,
        )

    def _default_starter_code(self) -> str:
        return (
            "def solve(raw_input: str) -> str:\n"
            "    # TODO: write your solution\n"
            "    return \"\"\n"
        )

    def _default_reference_solution(self) -> str:
        return (
            "def solve(raw_input: str) -> str:\n"
            "    text = raw_input.strip()\n"
            "    if not text:\n"
            "        return \"0\"\n"
            "    nums = [int(part) for part in text.split()]\n"
            "    return str(sum(nums))\n"
        )


def get_code_problem_service() -> CodeProblemService:
    return CodeProblemService()
