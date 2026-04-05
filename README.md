# JapanApp - Development Setup

A full-stack Japanese learning application built with React + FastAPI.

## Project Structure

```
japanapp/
├── frontend/          # React + Vite + Tailwind CSS frontend
├── backend/           # Python FastAPI backend
└── project.md         # Product Requirements Document
```

## Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- Docker (optional, for Ollama)

## Backend Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Activate virtual environment
```bash
source venv/bin/activate
```

### 3. Copy environment variables
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Start the backend server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

## Frontend Setup

### 1. Navigate to frontend directory
```bash
cd frontend
```

### 2. Copy environment variables
```bash
cp .env.example .env
# Edit .env with your API base URL
```

### 3. Install dependencies
```bash
pnpm install
```

### 4. Start the development server
```bash
pnpm dev
```

The frontend will be available at `http://localhost:5173`

## Development Workflow

### Terminal 1 - Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Terminal 2 - Frontend
```bash
cd frontend
pnpm dev
```

### Terminal 3 - Ollama (if using AI features)
```bash
# Ollama should run as a service
# Download from https://ollama.ai
ollama run mistral
```

## Environment Variables

### Backend (.env)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service key
- `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL` - Model to use (default: mistral)
- `JWT_SECRET` - Secret for JWT tokens

### Frontend (.env)
- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## Tech Stack

### Frontend
- React 19
- Vite 8
- Tailwind CSS 4
- React Router 7
- React Query 5
- Zustand 5
- Zod 4
- Axios (latest)

### Backend
- FastAPI 0.115
- Uvicorn 0.35
- Supabase Python client
- Pydantic 2
- Ollama Python client
- Python-JOSE (Auth)

## Database Schema

See `project.md` for the complete database schema and design decisions.

## Building for Production

### Backend
```bash
# Build Docker image
docker build -t japanapp-backend .

# Run with Docker
docker run -p 8000:8000 --env-file .env japanapp-backend
```

### Frontend
```bash
pnpm build
# Output in dist/ directory
```

## Contributing

Follow the architecture principles outlined in `project.md`:
- All frontend requests go through the FastAPI backend
- Database access is controlled by the backend
- Supabase is used as a managed PostgreSQL database with RLS
- Ollama runs locally and is called exclusively by the backend

## License

Personal project for learning purposes.
