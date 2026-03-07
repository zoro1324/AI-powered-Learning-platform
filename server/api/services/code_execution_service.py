import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from typing import Any


class InteractiveSampleSession:
    def __init__(self, session_id: str, process: subprocess.Popen, tmpdir: str):
        self.session_id = session_id
        self.process = process
        self.tmpdir = tmpdir
        self.stdout_buffer = ''
        self.stderr_buffer = ''
        self.stdout_cursor = 0
        self.stderr_cursor = 0
        self.lock = threading.Lock()
        self.created_at = time.time()
        self.last_activity = time.time()


_interactive_sessions: dict[str, InteractiveSampleSession] = {}
_interactive_sessions_lock = threading.Lock()


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
        result = self._run_plain_script(source_code=source_code, raw_input=raw_input, timeout_seconds=timeout_seconds)
        return {
            "status": result.get("status", "internal_error"),
            "stdout": self._normalize_output(result.get("stdout", "")),
            "stderr": result.get("stderr", ""),
            "error_message": result.get("error_message", ""),
            "runtime_ms": result.get("runtime_ms", 0),
        }

    def start_interactive_sample(self, source_code: str) -> dict[str, Any]:
        self._cleanup_expired_sessions()

        tmpdir = tempfile.mkdtemp(prefix="code_exec_live_")
        script_path = os.path.join(tmpdir, "script.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(source_code)

        env = {"PYTHONIOENCODING": "utf-8"}
        process = subprocess.Popen(
            [sys.executable, "-u", script_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tmpdir,
            env=env,
            bufsize=0,
        )

        session_id = str(uuid.uuid4())
        session = InteractiveSampleSession(session_id=session_id, process=process, tmpdir=tmpdir)

        with _interactive_sessions_lock:
            _interactive_sessions[session_id] = session

        self._start_stream_reader(session, stream_name='stdout')
        self._start_stream_reader(session, stream_name='stderr')

        time.sleep(0.12)
        output = self._consume_new_output(session)
        is_running = process.poll() is None

        if not is_running:
            self._finalize_session(session_id)

        return {
            "session_id": session_id,
            "output": self._normalize_output(output),
            "is_running": is_running,
            "exit_code": process.poll(),
        }

    def send_interactive_input(self, session_id: str, user_input: str) -> dict[str, Any]:
        session = self._get_session(session_id)
        if session is None:
            return {
                "session_id": session_id,
                "output": "Session not found or already closed.",
                "is_running": False,
                "exit_code": None,
            }

        process = session.process
        if process.poll() is None:
            try:
                if process.stdin:
                    process.stdin.write((user_input or '') + "\n")
                    process.stdin.flush()
            except Exception as exc:
                return {
                    "session_id": session_id,
                    "output": f"Traceback\n{str(exc)}",
                    "is_running": False,
                    "exit_code": process.poll(),
                }

        time.sleep(0.12)
        output = self._consume_new_output(session)
        is_running = process.poll() is None
        exit_code = process.poll()

        if not is_running:
            self._finalize_session(session_id)

        return {
            "session_id": session_id,
            "output": self._normalize_output(output),
            "is_running": is_running,
            "exit_code": exit_code,
        }

    def stop_interactive_sample(self, session_id: str) -> dict[str, Any]:
        session = self._get_session(session_id)
        if session is None:
            return {
                "session_id": session_id,
                "output": "",
                "is_running": False,
                "exit_code": None,
            }

        process = session.process
        if process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=1)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass

        time.sleep(0.05)
        output = self._consume_new_output(session)
        exit_code = process.poll()
        self._finalize_session(session_id)

        return {
            "session_id": session_id,
            "output": self._normalize_output(output),
            "is_running": False,
            "exit_code": exit_code,
        }

    def _run_plain_script(self, source_code: str, raw_input: str, timeout_seconds: int) -> dict[str, Any]:
        """Execute source code as a normal Python script (no solve() contract)."""
        with tempfile.TemporaryDirectory(prefix="code_exec_") as tmpdir:
            script_path = os.path.join(tmpdir, "script.py")

            with open(script_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            env = {"PYTHONIOENCODING": "utf-8"}
            command = [sys.executable, "-I", script_path]
            # Provide at least one line of stdin so a single input() call does not immediately raise EOFError.
            stdin_payload = raw_input if raw_input else "\n"
            try:
                completed = subprocess.run(
                    command,
                    input=stdin_payload,
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

    def _start_stream_reader(self, session: InteractiveSampleSession, stream_name: str) -> None:
        stream = session.process.stdout if stream_name == 'stdout' else session.process.stderr
        if stream is None:
            return

        def _reader() -> None:
            while True:
                ch = stream.read(1)
                if ch == '':
                    break
                with session.lock:
                    if stream_name == 'stdout':
                        session.stdout_buffer += ch
                    else:
                        session.stderr_buffer += ch
                    session.last_activity = time.time()

        thread = threading.Thread(target=_reader, daemon=True)
        thread.start()

    def _consume_new_output(self, session: InteractiveSampleSession) -> str:
        with session.lock:
            out_new = session.stdout_buffer[session.stdout_cursor:]
            err_new = session.stderr_buffer[session.stderr_cursor:]
            session.stdout_cursor = len(session.stdout_buffer)
            session.stderr_cursor = len(session.stderr_buffer)
            session.last_activity = time.time()
        return f"{out_new}{err_new}"

    def _get_session(self, session_id: str) -> InteractiveSampleSession | None:
        with _interactive_sessions_lock:
            return _interactive_sessions.get(session_id)

    def _finalize_session(self, session_id: str) -> None:
        with _interactive_sessions_lock:
            session = _interactive_sessions.pop(session_id, None)

        if session is None:
            return

        try:
            if session.process.poll() is None:
                session.process.terminate()
        except Exception:
            pass

        try:
            shutil.rmtree(session.tmpdir, ignore_errors=True)
        except Exception:
            pass

    def _cleanup_expired_sessions(self, max_age_seconds: int = 1800) -> None:
        now = time.time()
        expired_ids: list[str] = []
        with _interactive_sessions_lock:
            for session_id, session in _interactive_sessions.items():
                if (now - session.last_activity) > max_age_seconds:
                    expired_ids.append(session_id)

        for session_id in expired_ids:
            self._finalize_session(session_id)

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
    global _code_execution_service
    if _code_execution_service is None:
        _code_execution_service = CodeExecutionService()
    return _code_execution_service


_code_execution_service: CodeExecutionService | None = None
