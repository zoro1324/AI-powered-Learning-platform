# 3-Stage Video Generation Pipeline

## Overview

The video generation system has been upgraded to a professional 3-stage architecture that produces high-quality educational videos with premium design templates.

## Architecture

### Stage 1: Blueprint Generator
- **Purpose**: Generate structured video plan using LLM
- **Output**: JSON blueprint with slides, themes, narration, and image prompts
- **Features**:
  - 6-10 slides per video
  - Structured JSON output
  - Content validation and retry logic
  - Support for lesson content integration

### Stage 2: Template Engine  
- **Purpose**: Provide professional HTML slide templates
- **Output**: Hardcoded premium HTML templates
- **Available Themes**:
  - `modern_dark`: Dark gradient with blue accents
  - `light_minimal`: Clean light design with subtle colors
  - `gradient_academic`: Academic style with gold/purple gradient
- **Benefits**:
  - Pixel-perfect rendering
  - Consistent quality
  - No LLM hallucination in design

### Stage 3: Slide Render Engine
- **Purpose**: Generate final video from blueprint and template
- **Components**:
  - **Image Generation**: Stable Diffusion with LCM LoRA (fast inference)
  - **HTML Rendering**: Playwright for 1920×1080 screenshots
  - **Audio**: Edge-TTS for natural voice narration
  - **Video Assembly**: FFmpeg for MP4 encoding and merging
- **Output**: Final high-quality MP4 video

## Installation

### 1. Install Python Dependencies

```bash
cd server
pip install -r ../requirements.txt
```

Key new dependencies:
- `playwright` - HTML slide rendering
- `diffusers` - Stable Diffusion image generation
- `torch` - Deep learning framework
- `edge-tts` - Text-to-speech

### 2. Install Playwright Browsers

```bash
playwright install chromium
```

### 3. Verify FFmpeg Installation

FFmpeg is required for video processing. Verify it's installed:

```bash
ffmpeg -version
ffprobe -version
```

If not installed:
- **Windows**: Download from https://ffmpeg.org/download.html
- **Linux**: `sudo apt install ffmpeg`
- **macOS**: `brew install ffmpeg`

## Usage

### Via Django API

The existing API endpoints remain unchanged:

```bash
POST /api/videos/generate/
{
  "topic": "Introduction to Machine Learning",
  "content": "Optional lesson content..."
}
```

### Programmatic Usage

```python
from api.services.video_generator import VideoGeneratorService

# Initialize service with task ID
service = VideoGeneratorService(task_id="unique-task-id")

# Generate video
try:
    video_path = service.run(
        topic="Your Topic Here",
        content="Optional lesson content for context..."
    )
    print(f"Video generated: {video_path}")
except RuntimeError as e:
    print(f"Generation failed: {e}")
```

## Configuration

Configuration is managed through:

1. **Resolution**: 1920×1080 (hardcoded in `SLIDE_W`, `SLIDE_H`)
2. **TTS Voice**: `en-US-ChristopherNeural` (configurable via `TTS_VOICE`)
3. **Stable Diffusion Model**: `runwayml/stable-diffusion-v1-5` with LCM LoRA
4. **Output Directory**: `MEDIA_ROOT/videos/{task_id}/`

## File Structure

After generation, files are organized as:

```
MEDIA_ROOT/videos/{task_id}/
├── scripts/
│   └── blueprint.json          # Stage 1 output
├── template.html               # Stage 2 output
├── slides/
│   ├── slide_01/
│   │   ├── image.png          # Generated SD image
│   │   ├── slide.html         # Populated HTML
│   │   ├── slide.png          # Rendered screenshot
│   │   ├── narration.mp3      # TTS audio
│   │   └── slide.mp4          # Individual slide video
│   ├── slide_02/
│   └── ...
└── final_video.mp4             # Final merged video
```

## Performance

### Typical Generation Time (6-8 slides)
- **Stage 1 (Blueprint)**: 10-30 seconds
- **Stage 2 (Template)**: < 1 second
- **Stage 3 (Rendering)**: 
  - Per slide: 15-30 seconds
  - Total: 2-5 minutes for complete video

### GPU Acceleration
- Stable Diffusion automatically uses CUDA if available
- CPU fallback supported (slower image generation)
- LCM LoRA enables fast 10-step inference

## Troubleshooting

### Playwright Errors
If Playwright fails, the system falls back to PIL for basic slide rendering.

**Solution**: Install Playwright browsers
```bash
playwright install chromium
```

### FFmpeg Errors
Check FFmpeg installation:
```bash
ffmpeg -version
```

### Stable Diffusion Memory Issues
If GPU runs out of memory:
- The pipeline enables memory optimizations automatically
- CPU fallback is available but slower

### Audio Generation Fails
Edge-TTS requires internet connection for first-time voice download.

## Advantages Over Previous Implementation

| Feature | Old Pipeline | New Pipeline |
|---------|-------------|--------------|
| Slide Design | Basic PIL text | Premium HTML templates |
| Resolution | 1280×720 | 1920×1080 |
| Themes | None | 3 professional themes |
| Image Quality | Basic SD | SD with LCM LoRA (faster) |
| Rendering | MoviePy | Playwright (better quality) |
| Architecture | Monolithic | 3-stage modular |
| Maintainability | Mixed concerns | Clear separation |

## API Compatibility

The new implementation maintains full backward compatibility with existing API endpoints and models:
- Uses same `VideoTask` model
- Same REST API endpoints
- Same Celery task interface
- Existing frontend code requires no changes

## Future Enhancements

Potential improvements:
- Additional theme templates
- Custom brand colors/fonts
- Background music support
- Transitions between slides
- Video effects and animations
- Multi-language TTS support
