# AI-Powered Course Planning Implementation

## Overview

This document describes the implementation of AI-powered course planning that intelligently analyzes topics and creates structured course hierarchies. When users click "Create New Course", the system uses LangChain and Ollama to determine if the topic is broad or narrow, then automatically generates appropriate courses.

## Architecture

### Backend Components

#### 1. **CoursePlanningService** (`server/api/services/course_planning_service.py`)
- **Purpose**: AI service using LangChain to analyze topics and generate course plans
- **Key Features**:
  - Uses Pydantic models for structured output validation
  - Analyzes if topic is broad (requires multiple courses) or narrow (single course)
  - Generates 1-8 courses with proper difficulty progression
  - Ensures no overlap between courses
  - Assigns prerequisites automatically

**Pydantic Models**:
```python
class CourseModel(BaseModel):
    course_name: str
    description: str
    difficulty: str  # Beginner, Intermediate, or Advanced
    prerequisites: List[str]

class CoursePlan(BaseModel):
    is_broad: bool
    total_courses: int
    courses: List[CourseModel]
```

#### 2. **CoursePlanningTask Model** (`server/api/models.py`)
- **Purpose**: Database model to track async course planning tasks
- **Fields**:
  - `id`: UUID primary key
  - `course_title`: Topic to analyze
  - `course_description`: What the course should cover
  - `category`, `difficulty_level`, `estimated_duration`, `thumbnail`: Course metadata
  - `status`: pending → processing → completed/failed
  - `result_data`: JSON with full LLM response
  - `created_courses`: Array of created course IDs
  - `error_message`: Error details if failed

#### 3. **Background Threading** (`server/api/views.py`)
- **Task**: Course planning runs in background thread
- **Flow**:
  1. Initialize `CoursePlanningService`
  2. Call LLM to analyze topic and generate plan
  3. **If narrow topic**: Create single `Course` with `is_sub_topic=False`
  4. **If broad topic**:
     - Create parent `Course` with `is_sub_topic=False`
     - Create child `Course` records with `is_sub_topic=True` and `parent_topic_name=parent.title`
  5. Update task status and store created course IDs

#### 4. **API Endpoints** (`server/api/views.py`, `server/api/urls.py`)

**Create Planning Task**:
```
POST /api/courses/plan/
Request Body:
{
  "course_title": "Machine Learning",
  "course_description": "Comprehensive ML coverage...",
  "category": "ai_ml",
  "difficulty_level": "beginner",
  "estimated_duration": 120,
  "thumbnail": "https://..."
}

Response: 202 ACCEPTED
{
  "id": "uuid-here",
  "status": "pending",
  "progress_message": "Task queued",
  ...
}
```

**Check Task Status**:
```
GET /api/courses/plan/status/{task_id}/

Response:
{
  "id": "uuid-here",
  "status": "completed",
  "progress_message": "Successfully created 5 course(s)",
  "result_data": {
    "is_broad": true,
    "total_courses": 5,
    "courses": [...]
  },
  "created_courses": ["1", "2", "3", "4", "5"],
  ...
}
```

### Frontend Components

#### 1. **Updated Course Creation Dialog** (`frontend/src/app/pages/PopularCoursesPage.tsx`)

**Changes**:
- Form now uses `coursePlanningAPI.create()` instead of direct `courseAPI.create()`
- Implements polling mechanism to check task status every 2 seconds
- Shows progress messages during AI processing
- Displays different success messages for broad vs. narrow topics
- Auto-refreshes course list when complete

**User Flow**:
1. User fills in course title and description
2. Click "Create Course" → Shows "Planning Course..." with spinner
3. Displays progress: "Analyzing topic...", "Creating courses...", etc.
4. On completion:
   - Narrow topic: "Successfully created course!"
   - Broad topic: "Successfully created 5 courses! The topic was broad and has been split into a structured learning path."

#### 2. **API Client** (`frontend/src/services/api.ts`)

```typescript
export const coursePlanningAPI = {
  create: async (data) => CoursePlanningTask
  getStatus: async (taskId) => CoursePlanningTask
}
```

## Database Schema

### CoursePlanningTask Table
```sql
CREATE TABLE course_planning_tasks (
    id UUID PRIMARY KEY,
    course_title VARCHAR(255),
    course_description TEXT,
    category VARCHAR(50),
    difficulty_level VARCHAR(20),
    estimated_duration INTEGER,
    thumbnail VARCHAR(200),
    status VARCHAR(15),  -- pending, processing, completed, failed
    progress_message TEXT,
    result_data JSONB,
    created_courses JSONB,
    error_message TEXT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### Course Hierarchy (Existing Fields Used)
```sql
-- Example for broad topic "Machine Learning"
-- Parent Course:
{
  id: 1,
  title: "Machine Learning",
  is_sub_topic: false,
  parent_topic_name: null
}

-- Child Courses:
{
  id: 2,
  title: "ML Foundations",
  is_sub_topic: true,
  parent_topic_name: "Machine Learning",
  difficulty_level: "beginner",
  prerequisites: []
}
{
  id: 3,
  title: "Supervised Learning",
  is_sub_topic: true,
  parent_topic_name: "Machine Learning",
  difficulty_level: "intermediate",
  prerequisites: ["ML Foundations"]
}
```

## LLM Prompt Engineering

The system uses a carefully crafted prompt to ensure consistent output:

### Analysis Rules
1. **Narrow Topics**: Specific, focused topics → 1 course
   - Examples: "Python Decorators", "CSS Flexbox", "Linear Regression"
2. **Broad Topics**: Wide-ranging topics → 2-8 courses
   - Examples: "Machine Learning", "Web Development", "Data Science"

### Course Structure Rules
- Each course has: name, description, difficulty (exact: Beginner/Intermediate/Advanced)
- Courses ordered from Beginner → Advanced
- Prerequisites reference earlier course names
- No content overlap between courses

## Example Scenarios

### Scenario 1: Narrow Topic
**Input**:
- Title: "Introduction to Python Decorators"
- Description: "Learn decorators, class decorators, and decorator patterns"

**AI Analysis**:
```json
{
  "is_broad": false,
  "total_courses": 1,
  "courses": [{
    "course_name": "Python Decorators Masterclass",
    "description": "Comprehensive guide to Python decorators...",
    "difficulty": "Intermediate",
    "prerequisites": []
  }]
}
```

**Result**: 1 course created with `is_sub_topic=False`

### Scenario 2: Broad Topic
**Input**:
- Title: "Machine Learning"
- Description: "Comprehensive ML including supervised, unsupervised, deep learning"

**AI Analysis**:
```json
{
  "is_broad": true,
  "total_courses": 5,
  "courses": [
    {
      "course_name": "Machine Learning Foundations",
      "description": "Introduction to ML concepts...",
      "difficulty": "Beginner",
      "prerequisites": []
    },
    {
      "course_name": "Supervised Learning Algorithms",
      "description": "Linear/logistic regression, decision trees...",
      "difficulty": "Intermediate",
      "prerequisites": ["Machine Learning Foundations"]
    },
    {
      "course_name": "Unsupervised Learning",
      "description": "Clustering, dimensionality reduction...",
      "difficulty": "Intermediate",
      "prerequisites": ["Machine Learning Foundations"]
    },
    {
      "course_name": "Deep Learning Fundamentals",
      "description": "Neural networks, CNNs, RNNs...",
      "difficulty": "Advanced",
      "prerequisites": ["Supervised Learning Algorithms"]
    },
    {
      "course_name": "Advanced ML Applications",
      "description": "Real-world projects and deployments...",
      "difficulty": "Advanced",
      "prerequisites": ["Deep Learning Fundamentals", "Unsupervised Learning"]
    }
  ]
}
```

**Result**: 
- 1 parent course: "Machine Learning" (`is_sub_topic=False`)
- 5 child courses with `is_sub_topic=True`, `parent_topic_name="Machine Learning"`

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
pip install langchain langchain-ollama langchain-core pydantic
```

### 2. Ensure Ollama is Running
```bash
# Pull the model (if not already installed)
ollama pull llama3:8b

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### 3. Start Django Server
```bash
cd server
python manage.py runserver
```

### 4. Start Frontend
OLLAMA_MODEL = 'llama3:8b'  # Or 'phi3:mini', 'mistral', etc.
OLLAMA_API_URL = 'http://localhost:11434/api/generate'
```

### Model Selection
The service defaults to `llama3:8b` for best results. You can change this in:
- Settings: `OLLAMA_MODEL = 'model-name'`
- Service instantiation: `CoursePlanningService(model_name='phi3:mini')`

Recommended models:
- **llama3:8b**: Best quality, slower (recommended)
- **phi3:mini**: Faster, good quality
- **mistral**: Balanced performance

## Testing

### Manual Testing
1. Start the frontend and backend
2. Navigate to "Popular Courses" page
3. Click "Create New Course"
4. Test narrow topic:
   - Title: "CSS Grid Layout"
   - Description: "Master CSS Grid for responsive layouts"
   - Should create 1 course
5. Test broad topic:
   - Title: "Full Stack Web Development"
   - Description: "Complete guide from frontend to backend"
   - Should create multiple courses (parent + children)

### API Testing
```bash
# Create planning task
curl -X POST http://localhost:8000/api/courses/plan/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_title": "Machine Learning",
    "course_description": "Comprehensive ML course",
    "category": "ai_ml",
    "difficulty_level": "beginner",
    "estimated_duration": 120
  }'

# Check status
curl http://localhost:8000/api/courses/plan/status/{task_id}/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: "NameError: name 'IsAuthenticated' is not defined"
**Solution**: Import added in views.py: `from rest_framework.permissions import IsAuthenticated`

### Issue: Task not running
**Solutions**:
1. Check Django server is running
2. Check logs for errors: `python manage.py runserver`
3. System uses background threads automatically

### Issue: LLM returns invalid difficulty
**Solution**: Pydantic validator enforces only "Beginner", "Intermediate", "Advanced". Prompt explicitly instructs LLM to use exact values.

### Issue: Ollama connection error
**Solutions**:
1. Verify Ollama is running: `ollama serve`
2. Check model is pulled: `ollama list`
3. Test API: `curl http://localhost:11434/api/tags`

## Future Enhancements

1. **Syllabus Auto-Generation**: After creating courses, automatically generate detailed syllabi
2. **Progress Tracking**: Show which child courses are completed in parent course view
3. **Prerequisite Enforcement**: Block enrollment in advanced courses until prerequisites complete
4. **Course Recommendations**: Suggest next course based on completed courses
5. **Batch Course Creation**: Allow creating multiple course plans simultaneously
6. **Custom Models**: Allow users to select preferred LLM model
7. **Course Merging**: Combine multiple narrow courses into a learning path

## Files Modified/Created

### Created
- `server/api/services/course_planning_service.py` - AI service
- `server/api/migrations/0007_courseplanningtask.py` - Database migration
- `COURSE_PLANNING_IMPLEMENTATION.md` - This documentation

### Modified
- `server/api/models.py` - Added `CoursePlanningTask` model
- `server/api/admin.py` - Added admin interface for `CoursePlanningTask`
- `server/api/serializers.py` - Added `CoursePlanningTaskSerializer`
- `server/api/views.py` - Added `CoursePlanningView` and `CoursePlanningStatusView`
- `server/api/tasks.py` - Added `generate_course_plan_task`
- `server/api/urls.py` - Added course planning endpoints
- `server/server/settings.py` - Enabled Celery (`USE_CELERY = True`)
- `requirements.txt` - Added LangChain dependencies
- `frontend/src/types/api.ts` - Added `CoursePlanningTask` interface
- `frontend/src/services/api.ts` - Added `coursePlanningAPI`
- `frontend/src/app/pages/PopularCoursesPage.tsx` - Updated course creation flow

## Summary

This implementation provides intelligent, AI-powered course planning that:
- ✅ Automatically detects topic complexity
- ✅ Creates structured learning paths for broad topics
- ✅ Maintains single courses for focused topics
- ✅ Ensures proper course progression and prerequisites
- ✅ Provides real-time progress feedback to users
- ✅ Uses existing database schema (no major schema changes)
- ✅ Uses background threading (no Redis/Celery required)
- ✅ Fully integrated with frontend UI
