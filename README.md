# AI-powered-Learning-platform

## Run With Docker

### Prerequisites

- Docker Desktop installed and running
- Ports `5173` (frontend), `8000` (backend), and `3307` (MySQL) available

### 1) Build and start all services

From the repository root:

```bash
docker compose up --build
```

Services started:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api`
- MySQL: `localhost:3307`

### 2) Start in detached mode

```bash
docker compose up -d --build
```

### 3) Stop everything

```bash
docker compose down
```

### 4) Stop and remove DB volume (full reset)

```bash
docker compose down -v
```

### 5) View logs

```bash
docker compose logs -f
```

Or a single service:

```bash
docker compose logs -f server
docker compose logs -f frontend
docker compose logs -f db
```

### 6) Run backend commands inside container

```bash
docker compose exec server python manage.py createsuperuser
docker compose exec server python manage.py shell
```

## Notes

- The backend uses values from `server/.env`, with Docker overrides for DB host/credentials.
- For Docker Compose, MySQL runs in the `db` service and Django connects using `DB_HOST=db`.
- If you update Python or Node dependencies, rebuild images:

```bash
docker compose up --build
```