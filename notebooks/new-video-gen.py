"""
3-Stage Video Generation Pipeline
==================================
Stage 1 — Video Blueprint Generator  (LLM → structured JSON)
Stage 2 — Template Engine             (Hardcoded premium HTML templates)
Stage 3 — Slide Render Engine          (Backend: SD + Playwright + TTS + FFmpeg)

Usage:
    python new-video-gen.py                          # Full pipeline with default topic
    python new-video-gen.py --preview                # Preview a single slide (no video)
    python new-video-gen.py --topic "..." --description "..."
"""

import argparse
import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "llama3:8b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "600"))

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "output_new"))
SLIDES_DIR = os.path.join(OUTPUT_DIR, "slides")

SLIDE_W, SLIDE_H = 1920, 1080

TTS_VOICE = "en-US-ChristopherNeural"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("video-gen")


# ─────────────────────────────────────────────────────────────────────────────
# LLM Helper
# ─────────────────────────────────────────────────────────────────────────────

def llm_call(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """Send a chat request to the local Ollama server."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]

    payload: dict = {
        "model":    OLLAMA_MODEL,
        "messages": messages,
        "stream":   False,
    }
    if json_mode:
        payload["format"] = "json"

    log.info("  📡 LLM call → %s (json_mode=%s)", OLLAMA_MODEL, json_mode)

    resp = requests.post(
        OLLAMA_API_URL,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=OLLAMA_TIMEOUT,
    )
    resp.raise_for_status()
    content = resp.json().get("message", {}).get("content", "")
    log.info("  📡 LLM response: %d chars", len(content))
    return content


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — VIDEO BLUEPRINT GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

BLUEPRINT_SYSTEM_PROMPT = """\
You are an expert AI educational video architect.

Your task is to design a structured video plan for a high-quality 1080p educational video.

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown. No commentary. No code fences.
2. The "theme" field must be exactly ONE of: "modern_dark", "light_minimal", or "gradient_academic"
3. EVERY slide MUST have a non-empty "title" field
4. EVERY slide MUST have a non-empty "narration" field (2-4 conversational sentences)
5. EVERY slide MUST have a non-empty "image_prompt" field
6. EVERY slide MUST have at least 2 bullet points in "sub_points"
7. Generate exactly 6 to 10 slides"""

BLUEPRINT_USER_TEMPLATE = """\
Design a video blueprint for the following educational topic.

Output this exact JSON structure:

{{
  "theme": "modern_dark",
  "video_style": "cinematic",
  "slides": [
    {{
      "layout": "title_bullets",
      "title": "Slide Title Here",
      "sub_points": ["Bullet point one", "Bullet point two", "Bullet point three"],
      "image_prompt": "A clean minimal illustration showing...",
      "narration": "Welcome to this lesson. Today we will explore..."
    }}
  ]
}}

REQUIREMENTS:
- theme must be exactly one of: "modern_dark", "light_minimal", "gradient_academic"
- Generate 6-10 slides total
- First slide should be an introduction/title slide
- Last slide should be a summary/conclusion
- Each sub_point must be under 12 words
- Maximum 5 sub_points per slide
- narration must be 2-4 detailed, conversational sentences
- image_prompt must describe a clean, educational illustration
- Every single field must be filled — no empty strings allowed

Topic: {topic}

Description: {description}"""


def stage1_generate_blueprint(topic: str, description: str, max_retries: int = 3) -> dict:
    """
    STAGE 1: Call LLM to produce a structured video blueprint (JSON).
    """
    print("\n" + "═" * 70)
    print("  🧠 STAGE 1 — VIDEO BLUEPRINT GENERATOR")
    print("═" * 70)
    print(f"  Topic:       {topic}")
    print(f"  Description: {description}")

    user_prompt = BLUEPRINT_USER_TEMPLATE.format(topic=topic, description=description)

    for attempt in range(1, max_retries + 1):
        try:
            log.info("  Attempt %d/%d ...", attempt, max_retries)
            raw = llm_call(BLUEPRINT_SYSTEM_PROMPT, user_prompt, json_mode=True)
            blueprint = json.loads(raw)

            # ── Validate & fix theme ──────────────────────────────────
            theme = blueprint.get("theme", "modern_dark")
            valid_themes = ["modern_dark", "light_minimal", "gradient_academic"]
            if theme not in valid_themes:
                # LLM sometimes outputs "light_minimal | gradient_academic"
                for vt in valid_themes:
                    if vt in theme:
                        theme = vt
                        break
                else:
                    theme = "modern_dark"
            blueprint["theme"] = theme

            if "video_style" not in blueprint:
                blueprint["video_style"] = "cinematic"

            # ── Validate slides ───────────────────────────────────────
            assert "slides" in blueprint, "Missing 'slides'"
            slides = blueprint["slides"]
            assert isinstance(slides, list) and len(slides) >= 1, "No slides"

            # Filter out slides with no narration
            valid_slides = []
            for i, s in enumerate(slides):
                # Fill missing fields with defaults
                if not s.get("title"):
                    s["title"] = f"Slide {i + 1}"
                if not s.get("sub_points"):
                    s["sub_points"] = []
                if not s.get("layout"):
                    s["layout"] = "title_bullets"
                if not s.get("image_prompt"):
                    s["image_prompt"] = f"Educational illustration about {topic}"
                if not s.get("narration"):
                    log.warning("  ⚠️  Slide '%s' has no narration — skipping", s["title"])
                    continue
                valid_slides.append(s)

            if not valid_slides:
                raise AssertionError("No slides have narration")

            blueprint["slides"] = valid_slides
            print(f"\n  ✅ Blueprint: {len(valid_slides)} slides, theme='{blueprint['theme']}'")
            return blueprint

        except (json.JSONDecodeError, AssertionError, KeyError) as e:
            log.warning("  ⚠️  Attempt %d failed: %s", attempt, e)
            if attempt == max_retries:
                raise RuntimeError(f"Stage 1 failed after {max_retries} attempts: {e}") from e

    raise RuntimeError("Stage 1 failed")


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — TEMPLATE ENGINE (Hardcoded Premium Templates)
# ═══════════════════════════════════════════════════════════════════════════════

def stage2_get_template(theme: str) -> str:
    """
    STAGE 2: Return a high-quality hardcoded HTML slide template.

    Using hardcoded templates instead of LLM-generated ones ensures:
    - Pixel-perfect, consistent rendering every time
    - No LLM commentary or garbage leaking into the template
    - Professional design quality guaranteed
    """
    print("\n" + "═" * 70)
    print("  🎨 STAGE 2 — TEMPLATE ENGINE")
    print("═" * 70)
    print(f"  Theme: {theme}")

    templates = {
        "modern_dark": _template_modern_dark(),
        "light_minimal": _template_light_minimal(),
        "gradient_academic": _template_gradient_academic(),
    }

    html = templates.get(theme, templates["modern_dark"])
    print(f"  ✅ Template loaded: {len(html)} chars")
    return html


def _template_modern_dark() -> str:
    return """\
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;width:1920px;height:1080px;
             background:linear-gradient(160deg, #0d1117 0%, #161b22 40%, #1a1a2e 100%);
             font-family:'Segoe UI',Helvetica,Arial,sans-serif;overflow:hidden;">

  <div style="display:flex;width:1920px;height:1080px;box-sizing:border-box;padding:70px 80px;">

    <!-- Left Column: Text (58%) -->
    <div style="flex:0 0 58%;display:flex;flex-direction:column;justify-content:center;
                padding-right:60px;overflow:hidden;">

      <!-- Accent bar + Title -->
      <div style="border-left:6px solid #58a6ff;padding-left:28px;margin-bottom:48px;">
        <div style="font-size:52px;font-weight:800;color:#ffffff;line-height:1.25;
                    letter-spacing:-0.5px;word-wrap:break-word;">
          {{TITLE}}
        </div>
      </div>

      <!-- Bullet Points -->
      <div style="padding-left:34px;">
        {{CONTENT}}
      </div>
    </div>

    <!-- Right Column: Image (42%) -->
    <div style="flex:0 0 42%;display:flex;align-items:center;justify-content:center;
                background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.15);
                border-radius:24px;overflow:hidden;padding:30px;">
      {{IMAGE}}
    </div>

  </div>

  <!-- Bottom accent line -->
  <div style="position:absolute;bottom:0;left:0;width:100%;height:4px;
              background:linear-gradient(90deg,#58a6ff 0%,#a371f7 50%,#f778ba 100%);"></div>

</body>
</html>"""


def _template_light_minimal() -> str:
    return """\
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;width:1920px;height:1080px;
             background:#fafbfc;
             font-family:'Segoe UI',Helvetica,Arial,sans-serif;overflow:hidden;">

  <div style="display:flex;width:1920px;height:1080px;box-sizing:border-box;padding:70px 80px;">

    <!-- Left Column: Text (58%) -->
    <div style="flex:0 0 58%;display:flex;flex-direction:column;justify-content:center;
                padding-right:60px;overflow:hidden;">

      <!-- Title -->
      <div style="border-left:6px solid #0969da;padding-left:28px;margin-bottom:48px;">
        <div style="font-size:52px;font-weight:800;color:#1a1a2e;line-height:1.25;
                    letter-spacing:-0.5px;word-wrap:break-word;">
          {{TITLE}}
        </div>
      </div>

      <!-- Bullets -->
      <div style="padding-left:34px;">
        {{CONTENT}}
      </div>
    </div>

    <!-- Right Column: Image (42%) -->
    <div style="flex:0 0 42%;display:flex;align-items:center;justify-content:center;
                background:#f0f4f8;border:1px solid #d0d7de;
                border-radius:24px;overflow:hidden;padding:30px;">
      {{IMAGE}}
    </div>

  </div>

  <!-- Bottom accent -->
  <div style="position:absolute;bottom:0;left:0;width:100%;height:4px;
              background:linear-gradient(90deg,#0969da 0%,#1a7f37 50%,#8250df 100%);"></div>

</body>
</html>"""


def _template_gradient_academic() -> str:
    return """\
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;width:1920px;height:1080px;
             background:linear-gradient(135deg, #1a1a3e 0%, #2d1b4e 40%, #0f0c29 100%);
             font-family:'Segoe UI',Georgia,serif;overflow:hidden;">

  <div style="display:flex;width:1920px;height:1080px;box-sizing:border-box;padding:70px 80px;">

    <!-- Left Column: Text (58%) -->
    <div style="flex:0 0 58%;display:flex;flex-direction:column;justify-content:center;
                padding-right:60px;overflow:hidden;">

      <!-- Title -->
      <div style="border-left:6px solid #d4a947;padding-left:28px;margin-bottom:48px;">
        <div style="font-size:52px;font-weight:800;color:#f5e6c8;line-height:1.25;
                    letter-spacing:-0.5px;word-wrap:break-word;">
          {{TITLE}}
        </div>
      </div>

      <!-- Bullets -->
      <div style="padding-left:34px;">
        {{CONTENT}}
      </div>
    </div>

    <!-- Right Column: Image (42%) -->
    <div style="flex:0 0 42%;display:flex;align-items:center;justify-content:center;
                background:rgba(212,169,71,0.06);border:1px solid rgba(212,169,71,0.2);
                border-radius:24px;overflow:hidden;padding:30px;">
      {{IMAGE}}
    </div>

  </div>

  <!-- Bottom accent -->
  <div style="position:absolute;bottom:0;left:0;width:100%;height:4px;
              background:linear-gradient(90deg,#d4a947 0%,#c0392b 50%,#8e44ad 100%);"></div>

</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3 — SLIDE RENDER ENGINE (Backend Controlled — No LLM)
# ═══════════════════════════════════════════════════════════════════════════════

# ── 3a. Image Generation (Stable Diffusion) ──────────────────────────────────

_sd_pipe = None


def _get_sd_pipeline():
    """Lazy-load Stable Diffusion pipeline with LCM LoRA."""
    global _sd_pipe
    if _sd_pipe is not None:
        return _sd_pipe

    import torch
    from diffusers import StableDiffusionPipeline, LCMScheduler

    model_id = "runwayml/stable-diffusion-v1-5"
    lora_id  = "latent-consistency/lcm-lora-sdv1-5"
    device   = "cuda" if torch.cuda.is_available() else "cpu"

    log.info("  Loading Stable Diffusion on %s ...", device)
    pipe = StableDiffusionPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        safety_checker=None,
    ).to(device)

    pipe.enable_attention_slicing()
    pipe.enable_vae_slicing()
    if device == "cuda":
        pipe.enable_model_cpu_offload()

    pipe.load_lora_weights(lora_id)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

    _sd_pipe = pipe
    log.info("  ✅ Stable Diffusion ready.")
    return _sd_pipe


def generate_image_sd(prompt_text: str, output_path: str) -> Optional[str]:
    """Generate a flat educational illustration via SD + LCM LoRA."""
    full_prompt = (
        f"simple flat illustration of {prompt_text}, "
        "minimal design, clean white background, "
        "educational graphic, vector style, no text"
    )
    try:
        pipe = _get_sd_pipeline()
        image = pipe(
            prompt=full_prompt,
            num_inference_steps=10,
            guidance_scale=1.5,
            height=512,
            width=512,
        ).images[0]
        image.save(output_path)
        return output_path
    except Exception as e:
        log.error("  ⚠️  SD error: %s", e)
        return None


# ── 3b. HTML Population ──────────────────────────────────────────────────────

def _get_bullet_style(theme: str) -> dict:
    """Return CSS styling per theme for bullet points."""
    styles = {
        "modern_dark": {
            "text_color": "#c9d1d9",
            "dot_color": "#58a6ff",
            "dot_bg": "rgba(88,166,255,0.15)",
        },
        "light_minimal": {
            "text_color": "#24292f",
            "dot_color": "#0969da",
            "dot_bg": "rgba(9,105,218,0.1)",
        },
        "gradient_academic": {
            "text_color": "#e8e0d0",
            "dot_color": "#d4a947",
            "dot_bg": "rgba(212,169,71,0.15)",
        },
    }
    return styles.get(theme, styles["modern_dark"])


def populate_template(template_html: str, slide: dict, image_path: Optional[str],
                      theme: str = "modern_dark") -> str:
    """Replace placeholders in the HTML template with actual slide data."""
    title = slide.get("title", "")

    # Build styled bullet points
    bullets = slide.get("sub_points", [])
    bs = _get_bullet_style(theme)

    if bullets:
        items = []
        for b in bullets:
            items.append(
                f'<div style="display:flex;align-items:flex-start;margin-bottom:20px;">'
                f'  <div style="flex:0 0 14px;width:14px;height:14px;border-radius:50%;'
                f'              background:{bs["dot_bg"]};border:3px solid {bs["dot_color"]};'
                f'              margin-top:8px;margin-right:18px;"></div>'
                f'  <div style="font-size:30px;color:{bs["text_color"]};line-height:1.6;'
                f'              word-wrap:break-word;">{b}</div>'
                f'</div>'
            )
        content_html = "".join(items)
    else:
        content_html = ""

    # Image tag
    if image_path and os.path.exists(image_path):
        abs_path = Path(image_path).resolve().as_uri()
        image_html = (
            f'<img src="{abs_path}" '
            f'style="max-width:100%;max-height:100%;border-radius:16px;'
            f'object-fit:contain;" />'
        )
    else:
        image_html = (
            '<div style="width:200px;height:200px;border-radius:50%;'
            'background:rgba(128,128,128,0.1);"></div>'
        )

    html = template_html
    html = html.replace("{{TITLE}}", title)
    html = html.replace("{{CONTENT}}", content_html)
    html = html.replace("{{IMAGE}}", image_html)

    return html


# ── 3c. Playwright Screenshot ────────────────────────────────────────────────

def screenshot_html(html_content: str, output_png: str) -> str:
    """Render HTML at 1920×1080 using Playwright and save as PNG."""
    try:
        from playwright.sync_api import sync_playwright

        html_file = output_png.replace(".png", ".html")
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(html_content)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": SLIDE_W, "height": SLIDE_H})
            page.goto(f"file:///{Path(html_file).resolve().as_posix()}")
            page.wait_for_timeout(800)
            page.screenshot(path=output_png, full_page=False)
            browser.close()

        log.info("    📸 Screenshot → %s", os.path.basename(output_png))
        return output_png

    except ImportError:
        log.warning("    ⚠️  Playwright not available — using PIL fallback")
        return _pil_fallback_slide(output_png)
    except Exception as e:
        log.error("    ❌ Playwright error: %s — using PIL fallback", e)
        return _pil_fallback_slide(output_png)


def _pil_fallback_slide(output_png: str) -> str:
    """Minimal PIL fallback."""
    from PIL import Image
    img = Image.new("RGB", (SLIDE_W, SLIDE_H), color="#0d1117")
    img.save(output_png)
    return output_png


# ── 3d. TTS Audio (Edge-TTS) ─────────────────────────────────────────────────

async def _generate_tts(text: str, output_mp3: str) -> Optional[str]:
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        await communicate.save(output_mp3)
        if os.path.exists(output_mp3) and os.path.getsize(output_mp3) > 0:
            return output_mp3
        return None
    except Exception as e:
        log.error("    ❌ TTS error: %s", e)
        return None


def generate_tts_sync(text: str, output_mp3: str) -> Optional[str]:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_generate_tts(text, output_mp3))
    finally:
        loop.close()


# ── 3e. FFmpeg ───────────────────────────────────────────────────────────────

def get_audio_duration(audio_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        audio_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(result.stdout.strip())
    except Exception:
        return 10.0


def render_slide_video(slide_png: str, audio_mp3: str, output_mp4: str) -> Optional[str]:
    """Combine slide PNG + audio MP3 → MP4 clip via FFmpeg."""
    duration = get_audio_duration(audio_mp3)
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", slide_png,
        "-i", audio_mp3,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-t", str(duration),
        "-shortest",
        "-vf", f"scale={SLIDE_W}:{SLIDE_H}:force_original_aspect_ratio=decrease,"
               f"pad={SLIDE_W}:{SLIDE_H}:(ow-iw)/2:(oh-ih)/2",
        output_mp4,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        log.error("    ❌ FFmpeg error:\n%s", result.stderr[-500:])
        return None
    return output_mp4


def ffmpeg_concat(clip_paths: list[str], output_path: str) -> Optional[str]:
    """Merge slide clips via FFmpeg concat."""
    if not clip_paths:
        return None

    list_file = output_path.replace(".mp4", "_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in clip_paths:
            abs_p = os.path.abspath(p).replace("\\", "/")
            f.write(f"file '{abs_p}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_file,
        "-c", "copy",
        output_path,
    ]

    log.info("  🔗 Merging %d clips → %s", len(clip_paths), os.path.basename(output_path))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        log.error("  ❌ FFmpeg merge error:\n%s", result.stderr[-500:])
        return None
    return output_path


# ═══════════════════════════════════════════════════════════════════════════════
# PREVIEW MODE — Generate a single slide PNG for quality check
# ═══════════════════════════════════════════════════════════════════════════════

def preview_slide(topic: str = "Machine Learning and Its Types",
                  description: str = "An overview of machine learning types",
                  theme: str = None,
                  slide_index: int = 0) -> str:
    """
    Generate a single slide PNG for quality preview.

    Steps:
    1. Run Stage 1 (blueprint) to get slide data
    2. Run Stage 2 (template) to get HTML
    3. Generate one SD image
    4. Populate template + screenshot → preview.png

    Returns: path to the preview PNG
    """
    print("\n" + "█" * 70)
    print("  👁️  PREVIEW MODE — Single Slide Quality Check")
    print("█" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    preview_dir = os.path.join(OUTPUT_DIR, "preview")
    os.makedirs(preview_dir, exist_ok=True)

    # Stage 1: Blueprint
    blueprint = stage1_generate_blueprint(topic, description)

    # Save blueprint
    bp_path = os.path.join(OUTPUT_DIR, "blueprint.json")
    with open(bp_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)
    print(f"  📄 Blueprint saved → {bp_path}")

    # Stage 2: Template
    selected_theme = theme or blueprint.get("theme", "modern_dark")
    template_html = stage2_get_template(selected_theme)

    # Save template
    tmpl_path = os.path.join(OUTPUT_DIR, "template.html")
    with open(tmpl_path, "w", encoding="utf-8") as f:
        f.write(template_html)

    # Pick slide for preview
    slides = blueprint["slides"]
    idx = min(slide_index, len(slides) - 1)
    slide = slides[idx]

    print(f"\n  📋 Previewing slide {idx + 1}/{len(slides)}: \"{slide['title']}\"")
    print(f"     Bullets: {slide.get('sub_points', [])}")
    print(f"     Image:   {slide.get('image_prompt', '')[:60]}...")

    # Generate image
    image_path = None
    img_prompt = slide.get("image_prompt", "").strip()
    if img_prompt:
        img_out = os.path.join(preview_dir, "preview_image.png")
        print(f"\n  🎨 Generating SD image...")
        image_path = generate_image_sd(img_prompt, img_out)
        if image_path:
            print(f"  ✅ Image saved → {img_out}")

    # Populate template
    populated = populate_template(template_html, slide, image_path, theme=selected_theme)
    html_out = os.path.join(preview_dir, "preview_slide.html")
    with open(html_out, "w", encoding="utf-8") as f:
        f.write(populated)
    print(f"  📄 HTML saved → {html_out}")

    # Screenshot
    png_out = os.path.join(preview_dir, "preview_slide.png")
    screenshot_html(populated, png_out)

    print(f"\n  ✅ PREVIEW READY!")
    print(f"     📸 PNG:  {png_out}")
    print(f"     🌐 HTML: {html_out}")
    print(f"\n  Open the PNG to check quality. If approved, run without --preview for full video.")
    print("█" * 70 + "\n")

    return png_out


# ═══════════════════════════════════════════════════════════════════════════════
# FULL PIPELINE — STAGE 3 ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def stage3_render(blueprint: dict, template_html: str) -> Optional[str]:
    """STAGE 3: Render all slides → merge into final video."""
    print("\n" + "═" * 70)
    print("  🎥 STAGE 3 — SLIDE RENDER ENGINE")
    print("═" * 70)

    slides = blueprint["slides"]
    theme = blueprint.get("theme", "modern_dark")
    slide_clips: list[str] = []

    for i, slide in enumerate(slides, start=1):
        slide_title = slide.get("title", f"Slide {i}")
        slide_dir = os.path.join(SLIDES_DIR, f"slide_{i:02d}")
        os.makedirs(slide_dir, exist_ok=True)

        print(f"\n  ── Slide {i}/{len(slides)}: {slide_title} ──")

        # 3a: Image
        image_path = None
        image_prompt = slide.get("image_prompt", "").strip()
        if image_prompt:
            img_out = os.path.join(slide_dir, "image.png")
            print(f"    🎨 Generating image: {image_prompt[:60]}...")
            image_path = generate_image_sd(image_prompt, img_out)
            if image_path:
                print(f"    ✅ Image saved")
            else:
                print(f"    ⚠️  Image failed — continuing without")

        # 3b: Populate HTML
        populated_html = populate_template(template_html, slide, image_path, theme=theme)
        html_path = os.path.join(slide_dir, "slide.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(populated_html)

        # 3c: Screenshot
        slide_png = os.path.join(slide_dir, "slide.png")
        screenshot_html(populated_html, slide_png)

        # 3d: TTS
        narration = slide.get("narration", "").strip()
        if not narration:
            log.warning("    ⚠️  Slide %d has no narration — skipping", i)
            continue

        audio_mp3 = os.path.join(slide_dir, "narration.mp3")
        print(f"    🔊 Generating TTS audio...")
        audio_result = generate_tts_sync(narration, audio_mp3)
        if not audio_result:
            log.error("    ❌ TTS failed for slide %d", i)
            continue

        duration = get_audio_duration(audio_mp3)
        print(f"    ✅ Audio: {duration:.1f}s")

        # 3e: Render clip
        slide_mp4 = os.path.join(slide_dir, "slide.mp4")
        print(f"    🎬 Rendering clip...")
        clip = render_slide_video(slide_png, audio_mp3, slide_mp4)
        if clip:
            slide_clips.append(clip)
            print(f"    ✅ Clip ready")
        else:
            log.error("    ❌ Clip failed for slide %d", i)

    # Final merge
    if not slide_clips:
        log.error("  ❌ No clips created!")
        return None

    print(f"\n  🎞️  Merging {len(slide_clips)} clips...")
    final_path = os.path.join(OUTPUT_DIR, "final_video.mp4")
    result = ffmpeg_concat(slide_clips, final_path)

    if result:
        size_mb = os.path.getsize(result) / (1024 * 1024)
        print(f"  ✅ Final video: {result} ({size_mb:.1f} MB)")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main(topic: str, description: str):
    """Run the full 3-stage video generation pipeline."""
    start = time.time()

    print("\n" + "█" * 70)
    print("  🚀 3-STAGE VIDEO GENERATION PIPELINE")
    print("█" * 70)
    print(f"  Topic:       {topic}")
    print(f"  Description: {description}")
    print(f"  Output:      {OUTPUT_DIR}")
    print(f"  Resolution:  {SLIDE_W}×{SLIDE_H}")

    os.makedirs(SLIDES_DIR, exist_ok=True)

    # Stage 1
    blueprint = stage1_generate_blueprint(topic, description)
    bp_path = os.path.join(OUTPUT_DIR, "blueprint.json")
    with open(bp_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)
    print(f"  📄 Blueprint → {bp_path}")

    # Stage 2
    theme = blueprint.get("theme", "modern_dark")
    template_html = stage2_get_template(theme)
    tmpl_path = os.path.join(OUTPUT_DIR, "template.html")
    with open(tmpl_path, "w", encoding="utf-8") as f:
        f.write(template_html)
    print(f"  📄 Template  → {tmpl_path}")

    # Stage 3
    final_video = stage3_render(blueprint, template_html)

    elapsed = time.time() - start
    mins, secs = divmod(int(elapsed), 60)

    print("\n" + "█" * 70)
    if final_video:
        print(f"  🎉 DONE! {mins}m {secs}s")
        print(f"  📹 {final_video}")
    else:
        print(f"  ❌ Failed after {mins}m {secs}s")
    print("█" * 70 + "\n")

    return final_video


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="3-Stage Video Generation Pipeline")
    parser.add_argument("--topic", type=str,
                        default="Machine Learning and Its Types",
                        help="Video topic")
    parser.add_argument("--description", type=str,
                        default="An educational overview of machine learning, covering supervised, "
                                "unsupervised, and reinforcement learning with real-world examples.",
                        help="Topic description")
    parser.add_argument("--preview", action="store_true",
                        help="Preview a single slide (no video generation)")
    parser.add_argument("--preview-slide", type=int, default=1,
                        help="Which slide to preview (1-indexed, default=1)")
    parser.add_argument("--theme", type=str, default=None,
                        choices=["modern_dark", "light_minimal", "gradient_academic"],
                        help="Override theme (default: auto from blueprint)")
    parser.add_argument("--ollama-url", type=str, default=None)
    parser.add_argument("--ollama-model", type=str, default=None)

    args = parser.parse_args()

    if args.ollama_url:
        OLLAMA_API_URL = args.ollama_url
    if args.ollama_model:
        OLLAMA_MODEL = args.ollama_model

    if args.preview:
        preview_slide(
            topic=args.topic,
            description=args.description,
            theme=args.theme,
            slide_index=max(0, args.preview_slide - 1),
        )
    else:
        main(topic=args.topic, description=args.description)
