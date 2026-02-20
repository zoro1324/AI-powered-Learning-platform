import asyncio
import json
import logging
import os
import textwrap
import time

from django.conf import settings
from django.core.files import File
from django.utils import timezone
from moviepy import AudioFileClip, ImageClip, VideoFileClip, concatenate_videoclips
from PIL import Image, ImageDraw, ImageFont
from api.services.ai_client import generate_text, generate_image as ai_generate_image

logger = logging.getLogger(__name__)


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

    def generate_script(self, topic: str, content: str = None) -> dict | None:
        # Build content context if lesson content is available
        content_context = ""
        if content:
            max_len = 4000
            truncated = content[:max_len] + "..." if len(content) > max_len else content
            content_context = (
                f"\n\nUse the following lesson content as the PRIMARY basis for the video script. "
                f"The scenes should cover the key concepts from this content:\n\n{truncated}\n\n"
            )

        prompt = (
            f"Create an educational video script about: {topic}\n"
            f"{content_context}"
            "Requirements:\n"
            "- Create 3-5 scenes (slides)\n"
            "- Each scene MUST have a 'narration' field with spoken text (2-3 sentences)\n"
            "- Each scene should have 'title', 'bullets' (key points), and 'image_prompt'\n"
            "- Keep narration concise and educational\n"
            "- Base the scenes on the provided content if available\n\n"
            "Return ONLY valid JSON in this exact format:\n"
            '{\n'
            '  "scenes": [\n'
            '    {\n'
            '      "title": "Scene Title",\n'
            '      "bullets": ["Point 1", "Point 2", "Point 3"],\n'
            '      "narration": "This is the spoken narration for this scene.",\n'
            '      "image_prompt": "visual description for illustration"\n'
            '    }\n'
            '  ]\n'
            '}\n'
        )

        try:
            logger.info("Requesting script from AI backend...")
            response_text = generate_text(prompt, json_mode=True)
            script_data = json.loads(response_text)
            logger.info("✅ Received script from AI backend successfully")

            # Persist script to disk
            script_path = os.path.join(self.scripts_dir, "script.json")
            with open(script_path, "w") as f:
                json.dump(script_data, f, indent=2)

            return script_data

        except (json.JSONDecodeError, KeyError) as e:
            logger.exception("Invalid JSON from AI backend")
            logger.error(f"❌ AI backend returned invalid JSON: {e}")
            return None
        except Exception as e:
            logger.exception("AI backend connection error in generate_script")
            logger.error(f"❌ Failed to get script: {e}")
            return None

    # ------------------------------------------------------------------
    # 2. Image generation (Stable Diffusion)
    # ------------------------------------------------------------------

    def generate_image(self, prompt_text: str, output_path: str) -> str | None:
        """Generate an image using the configured AI backend (Stable Diffusion or Gemini)."""
        try:
            result = ai_generate_image(prompt_text, output_path=output_path)
            if result is not None:
                return output_path
            return None
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
        try:
            import edge_tts
        except ImportError as e:
            logger.error(f"❌ edge_tts not installed: {e}")
            logger.error("Install with: pip install edge-tts")
            return None

        voice = "en-US-ChristopherNeural"
        output_file = os.path.join(self.audio_dir, f"scene_{index}.mp3")
        
        try:
            logger.info(f"Starting Edge-TTS for scene {index}...")
            logger.info(f"  Voice: {voice}")
            logger.info(f"  Output: {output_file}")
            logger.info(f"  Text length: {len(text)} characters")
            
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_file)
            
            # Verify file was created
            if os.path.exists(output_file):
                file_size = os.path.getsize(output_file)
                logger.info(f"✅ Edge-TTS completed: {output_file} ({file_size} bytes)")
                if file_size == 0:
                    logger.error(f"❌ Audio file is empty!")
                    return None
            else:
                logger.error(f"❌ Audio file was not created!")
                return None
                
            return output_file
        except Exception as e:
            logger.exception(f"Audio generation failed for scene {index}: {str(e)}")
            return None

    def generate_audio(self, text: str, index: int) -> str | None:
        """Synchronous wrapper around the async TTS call."""
        logger.info(f"Generating audio for scene {index}...")
        logger.info(f"Narration text: {text[:100]}...")
        loop = asyncio.new_event_loop()
        try:
            audio_file = loop.run_until_complete(self._generate_audio_async(text, index))
            if audio_file and os.path.exists(audio_file):
                file_size = os.path.getsize(audio_file)
                logger.info(f"✅ Audio generated: {audio_file} ({file_size} bytes)")
            else:
                logger.error(f"❌ Audio file not created for scene {index}")
            return audio_file
        finally:
            loop.close()

    # ------------------------------------------------------------------
    # 5. Video clip assembly (MoviePy)
    # ------------------------------------------------------------------

    def create_video_clip(self, image_path: str, audio_path: str, index: int) -> str | None:
        output_path = os.path.join(self.video_dir, f"scene_{index}.mp4")
        try:
            logger.info(f"Creating video clip {index}...")
            logger.info(f"  Image: {image_path} (exists: {os.path.exists(image_path)})")
            logger.info(f"  Audio: {audio_path} (exists: {os.path.exists(audio_path)})")
            
            # Check if audio file exists and has content
            if not os.path.exists(audio_path):
                logger.error(f"❌ Audio file missing: {audio_path}")
                return None
            
            audio_size = os.path.getsize(audio_path)
            logger.info(f"  Audio file size: {audio_size} bytes")
            
            if audio_size == 0:
                logger.error(f"❌ Audio file is empty: {audio_path}")
                return None
            
            audio_clip = AudioFileClip(audio_path)
            logger.info(f"  Audio duration: {audio_clip.duration}s")
            
            # Create image clip with audio
            image_clip = ImageClip(image_path).with_duration(audio_clip.duration).with_fps(24)
            video_clip = image_clip.with_audio(audio_clip)
            
            logger.info(f"  Writing video file with audio...")
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
            
            # Verify output
            if os.path.exists(output_path):
                output_size = os.path.getsize(output_path)
                logger.info(f"✅ Video clip created: {output_path} ({output_size} bytes)")
            else:
                logger.error(f"❌ Video clip not created: {output_path}")
            
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
            logger.info(f"Merging {len(video_files)} video clips...")
            clips = []
            for f in video_files:
                logger.info(f"  Loading clip: {f}")
                clip = VideoFileClip(f)
                has_audio = clip.audio is not None
                logger.info(f"    Duration: {clip.duration}s, Has audio: {has_audio}")
                clips.append(clip)
            
            final_clip = concatenate_videoclips(clips, method="compose")
            logger.info(f"Final clip duration: {final_clip.duration}s, Has audio: {final_clip.audio is not None}")
            
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
            
            # Verify final output
            if os.path.exists(output_path):
                final_size = os.path.getsize(output_path)
                logger.info(f"✅ Final video created: {output_path} ({final_size} bytes)")
            
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

    def run(self, topic: str, content: str = None) -> str:
        """
        Execute the full pipeline. Returns the path to the final video file.
        Raises RuntimeError on failure.
        
        Args:
            topic: The topic name for the video
            content: Optional generated lesson content to base the video on
        """
        # --- Script ---
        self._update_task(
            status="processing",
            progress_message="Generating script...",
        )
        script_data = self.generate_script(topic, content=content)
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
        failed_scenes = []
        
        for i, scene in enumerate(scenes, 1):
            scene_title = scene.get('title', f'Scene {i}')
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing scene {i}/{len(scenes)}: {scene_title}")
            logger.info(f"{'='*60}")
            
            self._update_task(
                progress_message=f"Processing scene {i}/{len(scenes)}: {scene_title}",
            )

            # Image
            generated_img_path = None
            image_prompt = scene.get("image_prompt")
            if image_prompt:
                logger.info(f"Generating AI image for: {image_prompt[:50]}...")
                raw_path = os.path.join(self.scene_dir, f"scene_{i}_raw.png")
                generated_img_path = self.generate_image(image_prompt, raw_path)
                if generated_img_path:
                    logger.info(f"✅ Image generated: {generated_img_path}")
                else:
                    logger.warning(f"⚠️ Image generation failed, will use text-only slide")

            # Slide
            logger.info(f"Creating slide for scene {i}...")
            slide_path = self.create_slide(scene, i, image_path=generated_img_path)
            logger.info(f"✅ Slide created: {slide_path}")

            # Audio
            narration = scene.get("narration", "")
            if not narration:
                logger.warning(f"⚠️ Scene {i} has no narration text, skipping...")
                failed_scenes.append((i, "No narration text"))
                continue
            
            logger.info(f"Narration: {narration[:100]}...")
            audio_path = self.generate_audio(narration, i)
            if not audio_path:
                logger.error(f"❌ Audio generation failed for scene {i}!")
                failed_scenes.append((i, "Audio generation failed"))
                continue

            # Clip
            logger.info(f"Creating video clip for scene {i}...")
            clip_path = self.create_video_clip(slide_path, audio_path, i)
            if clip_path:
                video_clips.append(clip_path)
                logger.info(f"✅ Scene {i} completed successfully!")
            else:
                logger.error(f"❌ Video clip creation failed for scene {i}!")
                failed_scenes.append((i, "Video clip creation failed"))

        logger.info(f"\n{'='*60}")
        logger.info(f"Scene processing complete:")
        logger.info(f"  Successful: {len(video_clips)}/{len(scenes)}")
        logger.info(f"  Failed: {len(failed_scenes)}")
        if failed_scenes:
            logger.warning(f"  Failed scenes: {failed_scenes}")
        logger.info(f"{'='*60}\n")

        if not video_clips:
            error_msg = f"No video clips were created. Failed scenes: {failed_scenes}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        # --- Merge ---
        self._update_task(progress_message="Merging scenes into final video...")
        final_path = self.merge_scenes(video_clips)
        if not final_path:
            raise RuntimeError("Failed to merge scenes into final video.")

        return final_path
