"""
Unified AI Client
=================
This module is the single source of truth for all AI calls in the server.

IS_PRODUCTION=False  → OLLAMA (text/chat)  + Stable Diffusion (images)
IS_PRODUCTION=True   → Gemini API  (text/chat)  + Gemini Imagen (images)

Usage
-----
    from api.services.ai_client import generate_text, generate_image, get_langchain_llm

    # Text / chat generation
    text = generate_text("Explain neural networks", system_prompt="Be concise")

    # Image generation — returns a PIL.Image or saves to disk
    img  = generate_image("A futuristic city skyline", output_path="/tmp/out.png")

    # LangChain-compatible LLM (for services that use LangChain chains)
    llm  = get_langchain_llm(temperature=0.7)
"""

import io
import logging
import os
from typing import Optional

import requests
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Token Tracking — delegates to api.services.token_tracker
# ─────────────────────────────────────────────────────────────────────────────

try:
    from api.services.token_tracker import record as _record_tokens, _CALLBACK_INSTANCE as _LC_CALLBACK
except ImportError:
    # Fallback if tracker not yet available
    def _record_tokens(in_tok, out_tok, source="AI"):  # type: ignore
        pass
    _LC_CALLBACK = None


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _use_gemini_text() -> bool:
    """Return True when text / chat generation should use Gemini."""
    return getattr(settings, 'USE_GEMINI_TEXT', getattr(settings, 'IS_PRODUCTION', False))


def _use_gemini_image() -> bool:
    """Return True when image generation should use Gemini Imagen."""
    return getattr(settings, 'USE_GEMINI_IMAGE', getattr(settings, 'IS_PRODUCTION', False))


# ── Ollama text helper ────────────────────────────────────────────────────────

def _ollama_generate(prompt: str, system_prompt: Optional[str] = None, json_mode: bool = False) -> str:
    """Send a chat request to the local Ollama server."""
    base_url = getattr(settings, 'OLLAMA_API_URL', 'http://localhost:11434/api/generate')
    chat_url = base_url.replace('/api/generate', '/api/chat')
    model = getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
    timeout = getattr(settings, 'OLLAMA_TIMEOUT', 600)

    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': prompt})

    payload: dict = {
        'model': model,
        'messages': messages,
        'stream': False,
    }
    if json_mode:
        payload['format'] = 'json'

    logger.info("AI Client [DEV] → Ollama model=%s json_mode=%s", model, json_mode)
    response = requests.post(
        chat_url,
        json=payload,
        headers={'Content-Type': 'application/json'},
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get('message', {}).get('content', '')

    # Track tokens from Ollama response
    in_toks = data.get('prompt_eval_count', 0)
    out_toks = data.get('eval_count', 0)
    _record_tokens(in_toks, out_toks, f"Ollama ({model})")

    logger.info("AI Client [DEV] ← Ollama response length=%d", len(content))
    return content


# ── Gemini text helper ────────────────────────────────────────────────────────

def _gemini_generate(prompt: str, system_prompt: Optional[str] = None, json_mode: bool = False) -> str:
    """Send a chat request to the Gemini API."""
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise RuntimeError(
            "google-generativeai is not installed. "
            "Run: pip install google-generativeai"
        ) from exc

    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to your .env file."
        )
    model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')

    genai.configure(api_key=api_key)

    generation_config = {}
    if json_mode:
        generation_config['response_mime_type'] = 'application/json'

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt if system_prompt else None,
        generation_config=generation_config if generation_config else None,
    )

    logger.info("AI Client [PROD] → Gemini model=%s json_mode=%s", model_name, json_mode)
    response = model.generate_content(prompt)
    content = response.text or ''

    # Track tokens from Gemini response
    try:
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            in_toks = response.usage_metadata.prompt_token_count
            out_toks = response.usage_metadata.candidates_token_count
            _record_tokens(in_toks, out_toks, f"Gemini ({model_name})")
    except Exception as exc:
        logger.warning("Failed to extract Gemini token counts: %s", exc)

    logger.info("AI Client [PROD] ← Gemini response length=%d", len(content))
    return content


# ── Stable Diffusion image helper ─────────────────────────────────────────────

_sd_pipeline = None  # lazy singleton


def _get_sd_pipeline():
    """Lazily load and cache the Stable Diffusion pipeline (dev only)."""
    global _sd_pipeline
    if _sd_pipeline is not None:
        return _sd_pipeline

    import torch
    from diffusers import StableDiffusionPipeline
    from diffusers.schedulers import LCMScheduler

    model_id = 'runwayml/stable-diffusion-v1-5'
    lora_id = 'latent-consistency/lcm-lora-sdv1-5'
    device = 'cuda' if torch.cuda.is_available() else 'cpu'

    logger.info("AI Client [DEV] Loading Stable Diffusion on %s ...", device)

    pipe = StableDiffusionPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
        safety_checker=None,
    ).to(device)

    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()
    if device == 'cuda':
        pipe.enable_model_cpu_offload()

    pipe.load_lora_weights(lora_id)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

    _sd_pipeline = pipe
    logger.info("AI Client [DEV] Stable Diffusion loaded successfully.")
    return _sd_pipeline


def _sd_generate(prompt_text: str, output_path: Optional[str] = None) -> Optional[Image.Image]:
    """Generate an image using Stable Diffusion (dev)."""
    pipe = _get_sd_pipeline()
    full_prompt = (
        f"simple flat illustration of {prompt_text}, "
        "minimal design, clean white background, "
        "educational graphic, vector style, no text"
    )
    try:
        image: Image.Image = pipe(
            prompt=full_prompt,
            num_inference_steps=50,
            guidance_scale=1.5,
            height=512,
            width=512,
        ).images[0]
        if output_path:
            image.save(output_path)
        return image
    except Exception:
        logger.exception("AI Client [DEV] Stable Diffusion image generation failed")
        return None


# ── Gemini Imagen helper ──────────────────────────────────────────────────────

def _gemini_generate_image(prompt_text: str, output_path: Optional[str] = None) -> Optional[Image.Image]:
    """Generate an image using Gemini Imagen API (production)."""
    try:
        from google import genai as google_genai
        from google.genai import types as genai_types
    except ImportError as exc:
        raise RuntimeError(
            "google-genai is not installed. "
            "Run: pip install google-genai"
        ) from exc

    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    image_model = getattr(settings, 'GEMINI_IMAGE_MODEL', 'imagen-3.0-generate-002')

    client = google_genai.Client(api_key=api_key)
    logger.info("AI Client [PROD] → Gemini Imagen model=%s", image_model)

    try:
        response = client.models.generate_images(
            model=image_model,
            prompt=(
                f"simple flat illustration of {prompt_text}, "
                "minimal design, clean white background, "
                "educational graphic, vector style, no text"
            ),
            config=genai_types.GenerateImagesConfig(number_of_images=1),
        )
        img_data = response.generated_images[0].image.image_bytes
        image = Image.open(io.BytesIO(img_data))
        if output_path:
            image.save(output_path)
        logger.info("AI Client [PROD] ← Gemini Imagen success")
        return image
    except Exception:
        logger.exception("AI Client [PROD] Gemini Imagen image generation failed")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_text(
    prompt: str,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """
    Generate text using the configured AI backend.

    Args:
        prompt:        User-facing prompt.
        system_prompt: Optional system-level instruction.
        json_mode:     If True, instruct the model to return valid JSON.

    Returns:
        The model's response as a string.
    """
    if _use_gemini_text():
        return _gemini_generate(prompt, system_prompt=system_prompt, json_mode=json_mode)
    return _ollama_generate(prompt, system_prompt=system_prompt, json_mode=json_mode)


def generate_image(prompt_text: str, output_path: Optional[str] = None) -> Optional[Image.Image]:
    """
    Generate an image using the configured AI backend.

    Args:
        prompt_text: Description of the desired image.
        output_path: Optional file path to save the image (PNG/JPEG).

    Returns:
        PIL.Image object, or None on failure.
    """
    if _use_gemini_image():
        return _gemini_generate_image(prompt_text, output_path=output_path)
    return _sd_generate(prompt_text, output_path=output_path)


def get_langchain_llm(temperature: float = 0.7):
    """
    Return a LangChain-compatible chat model for the current environment.

    Production → ChatGoogleGenerativeAI (Gemini)
    Development → ChatOllama

    Args:
        temperature: Sampling temperature (0.0 – 1.0).

    Returns:
        A LangChain BaseChatModel instance.
    """
    if _use_gemini_text():
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:
            raise RuntimeError(
                "langchain-google-genai is not installed. "
                "Run: pip install langchain-google-genai"
            ) from exc

        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
        logger.info("AI Client [PROD] LangChain LLM → ChatGoogleGenerativeAI model=%s", model_name)
        callbacks = [_LC_CALLBACK] if _LC_CALLBACK else []
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=temperature,
            convert_system_message_to_human=True,
            callbacks=callbacks,
        )
    else:
        from langchain_ollama import ChatOllama
        model_name = getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
        logger.info("AI Client [DEV] LangChain LLM → ChatOllama model=%s", model_name)
        callbacks = [_LC_CALLBACK] if _LC_CALLBACK else []
        return ChatOllama(
            model=model_name,
            temperature=temperature,
            callbacks=callbacks,
        )
