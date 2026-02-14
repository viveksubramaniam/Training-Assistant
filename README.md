# Training-Assistant
A simple AI powered training assistant that connects to your strava account and helps you plan workouts for your goals.

## Features
- AI Coach with personalized daily and weekly plans
- Strava integration for activity syncing, plans based on current fitness level. 
- Goal setting and training progress tracking (10k, Half Marathon, Marathon)
- Interactive activity analysis with AI insights (Talk to your AI coach and get insights based on curent training load)

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- AI Service: Python + FastAPI
- Database: PostgreSQL

## Development and Setup

### Prerequisites
- Node.js
- Python 3.12+
- Strava API Credentials for your own server

### Environment Setup
Create a `.env` file in the root and server directories based on `.env.example`.

### Commands
```bash
# Start frontend
npm run dev

# Start backend
cd server && node index.js


## Demo and Usage 
To try out the hosted Web application and see how it works, visit: https://training-assistant.onrender.com/ 
NOTE: Use the demo user to just quickly see a demo if you not wish to log in with strava / dont have much activity history. 
---
*Based on a React + Vite template.*
