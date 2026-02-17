import logging

from celery import shared_task
from django.core.files import File
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def generate_video_task(self, task_id: str):
    """Celery task that runs the full video generation pipeline."""
    from api.models import VideoTask, Resource
    from api.services.video_generator import VideoGeneratorService
    import os

    try:
        video_task = VideoTask.objects.get(pk=task_id)
    except VideoTask.DoesNotExist:
        logger.error("VideoTask %s not found", task_id)
        return

    try:
        # Fetch generated lesson content if linked to a lesson
        lesson_content = None
        if video_task.lesson and video_task.lesson.content:
            lesson_content = video_task.lesson.content
            logger.info("Using lesson content (%d chars) for video generation", len(lesson_content))

        service = VideoGeneratorService(task_id)
        final_path = service.run(video_task.topic, content=lesson_content)

        # Save the video file to the model's FileField
        with open(final_path, "rb") as f:
            video_task.video_file.save(
                f"video_{task_id}.mp4",
                File(f),
                save=False,
            )

        # Get duration from the generated video
        try:
            from moviepy import VideoFileClip
            clip = VideoFileClip(final_path)
            video_task.duration_seconds = int(clip.duration)
            clip.close()
        except Exception:
            pass

        video_task.status = "completed"
        video_task.progress_message = "Video generation complete."
        video_task.completed_at = timezone.now()
        video_task.save()
        logger.info("VideoTask %s completed successfully.", task_id)

        # Create Resource record if linked to a lesson
        if video_task.lesson:
            try:
                # Check if resource already exists for this video task
                existing_resource = Resource.objects.filter(
                    lesson=video_task.lesson,
                    resource_type='video',
                    title=f"{video_task.topic} - Video"
                ).first()
                
                if not existing_resource:
                    file_size = os.path.getsize(final_path) if os.path.exists(final_path) else 0
                    
                    Resource.objects.create(
                        lesson=video_task.lesson,
                        resource_type='video',
                        title=f"{video_task.topic} - Video",
                        content_json=video_task.script_data,
                        file=video_task.video_file,
                        file_size_bytes=file_size,
                        duration_seconds=video_task.duration_seconds,
                        is_generated=True,
                        generation_model='stable-diffusion + edge-tts'
                    )
                    logger.info(f"✅ Created Resource record for video: {video_task.topic}")
                else:
                    logger.info(f"ℹ️ Resource already exists for video: {video_task.topic}")
            except Exception as resource_error:
                logger.error(f"❌ Failed to create Resource record: {resource_error}")

    except Exception as exc:
        logger.exception("VideoTask %s failed", task_id)
        VideoTask.objects.filter(pk=task_id).update(
            status="failed",
            error_message=str(exc),
            progress_message="Generation failed.",
        )
