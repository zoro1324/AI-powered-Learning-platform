# Podcast Feature Implementation Guide

## What Was Implemented

### Backend Components

1. **Podcast Service** (`server/api/services/podcast_service.py`)
   - AI-powered podcast generation service
   - Persona and scenario generation
   - Script creation and audio synthesis
   - Uses Ollama + edge-tts

2. **API Endpoints** (`server/api/views.py`)
   - `POST /api/podcast/personas/` - Generate persona options
   - `POST /api/podcast/scenarios/` - Generate scenario options
   - `POST /api/podcast/generate/` - Create complete podcast

3. **Database Model Updates** (`server/api/models.py`)
   - Added `podcast_enabled` field to LearningProfile
   - Added `podcast_auto_generate` field to LearningProfile
   - Migration: `0005_learningprofile_podcast_auto_generate_and_more.py`

### Frontend Components

1. **Podcast Dialog** (`frontend/src/app/components/ui/podcast-dialog.tsx`)
   - Reusable dialog component for in-app podcast generation
   - Multi-step wizard (personas → scenarios → generate → complete)
   - Integrated audio player and download

2. **Topic Page Integration** (`frontend/src/app/pages/TopicPage.tsx`)
   - "Generate Podcast" button in topic header
   - Opens podcast dialog with current topic content
   - Only visible when content is available

3. **Settings Integration** (`frontend/src/app/pages/SettingsPage.tsx`)
   - New "Podcast Preferences" section
   - Enable/disable podcast feature
   - Auto-generation toggle (UI only, not yet implemented)

4. **Standalone Page** (`frontend/src/app/pages/PodcastPage.tsx`)
   - Full-page podcast generator
   - For custom text input
   - Route: `/podcast`

5. **API Service** (`frontend/src/services/api.ts`)
   - Added `podcastAPI` object with typed methods
   - Handles all podcast-related API calls

## How to Use

### For End Users

#### Generate Podcast from Course Topic

1. Go to any course topic page (e.g., navigate through your courses)
2. Make sure content is generated for the topic
3. Look at the **Studio sidebar** on the right side of the screen
4. Click to expand the **"Podcast"** section (blue card with headphones icon)
5. Click **"Generate Podcast"** button
6. In the dialog that opens:
   - **Step 1**: Choose conversation personas (e.g., Expert ↔ Novice)
   - **Step 2**: Select discussion focus (e.g., Deep Dive)
   - **Step 3**: Wait for generation (2-5 minutes)
   - **Step 4**: Listen to or download the podcast
7. Close the dialog when done

**Location**: The Podcast tool is in the Studio sidebar, alongside Notes, Quiz, and Video tools.

#### Configure Podcast Settings

1. Click "Settings" in the sidebar
2. Scroll to "Podcast Preferences" section
3. Toggle options:
   - **Enable Audio Podcasts**: Turn on/off globally
   - **Auto-Generate Podcasts**: (Future feature)

#### Use Standalone Podcast Generator

1. Navigate to `/podcast` in the browser
2. Paste or type your text content
3. Follow the same workflow as above

### For Developers

#### Running the Backend

```bash
cd server

# Apply database migrations
python manage.py migrate

# Start Django server
python manage.py runserver
```

Make sure Ollama is running:
```bash
ollama serve
ollama pull phi3:mini  # or your preferred model
```

#### Running the Frontend

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

#### Environment Configuration

**Backend** (`server/server/settings.py`):
```python
OLLAMA_API_URL = 'http://localhost:11434/api/chat'
OLLAMA_MODEL = 'phi3:mini'
MEDIA_ROOT = BASE_DIR / 'media'
```

**Frontend** (`.env` file):
```env
VITE_API_URL=http://localhost:8000/api
```

## Testing the Feature

### Manual Testing Steps

1. **Start both servers** (backend on :8000, frontend on :5173)

2. **Login** to the application

3. **Navigate to a course** and view a topic

4. **Generate content** for the topic if not already generated

5. **Click "Generate Podcast"** button

6. **Select personas** - Choose any option from the list

7. **Select scenario** - Choose any option from the list

8. **Wait** - Monitor the "Creating Your Podcast" screen (2-5 min)

9. **Verify** completed state:
   - Green checkmark appears
   - Audio player is visible
   - Audio plays when clicking play
   - Download button works

10. **Test download**:
    - Click "Download" button
    - Verify MP3 file downloads with correct name

### API Testing

Test endpoints using curl or Postman:

```bash
# Get auth token first
TOKEN="your_jwt_token"

# Test persona generation
curl -X POST http://localhost:8000/api/podcast/personas/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning is a field of AI..."}'

# Test scenario generation
curl -X POST http://localhost:8000/api/podcast/scenarios/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is...",
    "personas": {"person1": "Expert", "person2": "Novice"}
  }'

# Test podcast generation
curl -X POST http://localhost:8000/api/podcast/generate/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is...",
    "person1": "Expert",
    "person2": "Novice",
    "instruction": "Deep dive"
  }'
```

## Files Modified/Created

### Backend
- ✨ `server/api/services/podcast_service.py` (new)
- 📝 `server/api/views.py` (modified - added 3 views)
- 📝 `server/api/urls.py` (modified - added 3 routes)
- 📝 `server/api/models.py` (modified - added 2 fields)
- 📝 `server/api/migrations/0005_*.py` (new migration)

### Frontend
- ✨ `frontend/src/app/components/ui/podcast-dialog.tsx` (new)
- 📝 `frontend/src/app/components/StudioPanel.tsx` (modified - added podcast tool card)
- 📝 `frontend/src/app/pages/TopicPage.tsx` (modified - cleaned up)
- 📝 `frontend/src/app/pages/SettingsPage.tsx` (modified - added preferences)
- ✨ `frontend/src/app/pages/PodcastPage.tsx` (already existed, for standalone use)
- 📝 `frontend/src/app/routes.tsx` (modified - added route)
- 📝 `frontend/src/services/api.ts` (modified - added podcastAPI)

### Documentation
- ✨ `PODCAST_FEATURE.md` (comprehensive feature documentation)
- ✨ `PODCAST_IMPLEMENTATION.md` (this file)

## Troubleshooting

### Common Issues

**"Podcast tool not showing in Studio sidebar"**
- Make sure you're on a topic page (not course overview)
- The Podcast card should always appear in the Studio sidebar when viewing a topic
- If not visible, refresh the page

**"Generate Podcast button is disabled"**
- Content must be generated first
- Click to expand the Notes tool card and generate content
- Once content exists, the Podcast button will become enabled

**Podcast generation fails**
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- Verify internet connection (edge-tts requires it)
- Check backend logs for errors

**Audio doesn't play**
- Check browser console for errors
- Verify audio URL is accessible
- Try downloading and playing locally

**Settings not saving**
- Preferences currently store in local state only
- Backend integration for saving coming soon
- Reload page resets to defaults

## Next Steps

### Future Enhancements

- [ ] Persist podcast preferences to database
- [ ] Implement auto-generation feature
- [ ] Add podcast history/library
- [ ] Allow custom voice selection
- [ ] Add background music option
- [ ] Support multiple languages
- [ ] Batch podcast generation
- [ ] Share podcasts with other users
- [ ] Generate RSS feed for podcasts
- [ ] Speed controls in audio player

### Known Limitations

- Podcast generation requires active internet (for edge-tts)
- Generation time depends on content length (2-5 minutes typical)
- Voices are fixed (Male/Female neural voices)
- No offline mode support
- Settings preferences not yet persisted to backend

## Support

For issues or questions:
1. Check `PODCAST_FEATURE.md` for detailed documentation
2. Review backend logs in Django console
3. Check browser console for frontend errors
4. Verify all dependencies are installed
5. Ensure Ollama is running and accessible

## Credits

Implementation based on the notebook workflow in `notebooks/podcast.ipynb`, adapted for production use with Django REST Framework and React TypeScript.
