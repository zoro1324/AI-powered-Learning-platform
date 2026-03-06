import os
import subprocess
import sys
import tempfile
from typing import Any


class CodeExecutionService:
    """Runs learner Python submissions against generated test cases."""

    def run_python_tests(self, source_code: str, test_cases: list[Any], timeout_seconds: int = 2) -> dict[str, Any]:
        results: list[dict[str, Any]] = []
        passed_count = 0
        total_count = len(test_cases)

        for case in test_cases:
            result = self._run_single_case(source_code=source_code, raw_input=case.input_data, timeout_seconds=timeout_seconds)
            expected = self._normalize_output(case.expected_output)
            actual = self._normalize_output(result.get("stdout", ""))
            passed = result.get("status") == "ok" and expected == actual
            if passed:
                passed_count += 1

            case_result = {
                "test_case_id": case.id,
                "is_hidden": bool(case.is_hidden),
                "passed": passed,
                "input_data": case.input_data if not case.is_hidden else None,
                "expected_output": case.expected_output if not case.is_hidden else None,
                "actual_output": actual if not case.is_hidden else None,
                "error_message": result.get("error_message", ""),
                "stderr": result.get("stderr", "") if not case.is_hidden else "",
                "runtime_ms": result.get("runtime_ms", 0),
            }
            results.append(case_result)

        score = round((passed_count / total_count) * 100, 2) if total_count else 0.0
        feedback = self._build_feedback(score, passed_count, total_count)

        return {
            "score_percent": score,
            "passed_tests": passed_count,
            "total_tests": total_count,
            "feedback": feedback,
            "test_results": results,
        }

    def run_python_sample(self, source_code: str, raw_input: str = '', timeout_seconds: int = 3) -> dict[str, Any]:
        """Run learner sample code once and return stdout/stderr (no test assertions)."""
        result = self._run_single_case(source_code=source_code, raw_input=raw_input, timeout_seconds=timeout_seconds)
        return {
            "status": result.get("status", "internal_error"),
            "stdout": self._normalize_output(result.get("stdout", "")),
            "stderr": result.get("stderr", ""),
            "error_message": result.get("error_message", ""),
            "runtime_ms": result.get("runtime_ms", 0),
        }

    def _run_single_case(self, source_code: str, raw_input: str, timeout_seconds: int) -> dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="code_exec_") as tmpdir:
            submission_path = os.path.join(tmpdir, "submission.py")
            runner_path = os.path.join(tmpdir, "runner.py")

            with open(submission_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            runner_code = (
                "import importlib.util\n"
                "import sys\n"
                "\n"
                "spec = importlib.util.spec_from_file_location('submission', 'submission.py')\n"
                "module = importlib.util.module_from_spec(spec)\n"
                "spec.loader.exec_module(module)\n"
                "if not hasattr(module, 'solve'):\n"
                "    raise AttributeError('Function solve(raw_input: str) is required')\n"
                "raw = sys.stdin.read()\n"
                "result = module.solve(raw)\n"
                "if result is None:\n"
                "    result = ''\n"
                "sys.stdout.write(str(result).strip())\n"
            )
            with open(runner_path, "w", encoding="utf-8") as f:
                f.write(runner_code)

            env = {"PYTHONIOENCODING": "utf-8"}
            command = [sys.executable, "-I", runner_path]
            try:
                completed = subprocess.run(
                    command,
                    input=raw_input,
                    text=True,
                    capture_output=True,
                    timeout=timeout_seconds,
                    cwd=tmpdir,
                    env=env,
                    check=False,
                )
                status = "ok" if completed.returncode == 0 else "runtime_error"
                return {
                    "status": status,
                    "stdout": completed.stdout,
                    "stderr": completed.stderr,
                    "runtime_ms": 0,
                    "error_message": "" if status == "ok" else (completed.stderr or "Runtime error"),
                }
            except subprocess.TimeoutExpired:
                return {
                    "status": "timeout",
                    "stdout": "",
                    "stderr": "",
                    "runtime_ms": timeout_seconds * 1000,
                    "error_message": "Execution timed out",
                }
            except Exception as exc:
                return {
                    "status": "internal_error",
                    "stdout": "",
                    "stderr": "",
                    "runtime_ms": 0,
                    "error_message": str(exc),
                }

    def _normalize_output(self, value: str) -> str:
        return (value or "").strip().replace("\r\n", "\n")

    def _build_feedback(self, score: float, passed: int, total: int) -> dict[str, Any]:
        if total == 0:
            return {
                "summary": "No tests were available.",
                "next_steps": ["Try regenerating the coding problem."],
            }

        if score == 100:
            return {
                "summary": "Great job. All tests passed.",
                "next_steps": ["Try optimizing your solution or handling additional edge cases."],
            }

        return {
            "summary": f"{passed}/{total} tests passed.",
            "next_steps": [
                "Compare your output format with expected output.",
                "Handle edge cases like empty input and extra spaces.",
                "Use the visible failed tests to debug your solve function.",
            ],
        }


def get_code_execution_service() -> CodeExecutionService:
    return CodeExecutionService()
