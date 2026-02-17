# Podcast Generation Feature

## Overview

The Podcast Generation feature transforms text content into engaging audio conversations using AI. It provides a multi-step workflow for customizing the podcast style and generating natural-sounding dialogues.

**New Features:**
- **Studio Sidebar Integration**: Podcast tool accessible in the Studio panel alongside Notes, Quiz, and Video
- **Podcast Preferences**: Configure podcast settings in user preferences
- **Auto-Generation**: Option to automatically generate podcasts for new topics
- **Inline Dialog**: Streamlined podcast creation without leaving the learning flow

## Quick Start

### Generate Podcast from Course Topic

1. Navigate to any course topic (e.g., `/course/1/module/0/topic/0`)
2. Ensure the topic content is generated
3. Look at the **Studio sidebar** on the right side
4. Click the **"Podcast"** card (blue with headphones icon) to expand it
5. Click **"Generate Podcast"** button
6. Follow the dialog wizard:
   - Select conversation personas
   - Choose discussion focus
   - Wait for generation (2-5 min)
   - Listen or download

### Configure Preferences

1. Go to **Settings** (from sidebar)
2. Scroll to **"Podcast Preferences"** section
3. Toggle options:
   - **Enable Audio Podcasts**: Turn feature on/off globally
   - **Auto-Generate Podcasts**: Auto-create on topic view (coming soon)

### Standalone Podcast Generator

For custom text not from courses:
1. Navigate to `/podcast`
2. Paste your text content
3. Follow the same wizard flow

## Architecture

### Backend (Django)

#### 1. Service Layer (`server/api/services/podcast_service.py`)

The `PodcastService` class handles all podcast generation logic:

- **Persona Generation**: Analyzes content and suggests 3 pairs of conversational personas
- **Scenario Generation**: Creates 3 conversation styles based on selected personas
- **Script Generation**: Uses Ollama LLM to create natural dialogue
- **Audio Synthesis**: Converts script to audio using edge-tts with distinct voices

**Key Methods:**
```python
generate_persona_options(text: str) -> List[Dict[str, str]]
generate_scenario_options(text: str, personas: Optional[Dict]) -> List[str]
generate_podcast(text: str, instruction: str, person1: str, person2: str) -> str
```

#### 2. API Views (`server/api/views.py`)

Three REST endpoints handle the workflow:

- `POST /api/podcast/personas/` - Generate persona options
- `POST /api/podcast/scenarios/` - Generate scenario options  
- `POST /api/podcast/generate/` - Generate complete podcast

#### 3. URL Configuration (`server/api/urls.py`)

Routes are registered in the main API URL configuration.

#### 4. Database Models (`server/api/models.py`)

**LearningProfile Model Updates:**
```python
class LearningProfile(models.Model):
    # ... existing fields ...
    
    # Podcast preferences
    podcast_enabled = models.BooleanField(default=True)
    podcast_auto_generate = models.BooleanField(default=False)
```

**Migration:** `0005_learningprofile_podcast_auto_generate_and_more.py`

### Frontend (React + TypeScript)

#### 1. API Service (`frontend/src/services/api.ts`)

The `podcastAPI` object provides typed API calls:

```typescript
podcastAPI.generatePersonaOptions(text: string)
podcastAPI.generateScenarioOptions(text: string, personas?: object)
podcastAPI.generatePodcast(data: object)
```

#### 2. UI Components

**Podcast Dialog** (`frontend/src/app/components/ui/podcast-dialog.tsx`)
- Reusable dialog component for podcast generation
- Multi-step wizard interface (personas → scenarios → generating → complete)
- Integrated audio player with download option
- Invoked from any page with content

**Standalone Page** (`frontend/src/app/pages/PodcastPage.tsx`)
- Full-page podcast generator interface
- Same multi-step workflow as dialog
- For generating podcasts from custom text input

**Topic Page Integration** (`frontend/src/app/pages/TopicPage.tsx`)
- Removed standalone podcast button (now integrated in Studio sidebar)

**Studio Sidebar Integration** (`frontend/src/app/components/StudioPanel.tsx`)
- Added "Podcast" tool card to Studio sidebar
- Integrated podcast dialog launcher
- Appears alongside Notes, Quiz, and Video tools
- Only enabled when topic content is available

**Settings Integration** (`frontend/src/app/pages/SettingsPage.tsx`)
- Podcast preferences section
- Toggle podcast feature on/off
- Enable/disable auto-generation

#### 3. Routing (`frontend/src/app/routes.tsx`)

- `/podcast` - Standalone podcast generator page
- Podcast dialog accessible from any topic page

## User Workflow

### From Course Topic Page

1. **Navigate** to any course topic that has content generated
2. **Click** the "Generate Podcast" button in the topic header
3. **Select personas** - Choose conversation dynamic (e.g., Expert vs Novice)
4. **Choose scenario** - Pick conversation style (e.g., Deep Dive, Debate)
5. **Wait for generation** - AI creates script and synthesizes audio (2-5 minutes)
6. **Listen & download** - Play audio in the dialog or download MP3

### From Standalone Page

1. **Navigate** to `/podcast` in the application
2. **Enter content** - Paste or type text to convert to podcast
3. **Select personas** - Choose conversation dynamic (e.g., Expert vs Novice)
4. **Choose scenario** - Pick conversation style (e.g., Deep Dive, Debate)
5. **Wait for generation** - AI creates script and synthesizes audio (2-5 minutes)
6. **Listen & download** - Play audio in browser or download MP3

### Podcast Preferences

Configure podcast settings in **Settings > Podcast Preferences**:

- **Enable Audio Podcasts**: Turn podcast feature on/off
- **Auto-Generate Podcasts**: Automatically create podcasts when viewing new topics

## Technical Details

### AI Models Used

- **LLM**: Ollama (configurable model) for script generation
- **TTS**: Microsoft Edge TTS with neural voices
  - Person 1: `en-US-GuyNeural` (Male)
  - Person 2: `en-US-JennyNeural` (Female)

### Dependencies

#### Backend
- `edge-tts` - Text-to-speech synthesis
- `requests` - HTTP client for Ollama
- Standard Django/DRF stack

#### Frontend
- `axios` - HTTP client
- `react-router` - Navigation
- Standard React/TypeScript stack

### File Storage

Generated podcasts are stored in:
```
server/media/podcasts/
```

Files are named: `podcast_{uuid}.mp3`

## Configuration

### Backend Settings (`server/server/settings.py`)

Required settings:
```python
OLLAMA_API_URL = 'http://localhost:11434/api/chat'
OLLAMA_MODEL = 'phi3:mini'  # or your preferred model
MEDIA_ROOT = BASE_DIR / 'media'
```

### Frontend Environment (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000/api
```

## API Reference

### Generate Persona Options

**Endpoint:** `POST /api/podcast/personas/`

**Request:**
```json
{
  "text": "Machine learning is a field of study..."
}
```

**Response:**
```json
{
  "options": [
    {"person1": "Expert", "person2": "Novice"},
    {"person1": "Skeptic", "person2": "Enthusiast"},
    {"person1": "Professor", "person2": "Student"}
  ]
}
```

### Generate Scenario Options

**Endpoint:** `POST /api/podcast/scenarios/`

**Request:**
```json
{
  "text": "Machine learning is a field of study...",
  "personas": {
    "person1": "Expert",
    "person2": "Novice"
  }
}
```

**Response:**
```json
{
  "options": [
    "Deep dive into fundamentals",
    "Practical applications discussion",
    "Critical analysis of limitations"
  ]
}
```

### Generate Podcast

**Endpoint:** `POST /api/podcast/generate/`

**Request:**
```json
{
  "text": "Machine learning is a field of study...",
  "instruction": "Deep dive into fundamentals",
  "person1": "Expert",
  "person2": "Novice"
}
```

**Response:**
```json
{
  "audio_url": "/media/podcasts/podcast_a1b2c3d4.mp3",
  "message": "Podcast generated successfully"
}
```

## Development

### Running Backend

```bash
cd server
python manage.py runserver
```

Ensure Ollama is running:
```bash
ollama serve
ollama pull phi3:mini  # or your preferred model
```

### Running Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testing

#### Test Backend API (using curl):

```bash
# Generate personas
curl -X POST http://localhost:8000/api/podcast/personas/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your content here..."}'

# Generate scenarios
curl -X POST http://localhost:8000/api/podcast/scenarios/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your content...", "personas": {"person1": "Expert", "person2": "Novice"}}'

# Generate podcast
curl -X POST http://localhost:8000/api/podcast/generate/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your content...", "person1": "Expert", "person2": "Novice", "instruction": "Deep dive"}'
```

#### Test Frontend:

1. Start dev server
2. Navigate to http://localhost:5173/podcast
3. Follow the UI workflow

## Troubleshooting

### Common Issues

**Issue:** "Failed to call Ollama API"
- **Solution:** Ensure Ollama is running on port 11434
- Check: `curl http://localhost:11434/api/tags`

**Issue:** "No audio generated"
- **Solution:** Check edge-tts installation: `pip install edge-tts`
- Verify internet connection (edge-tts requires internet for synthesis)

**Issue:** "CORS errors in browser"
- **Solution:** Check `CORS_ALLOWED_ORIGINS` in Django settings
- Ensure frontend URL is whitelisted

**Issue:** "Podcast generation takes too long"
- **Solution:** 
  - Use a faster Ollama model (e.g., `llama3.2:1b`)
  - Reduce content length (script generation time increases with content)
  - Check system resources (GPU acceleration helps)

### Logs

Backend logs show detailed generation steps:
```python
logger.info(f"Selected Roles: {roles}")
logger.info(f"Generated Script with {len(script)} turns")
logger.info(f"Podcast generated successfully: {final_path}")
```

Enable debug logging in Django settings:
```python
LOGGING = {
    'loggers': {
        'api.services.podcast_service': {
            'level': 'DEBUG',
        }
    }
}
```

## Future Enhancements

Potential improvements:
- [ ] Multiple language support
- [ ] Voice customization (pitch, speed, etc.)
- [ ] Background music/sound effects
- [ ] Saved podcast library per user
- [ ] Podcast sharing/export
- [ ] Custom persona creation
- [ ] Batch podcast generation
- [ ] Integration with course content
- [ ] RSS feed generation

## Credits

Based on the notebook implementation in `notebooks/podcast.ipynb`, adapted for production use with Django REST Framework and React.
