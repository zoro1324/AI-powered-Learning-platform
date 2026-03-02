"""
Unified AI Client
=================
This module is the single source of truth for all AI calls in the server.

IS_PRODUCTION=False  → OLLAMA (text/chat)  + Stable Diffusion (images)
IS_PRODUCTION=True   → Featherless API via LangChain (text/chat)

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

import logging
from typing import Optional

import requests
from django.conf import settings
from langchain_core.messages import HumanMessage, SystemMessage
from PIL import Image

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _use_featherless_text() -> bool:
    """Return True when text / chat generation should use Featherless."""
    return getattr(settings, 'USE_FEATHERLESS_TEXT', getattr(settings, 'IS_PRODUCTION', False))


def _use_featherless_image() -> bool:
    """Return True when image generation should use Featherless backend."""
    return getattr(settings, 'USE_FEATHERLESS_IMAGE', getattr(settings, 'IS_PRODUCTION', False))


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
    content = response.json().get('message', {}).get('content', '')
    logger.info("AI Client [DEV] ← Ollama response length=%d", len(content))
    return content


# ── Featherless text helper ───────────────────────────────────────────────────

def _featherless_generate(prompt: str, system_prompt: Optional[str] = None, json_mode: bool = False) -> str:
    """Send a chat request to the Featherless API via LangChain."""
    llm = get_langchain_llm(temperature=0.7)

    if json_mode:
        llm = llm.bind(response_format={"type": "json_object"})

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))

    final_prompt = prompt
    if json_mode:
        final_prompt = (
            f"{prompt}\n\n"
            "Return only valid JSON. Do not add markdown, commentary, or code fences."
        )
    messages.append(HumanMessage(content=final_prompt))

    model_name = getattr(settings, 'FEATHERLESS_MODEL', 'openai/gpt-oss-120b')
    logger.info("AI Client [PROD] → Featherless model=%s json_mode=%s", model_name, json_mode)
    response = llm.invoke(messages)
    content = (response.content or '') if hasattr(response, 'content') else str(response)
    if isinstance(content, list):
        content = ''.join(
            chunk.get('text', '') if isinstance(chunk, dict) else str(chunk)
            for chunk in content
        )
    logger.info("AI Client [PROD] ← Featherless response length=%d", len(content))
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


# ── Featherless image helper ──────────────────────────────────────────────────

def _featherless_generate_image(prompt_text: str, output_path: Optional[str] = None) -> Optional[Image.Image]:
    """
    Generate an image for production mode.

    Featherless is currently wired for text inference in this project,
    so image generation falls back to Stable Diffusion.
    """
    logger.info("AI Client [PROD] Featherless image route → Stable Diffusion fallback")
    return _sd_generate(prompt_text, output_path=output_path)


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
    if _use_featherless_text():
        return _featherless_generate(prompt, system_prompt=system_prompt, json_mode=json_mode)
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
    if _use_featherless_image():
        return _featherless_generate_image(prompt_text, output_path=output_path)
    return _sd_generate(prompt_text, output_path=output_path)


def get_langchain_llm(temperature: float = 0.7):
    """
    Return a LangChain-compatible chat model for the current environment.

    Production → ChatOpenAI (Featherless base URL)
    Development → ChatOllama

    Args:
        temperature: Sampling temperature (0.0 – 1.0).

    Returns:
        A LangChain BaseChatModel instance.
    """
    if _use_featherless_text():
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise RuntimeError(
                "langchain-openai is not installed. "
                "Run: pip install langchain-openai"
            ) from exc

        api_key = getattr(settings, 'FEATHERLESS_API_KEY', '')
        if not api_key:
            raise RuntimeError("FEATHERLESS_API_KEY is not set. Add it to your .env file.")

        model_name = getattr(settings, 'FEATHERLESS_MODEL', 'openai/gpt-oss-120b')
        base_url = getattr(settings, 'FEATHERLESS_BASE_URL', 'https://api.featherless.ai/v1')

        logger.info("AI Client [PROD] LangChain LLM → ChatOpenAI(Featherless) model=%s", model_name)
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
        )
    else:
        from langchain_ollama import ChatOllama
        model_name = getattr(settings, 'OLLAMA_MODEL', 'llama3:8b')
        logger.info("AI Client [DEV] LangChain LLM → ChatOllama model=%s", model_name)
        return ChatOllama(model=model_name, temperature=temperature)
