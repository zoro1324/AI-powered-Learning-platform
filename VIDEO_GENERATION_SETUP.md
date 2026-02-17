# Video Generation Setup Guide

## Overview

The video generation feature uses:
- **Ollama** - For AI script generation
- **Stable Diffusion** - For image generation  
- **Celery + Redis** (optional) - For async task processing

## Quick Start (Without Redis)

The system works without Redis by default using synchronous processing:

1. **Install and run Ollama**
   ```bash
   # Download from: https://ollama.com/download
   # After installation, pull the model:
   ollama pull phi3:mini
   ```

2. **Verify settings** - In `server/settings.py`:
   ```python
   USE_CELERY = False  # Default: synchronous processing
   OLLAMA_TIMEOUT = 600  # 10 minutes timeout
   OLLAMA_MODEL = 'phi3:mini'
   ```

3. **Start the server**
   ```bash
   cd server
   python manage.py runserver
   ```

## Advanced Setup (With Redis for Async Processing)

For production or better performance, use Redis:

### Windows

1. **Install Redis**
   - Download from: https://github.com/microsoftarchive/redis/releases
   - Or use WSL: `sudo apt-get install redis-server`

2. **Start Redis**
   ```bash
   # Direct install:
   redis-server
   
   # Or via WSL:
   sudo service redis-server start
   ```

3. **Enable Celery** - In `server/settings.py`:
   ```python
   USE_CELERY = True
   ```

4. **Start Celery worker**
   ```bash
   cd server
   celery -A server worker --loglevel=info --pool=solo
   ```

5. **Start Django server**
   ```bash
   python manage.py runserver
   ```

### Linux/Mac

1. **Install Redis**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   ```

2. **Start Redis**
   ```bash
   redis-server
   # Or run in background:
   redis-server --daemonize yes
   ```

3. **Enable Celery** and start as shown above

## Troubleshooting

### Ollama Connection Issues

**Error**: `Ollama connection error` or `Read timed out`

**Solutions**:
1. Check if Ollama is running:
   ```bash
   # Should return version info
   ollama --version
   ```

2. Test Ollama directly:
   ```bash
   ollama run phi3:mini "Hello, how are you?"
   ```

3. Increase timeout in `settings.py`:
   ```python
   OLLAMA_TIMEOUT = 900  # 15 minutes
   ```

4. Use a smaller/faster model:
   ```python
   OLLAMA_MODEL = 'tinyllama'  # Faster but less capable
   ```

### Redis Connection Issues

**Error**: `Error 10061 connecting to localhost:6379`

**Solutions**:
1. Check if Redis is running:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. Disable Redis (use synchronous mode):
   ```python
   # In settings.py
   USE_CELERY = False
   ```

### Video Generation is Slow

**Cause**: Ollama model generation can take 5-15 minutes depending on your hardware

**Solutions**:
1. Use a GPU if available:
   ```bash
   # Check GPU availability
   nvidia-smi
   ```

2. Use a smaller model:
   ```python
   OLLAMA_MODEL = 'phi3:mini'  # Smaller and faster
   ```

3. Monitor progress in Django logs - you'll see:
   - "Generating script..."
   - "Script ready — X scenes"
   - "Processing scene X/Y"
   - etc.

### Out of Memory

**Error**: CUDA out of memory or similar

**Solutions**:
1. Close other GPU applications
2. Reduce inference steps in `video_generator.py`:
   ```python
   num_inference_steps=4  # Reduce from 6
   ```

3. Use CPU mode (slower but works everywhere):
   - Stable Diffusion will automatically use CPU if CUDA not available

## Configuration Options

### In `server/settings.py`:

```python
# Enable/disable async processing
USE_CELERY = True  # False for sync mode

# Ollama settings
OLLAMA_API_URL = 'http://localhost:11434/api/generate'
OLLAMA_MODEL = 'phi3:mini'  # or 'tinyllama', 'llama2', etc.
OLLAMA_TIMEOUT = 600  # seconds

# Celery/Redis (only needed if USE_CELERY=True)
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
```

## Testing

Test video generation via API:

```bash
curl -X POST http://localhost:8000/api/videos/generate/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "Introduction to Python", "lesson_id": 1}'
```

Check status:
```bash
curl http://localhost:8000/api/videos/<task_id>/
```

## Performance Tips

1. **First run is slow**: Model loading takes time. Subsequent generations are faster.
2. **Use SSD**: Store media files on fast storage
3. **GPU recommended**: NVIDIA GPU significantly speeds up image generation
4. **Monitor resources**: Check CPU/GPU/RAM usage during generation

## Common Model Alternatives

| Model | Speed | Quality | RAM Needed |
|-------|-------|---------|------------|
| tinyllama | ⚡⚡⚡ | ⭐⭐ | 2 GB |
| phi3:mini | ⚡⚡ | ⭐⭐⭐ | 4 GB |
| llama2 | ⚡ | ⭐⭐⭐⭐ | 8 GB |
| mistral | ⚡ | ⭐⭐⭐⭐ | 8 GB |

Install alternatives:
```bash
ollama pull tinyllama
ollama pull mistral
```

Then update `settings.py` to use the new model.
