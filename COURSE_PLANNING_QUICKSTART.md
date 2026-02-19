# Quick Start: AI-Powered Course Planning

## Prerequisites
1. ✅ Ollama installed and running (http://localhost:11434)
2. ✅ Python environment activated

## Setup Steps

### 1. Install Python Dependencies
```bash
cd server
pip install langchain langchain-ollama langchain-core pydantic
```

### 2. Pull Ollama Model
```bash
# Recommended: llama3:8b for best quality
ollama pull llama3:8b

# Alternative: phi3:mini for faster processing
ollama pull phi3:mini
```

### 3. Database Migration
```bash
cd server
python manage.py migrate
```

### 4. Start Django Server
```bash
cd server
python manage.py runserver
```

### 7. Start Frontend (Separate Terminal)
```bash
cd frontend
npm run dev
```

## Testing

### Option 1: Via UI
1. Open http://localhost:5173
2. Login/Register
3. Navigate to "Popular Courses"
4. Click "Create New Course"
5. Fill in the form:
   - **Narrow Topic Test**:
     - Title: "CSS Grid Layout"
     - Description: "Master CSS Grid for responsive web layouts"
     - Expected: Creates 1 course
   
   - **Broad Topic Test**:
     - Title: "Machine Learning"
     - Description: "Comprehensive ML including supervised learning, unsupervised learning, and deep learning"
     - Expected: Creates 1 parent + 2-8 child courses

6. Watch the progress indicator
7. See success message and refresh course list

### Option 2: Via API (cURL)
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.access')

# Create course planning task
TASK_RESPONSE=$(curl -X POST http://localhost:8000/api/courses/plan/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_title": "Machine Learning",
    "course_description": "Comprehensive coverage of ML concepts",
    "category": "ai_ml",
    "difficulty_level": "beginner",
    "estimated_duration": 120
  }')

echo $TASK_RESPONSE | jq

# Extract task ID
TASK_ID=$(echo $TASK_RESPONSE | jq -r '.id')

# Check status (poll every 2 seconds)
curl http://localhost:8000/api/courses/plan/status/$TASK_ID/ \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Option 3: Via Python
```python
import requests
import time

# Login
response = requests.post('http://localhost:8000/api/auth/login/', json={
    'email': 'test@example.com',
    'password': 'password'
})
token = response.json()['access']

headers = {'Authorization': f'Bearer {token}'}

# Create planning task
task = requests.post('http://localhost:8000/api/courses/plan/', 
    headers=headers,
    json={
        'course_title': 'Data Science',
        'course_description': 'Complete data science from basics to advanced',
        'category': 'data_science',
        'difficulty_level': 'beginner',
        'estimated_duration': 120
    }
).json()

print(f"Task ID: {task['id']}")
print(f"Status: {task['status']}")

# Poll for completion
task_id = task['id']
while True:
    status = requests.get(
        f'http://localhost:8000/api/courses/plan/status/{task_id}/',
        headers=headers
    ).json()
    
    print(f"Status: {status['status']} - {status['progress_message']}")
    
    if status['status'] in ['completed', 'failed']:
        print(f"\nResult: {status['result_data']}")
        print(f"Created Courses: {status['created_courses']}")
        break
    
    time.sleep(2)
```

## Verification

### Check Created Courses
```bash
# List all courses
curl http://localhost:8000/api/courses/ -H "Authorization: Bearer $TOKEN" | jq

# Filter by parent topic (for broad topics)
curl "http://localhost:8000/api/courses/?parent_topic_name=Machine%20Learning" \
  -H "Authorization: Bearer $TOKEN" | jq

# Check specific course
curl http://localhost:8000/api/courses/1/ -H "Authorization: Bearer $TOKEN" | jq
```

### Check Database Records
```bash
cd server
python manage.py shell

>>> from api.models import Course, CoursePlanningTask
>>> 
>>> # View planning tasks
>>> for task in CoursePlanningTask.objects.all():
...     print(f"{task.course_title}: {task.status}")
>>> 
>>> # View parent courses
>>> for course in Course.objects.filter(is_sub_topic=False):
...     print(f"Parent: {course.title}")
...     children = Course.objects.filter(parent_topic_name=course.title)
...     for child in children:
...         print(f"  - Child: {child.title} ({child.difficulty_level})")
```

## Common Issues

### 1. Ollama Not Running
**Error**: Connection refused to localhost:11434
**Solution**:
```bash
ollama serve
# In another terminal, verify:
ollama list
```

### 2. Model Not Found
**Error**: Model 'llama3:8b' not found
**Solution**:
```bash
ollama pull llama3:8b
```

### 3. Permission Denied
**Error**: 403 Forbidden
**Solution**: Ensure you're authenticated. Check:
- Token is valid
- User is logged in
- Headers include `Authorization: Bearer <token>`

### 4. LLM Taking Too Long
**Solutions**:
- Use smaller model: `phi3:mini` instead of `llama3:8b`
- Increase timeout in settings.py: `OLLAMA_TIMEOUT = 900`
- Check CPU/GPU usage

## Expected Timeline

| Step | Time (Narrow Topic) | Time (Broad Topic) |
|------|--------------------|--------------------|
| Task Creation | < 1s | < 1s |
| LLM Analysis | 10-30s | 20-60s |
| Course Creation | < 1s | 1-2s |
| **Total** | **15-35s** | **25-65s** |

*Times vary based on hardware and model choice*

## Next Steps

After successful setup:
1. ✅ Test with both narrow and broad topics
2. ✅ Check Django admin to view `CoursePlanningTask` records
3. ✅ Verify course hierarchy in database
4. ✅ Review `COURSE_PLANNING_IMPLEMENTATION.md` for details
5. ✅ Customize prompt in `course_planning_service.py` if needed
6. ✅ Consider enabling additional features:
   - Auto-syllabus generation for created courses
   - Prerequisite enforcement
   - Progress tracking across course hierarchy

## Support

- **Documentation**: See `COURSE_PLANNING_IMPLEMENTATION.md`
- **Service Code**: `server/api/services/course_planning_service.py`
- **Task Logic**: `server/api/tasks.py`
- **API Views**: `server/api/views.py` (Search for "CoursePlanningView")
- **Frontend**: `frontend/src/app/pages/PopularCoursesPage.tsx`

Happy course planning! 🎓
