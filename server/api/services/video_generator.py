import asyncio
import json
import logging
import os
import textwrap
import time

import requests
import torch
from django.conf import settings
from django.core.files import File
from django.utils import timezone
from moviepy import AudioFileClip, ImageClip, VideoFileClip, concatenate_videoclips
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stable Diffusion singleton — loaded once, reused across tasks
# ---------------------------------------------------------------------------
_sd_pipeline = None


def _get_sd_pipeline():
    """Lazily load and cache the Stable Diffusion pipeline."""
    global _sd_pipeline
    if _sd_pipeline is not None:
        return _sd_pipeline

    from diffusers import StableDiffusionPipeline
    from diffusers.schedulers import LCMScheduler

    model_id = "runwayml/stable-diffusion-v1-5"
    lora_id = "latent-consistency/lcm-lora-sdv1-5"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    logger.info("Loading Stable Diffusion on %s ...", device)

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

    _sd_pipeline = pipe
    logger.info("Stable Diffusion loaded successfully.")
    return _sd_pipeline


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class VideoGeneratorService:
    """Encapsulates the full video-generation pipeline."""

    def __init__(self, task_id: str):
        self.task_id = str(task_id)

        # Build per-task output directories under MEDIA_ROOT
        base = os.path.join(settings.MEDIA_ROOT, "videos", self.task_id)
        self.scene_dir = os.path.join(base, "scenes")
        self.audio_dir = os.path.join(base, "audio")
        self.video_dir = os.path.join(base, "video")
        self.scripts_dir = os.path.join(base, "scripts")

        for d in (self.scene_dir, self.audio_dir, self.video_dir, self.scripts_dir):
            os.makedirs(d, exist_ok=True)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _update_task(self, **fields):
        """Update the VideoTask record in-place."""
        from api.models import VideoTask
        VideoTask.objects.filter(pk=self.task_id).update(**fields)

    # ------------------------------------------------------------------
    # 1. Script generation (Ollama)
    # ------------------------------------------------------------------

    def generate_script(self, topic: str) -> dict | None:
        prompt = (
            "Convert this topic into a structured video plan.\n"
            f"Topic: {topic}\n"
            "Return JSON only:\n"
            '{\n'
            '  "scenes": [\n'
            '    {\n'
            '      "title": "",\n'
            '      "bullets": [],\n'
            '      "narration": "",\n'
            '      "image_prompt": "visual description for illustration"\n'
            '    }\n'
            '  ]\n'
            '}\n'
        )

        try:
            response = requests.post(
                settings.OLLAMA_API_URL,
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                },
                timeout=300,
            )
            response.raise_for_status()
            script_data = json.loads(response.json()["response"])

            # Persist script to disk
            script_path = os.path.join(self.scripts_dir, "script.json")
            with open(script_path, "w") as f:
                json.dump(script_data, f, indent=2)

            return script_data

        except requests.exceptions.RequestException:
            logger.exception("Ollama connection error")
            return None
        except (json.JSONDecodeError, KeyError):
            logger.exception("Invalid JSON from Ollama")
            return None

    # ------------------------------------------------------------------
    # 2. Image generation (Stable Diffusion)
    # ------------------------------------------------------------------

    def generate_image(self, prompt_text: str, output_path: str) -> str | None:
        pipe = _get_sd_pipeline()
        full_prompt = (
            f"simple flat illustration of {prompt_text}, "
            "minimal design, clean white background, "
            "educational graphic, vector style, no text"
        )
        try:
            image = pipe(
                prompt=full_prompt,
                num_inference_steps=6,
                guidance_scale=1.5,
                height=512,
                width=512,
            ).images[0]
            image.save(output_path)
            return output_path
        except Exception:
            logger.exception("Image generation failed")
            return None

    # ------------------------------------------------------------------
    # 3. Slide creation (PIL)
    # ------------------------------------------------------------------

    def create_slide(self, scene: dict, index: int, image_path: str | None = None) -> str:
        width, height = 1280, 720
        img = Image.new("RGB", (width, height), color="white")
        draw = ImageDraw.Draw(img)

        try:
            title_font = ImageFont.truetype("arial.ttf", 60)
            text_font = ImageFont.truetype("arial.ttf", 35)
        except OSError:
            title_font = ImageFont.load_default()
            text_font = ImageFont.load_default()

        margin = 50
        content_width = width - (2 * margin)

        if image_path and os.path.exists(image_path):
            try:
                sd_img = Image.open(image_path)
                target_ih = 600
                aspect = sd_img.width / sd_img.height
                target_iw = int(target_ih * aspect)
                sd_img = sd_img.resize((target_iw, target_ih), Image.Resampling.LANCZOS)
                img_x = 640 + (640 - target_iw) // 2
                img_y = (720 - target_ih) // 2
                img.paste(sd_img, (img_x, img_y))
                content_width = 580
            except Exception:
                logger.exception("Error placing image on slide")

        # Title
        title_text = scene.get("title", f"Scene {index}")
        title_lines = textwrap.wrap(title_text, width=20 if content_width < 600 else 40)
        ty = 50
        for line in title_lines:
            draw.text((margin, ty), line, fill="black", font=title_font)
            ty += 70

        # Bullets
        y = ty + 30
        for bullet in scene.get("bullets", []):
            lines = textwrap.wrap(bullet, width=30 if content_width < 600 else 50)
            for line in lines:
                draw.text((margin + 30, y), f"• {line}", fill="black", font=text_font)
                y += 45

        filename = os.path.join(self.scene_dir, f"scene_{index}.png")
        img.save(filename)
        return filename

    # ------------------------------------------------------------------
    # 4. Audio (Edge-TTS)
    # ------------------------------------------------------------------

    async def _generate_audio_async(self, text: str, index: int) -> str | None:
        import edge_tts

        voice = "en-US-ChristopherNeural"
        output_file = os.path.join(self.audio_dir, f"scene_{index}.mp3")
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_file)
            return output_file
        except Exception:
            logger.exception("Audio generation failed for scene %d", index)
            return None

    def generate_audio(self, text: str, index: int) -> str | None:
        """Synchronous wrapper around the async TTS call."""
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(self._generate_audio_async(text, index))
        finally:
            loop.close()

    # ------------------------------------------------------------------
    # 5. Video clip assembly (MoviePy)
    # ------------------------------------------------------------------

    def create_video_clip(self, image_path: str, audio_path: str, index: int) -> str | None:
        output_path = os.path.join(self.video_dir, f"scene_{index}.mp4")
        try:
            audio_clip = AudioFileClip(audio_path)
            video_clip = (
                ImageClip(image_path)
                .with_duration(audio_clip.duration)
                .with_fps(24)
                .with_audio(audio_clip)
            )
            video_clip.write_videofile(
                output_path,
                fps=24,
                codec="libx264",
                audio_codec="aac",
                audio_bitrate="192k",
                preset="medium",
                threads=4,
                logger=None,
            )
            video_clip.close()
            audio_clip.close()
            time.sleep(0.5)
            return output_path
        except Exception:
            logger.exception("Video clip creation failed for scene %d", index)
            return None

    # ------------------------------------------------------------------
    # 6. Merge scenes
    # ------------------------------------------------------------------

    def merge_scenes(self, video_files: list[str]) -> str | None:
        output_path = os.path.join(self.video_dir, "final_video.mp4")
        try:
            clips = [VideoFileClip(f) for f in video_files]
            final_clip = concatenate_videoclips(clips)
            final_clip.write_videofile(
                output_path,
                fps=24,
                codec="libx264",
                audio_codec="aac",
                audio_bitrate="192k",
                preset="medium",
                threads=4,
                logger=None,
            )
            final_clip.close()
            for clip in clips:
                clip.close()
            return output_path
        except Exception:
            logger.exception("Scene merging failed")
            return None

    # ------------------------------------------------------------------
    # 7. Full pipeline
    # ------------------------------------------------------------------

    def run(self, topic: str) -> str:
        """
        Execute the full pipeline. Returns the path to the final video file.
        Raises RuntimeError on failure.
        """
        # --- Script ---
        self._update_task(
            status="processing",
            progress_message="Generating script...",
        )
        script_data = self.generate_script(topic)
        if not script_data:
            raise RuntimeError("Failed to generate script from Ollama.")

        scenes = script_data.get("scenes", [])
        if not scenes:
            raise RuntimeError("Script contains no scenes.")

        self._update_task(
            script_data=script_data,
            progress_message=f"Script ready — {len(scenes)} scenes. Generating scenes...",
        )

        # --- Scenes ---
        video_clips: list[str] = []
        for i, scene in enumerate(scenes, 1):
            self._update_task(
                progress_message=f"Processing scene {i}/{len(scenes)}: {scene.get('title', '')}",
            )

            # Image
            generated_img_path = None
            image_prompt = scene.get("image_prompt")
            if image_prompt:
                raw_path = os.path.join(self.scene_dir, f"scene_{i}_raw.png")
                generated_img_path = self.generate_image(image_prompt, raw_path)

            # Slide
            slide_path = self.create_slide(scene, i, image_path=generated_img_path)

            # Audio
            narration = scene.get("narration", "")
            if not narration:
                continue
            audio_path = self.generate_audio(narration, i)
            if not audio_path:
                continue

            # Clip
            clip_path = self.create_video_clip(slide_path, audio_path, i)
            if clip_path:
                video_clips.append(clip_path)

        if not video_clips:
            raise RuntimeError("No video clips were created.")

        # --- Merge ---
        self._update_task(progress_message="Merging scenes into final video...")
        final_path = self.merge_scenes(video_clips)
        if not final_path:
            raise RuntimeError("Failed to merge scenes into final video.")

        return final_path
