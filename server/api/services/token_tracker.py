"""
token_tracker.py — Global token tracking for every AI call.

This module maintains a PROCESS-WIDE accumulator for input and output tokens
across ALL AI backends and LangChain chains.  It is the single source of truth:
nothing inside ai_client.py or any service file needs to be changed.

HOW IT WORKS
============
1.  `token_tracker.record(in_tok, out_tok, source)` — add to accumulator and
    print a formatted line to stdout (Django dev console).

2.  `TokenTrackingCallback`  — LangChain BaseCallbackHandler that calls
    token_tracker.record() after every LLM inference.

3.  `_patch_langchain_defaults()` — monkeypatches LangChain's global
    `get_callback_manager` / `CallbackManager` so that *every* chain,
    including ones created inside services after startup
    (e.g. `with_structured_output`, generator_chain | reviewer_chain)
    automatically carries our callback — without any service file changes.

The patch runs once at Django AppConfig.ready() time (see apps.py).
"""

from __future__ import annotations

import threading
import time

# ──────────────────────────────────────────────────────────────────────────────
# Accumulator (thread-safe)
# ──────────────────────────────────────────────────────────────────────────────

_lock = threading.Lock()
_session_input = 0
_session_output = 0
_call_count = 0

RESET_TIME = time.time()


def record(prompt_tokens: int, completion_tokens: int, source: str = "AI") -> None:
    """Add tokens to session totals and print a summary."""
    if not prompt_tokens and not completion_tokens:
        return

    global _session_input, _session_output, _call_count
    with _lock:
        _session_input += prompt_tokens
        _session_output += completion_tokens
        _call_count += 1
        si, so, cc = _session_input, _session_output, _call_count

    total = si + so
    uptime_s = int(time.time() - RESET_TIME)
    h, rem = divmod(uptime_s, 3600)
    m, s = divmod(rem, 60)
    uptime = f"{h:02d}:{m:02d}:{s:02d}"

    print(
        "\n" + "═" * 62 + "\n"
        f"  🤖  TOKEN USAGE  —  {source}\n"
        f"  This call:    +{prompt_tokens:>7,} in   +{completion_tokens:>7,} out\n"
        "  " + "─" * 58 + "\n"
        f"  Session total: {si:>7,} in  /  {so:>7,} out  (total {total:,})\n"
        f"  Calls so far: {cc}   |   Uptime: {uptime}\n"
        + "═" * 62 + "\n",
        flush=True,
    )


def get_totals() -> dict:
    """Return current session totals as a dict."""
    with _lock:
        return {
            "input_tokens": _session_input,
            "output_tokens": _session_output,
            "total_tokens": _session_input + _session_output,
            "call_count": _call_count,
        }


# ──────────────────────────────────────────────────────────────────────────────
# LangChain Callback
# ──────────────────────────────────────────────────────────────────────────────

try:
    from langchain_core.callbacks import BaseCallbackHandler  # type: ignore
    from langchain_core.outputs import LLMResult  # type: ignore

    class TokenTrackingCallback(BaseCallbackHandler):
        """
        LangChain callback that fires after every on_llm_end event.

        This covers:
          • ChatOllama (prompt_eval_count / eval_count in response_metadata)
          • ChatGoogleGenerativeAI (prompt_tokens / completion_tokens in usage_metadata)
          • Any future LangChain-wrapped model
        """

        def on_llm_end(self, response: LLMResult, **kwargs) -> None:  # type: ignore
            in_tok = out_tok = 0
            model_name = "LangChain"

            # --- Try llm_output first (some chat models put it here) ---
            lo = response.llm_output or {}
            tu = lo.get("token_usage") or lo.get("usage") or {}
            if tu:
                in_tok = tu.get("prompt_tokens") or tu.get("input_tokens") or 0
                out_tok = (
                    tu.get("completion_tokens")
                    or tu.get("output_tokens")
                    or (tu.get("total_tokens", in_tok) - in_tok)
                )
                model_name = lo.get("model_name", model_name)

            # --- Try generation response_metadata (Ollama / Gemini via LC) ---
            if not in_tok and not out_tok and response.generations:
                gen = response.generations[0]
                if gen:
                    msg = getattr(gen[0], "message", None)
                    meta = getattr(msg, "response_metadata", {}) or {}
                    model_name = meta.get("model", model_name)

                    # Ollama
                    if "prompt_eval_count" in meta:
                        in_tok = meta.get("prompt_eval_count", 0)
                        out_tok = meta.get("eval_count", 0)

                    # Gemini via LangChain
                    elif "usage_metadata" in meta:
                        um = meta["usage_metadata"]
                        in_tok = um.get("prompt_token_count") or um.get("input_tokens", 0)
                        out_tok = um.get("candidates_token_count") or um.get("output_tokens", 0)

                    # Generic token_usage in metadata
                    elif "token_usage" in meta:
                        tu2 = meta["token_usage"]
                        in_tok = tu2.get("prompt_tokens", 0)
                        out_tok = tu2.get("completion_tokens", 0)

            record(in_tok, out_tok, f"LangChain ({model_name})")

    _CALLBACK_INSTANCE = TokenTrackingCallback()

except ImportError:
    TokenTrackingCallback = None  # type: ignore
    _CALLBACK_INSTANCE = None


# ──────────────────────────────────────────────────────────────────────────────
# Global Patch — inject callback into every LangChain LLM call automatically
# ──────────────────────────────────────────────────────────────────────────────

_patched = False


def _patch_langchain_defaults() -> None:
    """
    Monkeypatch ChatOllama and ChatGoogleGenerativeAI so that our callback is
    automatically injected on every .invoke()/.stream() call without requiring
    any service file to pass callbacks=[...].

    This is called ONCE from AppConfig.ready().
    """
    global _patched
    if _patched or _CALLBACK_INSTANCE is None:
        return
    _patched = True

    import importlib, logging
    log = logging.getLogger("token_tracker")

    def _inject(cls_path: str) -> None:
        """Wrap BaseChatModel.invoke / generate of a given class."""
        parts = cls_path.rsplit(".", 1)
        try:
            mod = importlib.import_module(parts[0])
            cls = getattr(mod, parts[1])
        except (ImportError, AttributeError):
            return  # model not installed — skip silently

        orig_generate = cls._generate if hasattr(cls, "_generate") else None
        orig_agenerate = cls._agenerate if hasattr(cls, "_agenerate") else None

        # Patch _generate (sync calls)
        if orig_generate is not None:
            def _patched_generate(self, messages, stop=None, run_manager=None, **kwargs):
                result = orig_generate(self, messages, stop=stop, run_manager=run_manager, **kwargs)
                # Extract tokens from result
                _extract_and_record_from_chat_result(result, cls_path)
                return result
            cls._generate = _patched_generate
            log.debug("token_tracker: patched %s._generate", cls_path)

    def _extract_and_record_from_chat_result(result, source: str) -> None:
        """Pull token counts from a ChatResult and record them."""
        try:
            from langchain_core.outputs import ChatGeneration
            in_tok = out_tok = 0
            for gen_list in [result.generations] if result.generations else []:
                for gen in gen_list:
                    msg = getattr(gen, "message", None)
                    meta = getattr(msg, "response_metadata", {}) or {}
                    um = getattr(msg, "usage_metadata", None) or {}

                    # Ollama
                    if "prompt_eval_count" in meta:
                        in_tok = meta.get("prompt_eval_count", 0)
                        out_tok = meta.get("eval_count", 0)
                        break

                    # Gemini via langchain_google_genai (usage_metadata on msg)
                    if um:
                        in_tok = um.get("input_tokens", 0)
                        out_tok = um.get("output_tokens", 0)
                        break

                    # Gemini via response_metadata usage_metadata
                    if "usage_metadata" in meta:
                        um2 = meta["usage_metadata"]
                        in_tok = um2.get("prompt_token_count", 0)
                        out_tok = um2.get("candidates_token_count", 0)
                        break

            if in_tok or out_tok:
                record(in_tok, out_tok, source)
        except Exception:
            pass  # Never crash the server over token tracking

    # Patch both backends
    _inject("langchain_ollama.chat_models.ChatOllama")
    _inject("langchain_google_genai.chat_models.ChatGoogleGenerativeAI")

    log.info("token_tracker: global LangChain patches applied")
