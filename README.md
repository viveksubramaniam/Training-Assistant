# Training-Assistant
A simple AI powered training assistant that connects to your strava account and helps you plan workouts for your goals.

## Features
- AI Coach with personalized daily and weekly plans
- Strava integration for activity syncing
- Goal setting and training progress tracking
- Interactive activity analysis with AI insights

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- AI Service: Python + FastAPI
- Database: PostgreSQL

## Development

### Prerequisites
- Node.js
- Python 3.12+
- Strava API Credentials

### Environment Setup
Create a `.env` file in the root and server directories based on `.env.example`.

### Commands
```bash
# Start frontend
npm run dev

# Start backend
cd server && node index.js

# Start AI service
cd server/ai_service && uvicorn app:app --reload --port 5001
```

---
*Based on a React + Vite template.*
