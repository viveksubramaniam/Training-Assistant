# Run Coach App — Project Roadmap & AI Assistant Guide

> **What this file is:** A comprehensive onboarding document for any AI assistant (Claude, Gemini, etc.) that needs to understand this codebase deeply enough to build new features, debug issues, or extend the system.

---

## 1. Project Summary

**Run Coach App** is an AI-powered running coach that:

1. Connects to a user's **Strava** account via OAuth 2.0
2. Syncs their running activities and performance data
3. Generates personalized **master → weekly → daily** training plans using a LangGraph multi-agent AI pipeline
4. Provides an AI chat interface to modify plans conversationally
5. Delivers per-activity AI analysis (run type classification, effort level, coaching insights)

**Live deployment:** <https://training-assistant.onrender.com/>  
**Demo user:** A pre-seeded demo account (Strava ID `999999999`) lets users explore without connecting Strava.

---

## 2. Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend      │────▶│   Backend (API)  │────▶│  Python AI Service  │
│   React + Vite  │     │   Node/Express   │     │  FastAPI + LangGraph│
│   Tailwind CSS  │     │   Port 3000      │     │  Port 5001          │
│   Port 5173     │     │                  │     │                     │
└─────────────────┘     └────────┬─────────┘     └─────────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │   PostgreSQL     │
                        │   (Supabase)     │
                        └──────────────────┘
```

### Service Responsibilities

| Service | Tech | Role |
|---------|------|------|
| **Frontend** (`frontend/`) | React 19, Vite 7, Tailwind CSS 4, Recharts, Leaflet | SPA UI — login, activity list, detail views (maps + charts), daily/weekly/calendar plan views, profile, AI chat widget |
| **Backend** (`backend/`) | Node.js 20, Express 4, pg, JWT, cookie-session | REST API — Strava OAuth, activity CRUD, AI summary CRUD, goal management, plan caching, proxies AI requests to python-server |
| **AI Service** (`python-server/`) | Python 3.11, FastAPI, LangGraph, LangChain, Google Gemini (via OpenRouter) | Multi-agent plan orchestration, chat-based plan modification, per-activity coaching analysis |
| **Database** | PostgreSQL 15+ (Supabase), pgvector extension | All persistent state — users, activities, streams, AI summaries, embeddings, goals, plans, coach conversations |

---

## 3. Directory & File Map

```
run-coach-app/
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── App.jsx                # Root component — auth, routing, sync logic
│   │   ├── main.jsx               # ReactDOM entry point
│   │   ├── index.css              # Global styles
│   │   ├── App.css                # App-specific styles
│   │   ├── DailyPlanTab.jsx       # Today's workout view (3 options: recommended/option_2/option_3)
│   │   ├── WeeklyPlanTab.jsx      # 7-day plan calendar view
│   │   ├── CalendarPage.jsx       # Full calendar with weekly plan data
│   │   ├── ProfilePage.jsx        # User profile, goal editor, logout
│   │   ├── ActivityDetailPage.jsx # Activity detail — map, pace/HR charts, AI summary
│   │   ├── GoalEditorModal.jsx    # Modal for setting/editing training goals
│   │   ├── TrainingPlanLoader.jsx # Loading animation during plan generation
│   │   ├── config/
│   │   │   └── api.js             # API_BASE_URL config (empty in dev → Vite proxy, full URL in prod)
│   │   └── components/
│   │       ├── LoginButton.jsx    # Strava OAuth login button
│   │       ├── ChatWidget.jsx     # AI coach chat (floating widget)
│   │       ├── ConfirmationModal.jsx
│   │       ├── PlanCreatingLoader.jsx
│   │       └── Calendar/          # Calendar sub-components (3 files)
│   ├── vite.config.js             # Vite config — React plugin, Tailwind plugin, /api proxy → localhost:3000
│   ├── index.html                 # HTML entry point
│   └── package.json               # React 19, Vite 7, Tailwind 4, Recharts, Leaflet, lucide-react
│
├── backend/                       # Node.js API
│   ├── index.js                   # Express app — CORS, session, route mounting
│   ├── config/
│   │   └── strava.js              # Strava OAuth config (client ID/secret, redirect URI, scopes)
│   ├── middleware/
│   │   └── auth.js                # JWT auth middleware, Strava token refresh logic
│   ├── routes/
│   │   ├── strava.js              # OAuth login/callback, demo-login, /api/user, /api/logout
│   │   ├── activities.js          # GET/POST activities, sync from Strava
│   │   ├── analysis.js            # AI summary generation for individual activities
│   │   ├── coach.js               # /sync, /regenerate, /daily-plan, /weekly-plan, /master-plan, /chat, /streak
│   │   └── goals.js               # CRUD for training goals
│   ├── db/
│   │   ├── index.js               # Database abstraction layer (adapter pattern: json or postgres)
│   │   ├── postgres.js            # PostgreSQL adapter — ~1070 lines, all DB operations
│   │   ├── json.js                # JSON file adapter (legacy/dev fallback)
│   │   ├── schema.sql             # Full PostgreSQL schema (14 tables, indexes, triggers)
│   │   ├── seed_demo_user.sql     # Demo user seed data (Strava ID 999999999)
│   │   ├── training_plans.sql     # Training plan seed data
│   │   └── run_seed.js            # Script to run seed SQL
│   ├── Dockerfile                 # Node 20 Alpine, port 3000
│   └── package.json               # Express 4, pg, JWT, axios, cors, cookie-session
│
├── python-server/                 # AI Service
│   ├── app.py                     # FastAPI app — /health, /orchestrate, /chat, /analyze endpoints
│   ├── langgraph_agents.py        # LangGraph multi-agent orchestration (891 lines)
│   │                              #   PlanState (typed dict), call_llm(), orchestrator_node(),
│   │                              #   master_planning_agent(), weekly_planner(), daily_planner(),
│   │                              #   build_orchestrator_graph(), orchestrate_plans(), modify_plan_from_chat()
│   ├── requirements.txt           # fastapi, uvicorn, langgraph, langchain, langchain-google-genai, httpx
│   ├── Dockerfile                 # Python 3.11 slim, uvicorn on $PORT (default 5001)
│   ├── Procfile                   # For Railway deployment
│   ├── nixpacks.toml              # Railway nixpacks config
│   └── .env.example               # LLM_ENDPOINT, PORT, CORS_ORIGINS, OPENAI_API_KEY, MODEL_NAME
│
├── nginx.conf                     # Production static file serving config (SPA routing, gzip, caching)
├── README.md                      # Basic project readme
└── .gitignore
```

---

## 4. Database Schema (PostgreSQL / Supabase)

**Schema file:** `backend/db/schema.sql`

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Strava profiles + OAuth tokens | `strava_id` (PK), `access_token`, `refresh_token`, `expires_at` |
| `activities` | Core activity data from Strava | `strava_activity_id` (PK), `user_id` (FK), distance, pace, HR, location, flags |
| `activity_details` | Extended data (fetched on-demand) | `activity_id` (PK/FK), polyline, zones, best_efforts, splits, laps (all JSONB) |
| `activity_streams` | Time-series data for charts | `activity_id` + `stream_type` (unique), data as JSONB array |
| `activity_laps` | Normalized lap data | Per-lap metrics (speed, HR, elevation) |
| `ai_summaries` | Versioned AI coaching analysis | run_type, relative_effort, summary_text, highlight, suggestion |
| `activity_embeddings` | Vector embeddings (pgvector) | 1536-dim vector, cosine similarity index (HNSW) |
| `user_goals` | Training goals | goal_type (10K, Half, Marathon), target_date, weekly_target_distance, preferred_workout_days |
| `master_plans` | Long-term training plans | weeks (JSONB), total_weeks, peak_week, taper_start_week |
| `weekly_plan_cache` | 7-day plan cache | mon–sun columns (JSONB), per user + week_start |
| `daily_plan_cache` | Daily plan cache | plan_data JSONB with `recommended`, `option_2`, `option_3` (v2.1 structure) |
| `activity_points` | Gamification points | points, reason |
| `coach_conversations` | Chat history | role, message, context (JSONB) |

---

## 5. API Endpoints

### Backend (Node.js — port 3000)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/strava/login` | No | Initiate Strava OAuth flow |
| GET | `/api/auth/strava/callback` | No | Handle OAuth callback, create JWT |
| POST | `/api/auth/demo-login` | No | Log in as demo user (ID: 999999999) |
| GET | `/api/user` | Bearer JWT | Get current user info + streak |
| POST | `/api/logout` | No | Clear session |
| GET | `/api/activities` | Bearer JWT | List user activities |
| GET | `/api/activities/:id` | Bearer JWT | Get activity detail (fetches from Strava on-demand) |
| POST | `/api/activities/sync` | Bearer JWT | Sync activities from Strava |
| POST | `/api/activities/:id/analyze` | Bearer JWT | Generate AI summary for activity |
| GET | `/api/goals` | Bearer JWT | Get user goals |
| POST | `/api/goals` | Bearer JWT | Create/update goal |
| DELETE | `/api/goals/:id` | Bearer JWT | Delete goal |
| POST | `/api/coach/sync` | Bearer JWT | Trigger background plan generation |
| POST | `/api/coach/regenerate` | Bearer JWT | Force-regenerate all plans |
| GET | `/api/coach/daily-plan` | Bearer JWT | Get cached daily plan |
| GET | `/api/coach/weekly-plan` | Bearer JWT | Get cached weekly plan |
| GET | `/api/coach/master-plan` | Bearer JWT | Get master plan |
| GET | `/api/coach/streak` | Bearer JWT | Get activity streak |
| POST | `/api/coach/chat` | Bearer JWT | Chat with AI coach |

### AI Service (Python — port 5001)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/orchestrate` | LangGraph plan orchestration (master → weekly → daily) |
| POST | `/chat` | Chat with coach (can modify plans) |
| POST | `/analyze` | Generate AI coaching summary for a single activity |

---

## 6. Key Data Flows

### 6a. Authentication Flow
```
User clicks "Login with Strava"
  → Frontend redirects to /api/auth/strava/login
  → Backend redirects to Strava OAuth authorize URL
  → User authorizes on Strava
  → Strava redirects to /api/auth/strava/callback with code
  → Backend exchanges code for tokens, saves user to DB
  → Backend generates JWT, redirects to frontend with ?token=JWT
  → Frontend stores JWT in localStorage, uses for all API calls
```

### 6b. Activity Sync Flow
```
App.jsx fetchInitialData() on mount:
  → GET /api/user (validate JWT, get profile)
  → GET /api/activities (load cached activities)
  → POST /api/coach/sync (trigger background plan generation)

Sync button pressed:
  → POST /api/activities/sync
  → Backend calls Strava API with user's access_token (auto-refreshes if expired)
  → Saves new activities to DB
  → Returns updated activity list
```

### 6c. Plan Generation Flow (LangGraph Orchestration)
```
POST /api/coach/sync (backend)
  → triggerOrchestration() fires async
  → Backend gathers: goal, masterPlan, weeklyPlan, recentActivities
  → POST to python-server /orchestrate

Python orchestrate_plans():
  → Creates PlanState
  → Runs LangGraph: orchestrator_node decides routing
  → Cascade: master_planning_agent → weekly_planner → daily_planner
  → Each agent calls LLM (OpenRouter / local) with detailed prompts
  → Returns { masterPlan, weeklyPlan, dailyPlan }

Backend saves results:
  → saveMasterPlan() if new master plan
  → saveWeeklyPlanCache() for the current week
  → cacheDailyPlan() for today
```

### 6d. Daily Plan Structure (v2.1)
```json
{
  "recommended": {
    "title": "Easy Recovery Run",
    "description": "Light jog focusing on recovery",
    "type": "easy",
    "distance": "5km",
    "targetPace": "6:30/km",
    "predictedTime": "32:30",
    "warmup": "5 min walk",
    "cooldown": "5 min walk + stretching"
  },
  "option_2": { ... },
  "option_3": { ... }
}
```

### 6e. Chat Flow
```
User sends message in ChatWidget
  → POST /api/coach/chat { message }
  → Backend gathers context (goal, masterPlan, weeklyPlan, dailyPlan, recent activities)
  → POST to python-server /chat
  → Python LLM determines: is this a plan modification or general question?
  → If plan modification → runs modify_plan_from_chat() → returns updated plans
  → If general → returns coaching response
  → Backend saves any plan updates to DB
  → Frontend displays response + refreshes plans if modified
```

---

## 7. Environment Variables

### Frontend (`frontend/.env`)
```
VITE_API_URL=                     # Empty for dev (Vite proxy), full backend URL for prod
```

### Backend (`backend/.env`)
```
STRAVA_CLIENT_ID=<strava-app-id>
STRAVA_CLIENT_SECRET=<strava-secret>
SESSION_SECRET=<random-hex>
PORT=3000
AI_SERVICE_URL=http://localhost:5001        # Python server URL
DATABASE_TYPE=postgres                       # "postgres" or "json"
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require
FRONTEND_URL=http://localhost:5173           # For OAuth callback redirect
API_URL=http://localhost:3000                # For Strava redirect URI construction
CORS_ORIGINS=http://localhost:5173           # Comma-separated allowed origins
NODE_ENV=development                         # "production" for secure cookies
```

### Python Server (`python-server/.env`)
```
LLM_ENDPOINT=http://localhost:1234/v1/chat/completions   # Local LLM or leave for OpenRouter
OPENAI_API_KEY=<openrouter-api-key>
MODEL_NAME=<model-for-planning>              # e.g. google/gemini-flash-1.5
CHAT_MODEL_NAME=<model-for-chat>             # Can be different/cheaper model
PORT=5001
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 8. Local Development Setup

```bash
# 1. Clone and navigate
cd run-coach-app

# 2. Frontend
cd frontend
cp .env.example .env              # Leave VITE_API_URL empty for proxy
npm install
npm run dev                       # → http://localhost:5173

# 3. Backend (separate terminal)
cd backend
cp .env.example .env              # Fill in Strava credentials + DATABASE_URL
npm install
npm run dev                       # → http://localhost:3000 (uses nodemon)

# 4. Python AI Service (separate terminal)
cd python-server
cp .env.example .env              # Fill in OPENAI_API_KEY + MODEL_NAME
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py                     # → http://localhost:5001

# 5. Database
# Option A: Use Supabase (already configured in .env)
# Option B: Local PostgreSQL — run schema.sql, then seed_demo_user.sql
```

**Dev proxy:** Vite proxies `/api/*` to `localhost:3000` (configured in `vite.config.js`), so the frontend can use relative URLs.

---

## 9. Deployment

Currently deployed on:
- **Frontend:** Vercel (static build, `VITE_API_URL` set to backend URL)
- **Backend:** Railway (Docker, `Dockerfile` in `backend/`)
- **AI Service:** Railway (Docker, `Dockerfile` in `python-server/`)
- **Database:** Supabase (managed PostgreSQL)

The `nginx.conf` is available for self-hosted/Docker Compose static serving.

---

## 10. Authentication & Security

- **Strava OAuth 2.0** with scopes: `read,activity:read_all,profile:read_all`
- **JWT tokens** (24h expiry) issued after OAuth callback, stored in `localStorage`
- **Bearer token auth** on all protected endpoints
- **Strava token auto-refresh** in `middleware/auth.js` — 5-minute buffer before expiry
- **Cookie-session** configured but JWT is the primary auth mechanism
- **Demo user** bypass: `/api/auth/demo-login` returns a JWT for Strava ID `999999999`

---

## 11. Current State & Known Issues

### What Works
- ✅ Strava OAuth login + demo user login
- ✅ Activity syncing from Strava (summary + on-demand detail fetch)
- ✅ Activity detail view with interactive map (Leaflet), pace/HR charts (Recharts)
- ✅ AI activity analysis (run type, effort, highlights, suggestions)
- ✅ Goal setting (10K, Half Marathon, Marathon with target dates)
- ✅ Master plan generation via LangGraph orchestration
- ✅ Weekly plan generation (procedural from master plan)
- ✅ Daily plan with 3 options (recommended, option_2, option_3)
- ✅ AI chat widget for modifying plans
- ✅ Activity streak tracking
- ✅ Logout functionality

### Striive v2 Design System (in progress — see `striive_v2_plan.md`)
The frontend is being migrated to a premium-athletic design system ("Striive v2"). **Already migrated:**
- ✅ `DailyPlanTab.jsx` — Home / Today's plan
- ✅ `CalendarPage.jsx` — Plan / Month grid
- ✅ `ActivityDetailPage.jsx` — Activity detail with map
- ✅ `App.jsx → ActivityListPage` — Activity list with sparkline
- ✅ `App.jsx → LoginScreen` — Editorial login
- ✅ `App.jsx → BottomNav` — Flat bottom nav with elevated coach button
- ✅ `index.css` — Full OKLCH design token set

**Not yet migrated (old `#f97415` / slate / glass scheme):**
- ❌ `ProfilePage.jsx` — still uses lucide-react, glass-card, 2-tab layout
- ❌ `components/ChatWidget.jsx` — still uses emerald/teal/rose Tailwind, overlay pattern
- ❌ `GoalEditorModal.jsx` — still uses `#f97415`, `bg-white/5`, slate colors
- ❌ `components/ConfirmationModal.jsx` — still uses `#1e293b`, old primary color

### Known Issues / Past Bugs
- 🐛 Daily plan saving was calling AI service twice — fixed with frontend guard logic
- 🐛 Master plan wasn't saving during `/sync` orchestration — fixed
- 🐛 Strava token refresh had edge cases with `ECONNRESET` — addressed with connection pooling
- 🐛 LLM 404 errors from OpenRouter — fixed by correcting model name/endpoint config
- ⚠️ Lots of `console.log` debug statements throughout — could be cleaned up
- ⚠️ No automated tests exist anywhere in the project
- ⚠️ Error handling is inconsistent — some endpoints return stack traces

---

## 12. What Needs Building Next (Roadmap)

### 🎨 Active: Striive v2 Frontend Redesign
See `striive_v2_plan.md` for the full spec. Four tasks pending (can be done in parallel):
1. **ProfilePage v2** — user row, goal hero with phase progress bar, fitness snapshot, settings list
2. **ChatWidget v2** — full-screen page route at `#/coach`, v2 bubble styling, plan-updated card
3. **GoalEditorModal + ConfirmationModal** — token swap to CSS vars (`--color-ignite`, `--color-surface`, etc.)
4. **App.jsx** — wire `#/coach` as a full route, update BottomNav center button

### 🔴 High Priority

1. **Testing Infrastructure**
   - No tests exist. Add unit tests for backend routes (Jest/Vitest), DB operations, and AI service endpoints (pytest).
   - Add integration tests for the sync → plan generation flow.
   - Add frontend component tests (React Testing Library).

2. **Error Handling & Observability**
   - Replace `console.log` with structured logging (e.g., pino for Node, Python's logging module).
   - Add proper error boundaries in React.
   - Centralized error handling middleware in Express.
   - Add request tracing / correlation IDs across services.

3. **Security Hardening**
   - Move secrets out of committed `.env` files (the backend `.env` has real credentials committed!).
   - Add `.env` to `.gitignore` properly, rotate exposed Strava/Supabase credentials.
   - Rate limiting on auth endpoints.
   - Input validation/sanitization on all endpoints.

### 🟡 Medium Priority

4. **Workout Completion Tracking**
   - The daily plan has "Mark as Completed" UI but needs backend support.
   - Match completed Strava activities to planned workouts.
   - Track adherence rate and feed back into AI planning.

5. **Plan Quality & Personalization**
   - Improve LLM prompts based on actual user feedback.
   - Use activity embeddings (pgvector is set up but not actively used) for semantic search.
   - Auto-adjust plans based on missed workouts or overtraining signals.

6. **UI/UX Polish**
   - Mobile responsiveness review (app is designed mobile-first but may have edge cases).
   - Offline support / PWA capabilities.
   - Push notifications for upcoming workouts.
   - Better loading states and skeleton screens.
   - Dark mode (partially styled but not complete).

7. **Performance**
   - Cache Strava API responses more aggressively.
   - Lazy load heavy components (maps, charts).
   - Optimize DB queries (some N+1 patterns in activity listing).
   - Consider WebSocket for real-time plan updates instead of polling.

### 🟢 Nice to Have

8. **Social Features**
   - Share training plans with friends.
   - Compare performance with other users.

9. **Advanced Analytics**
   - Training load / fitness fatigue modeling (CTL/ATL/TSB).
   - Injury risk prediction based on training patterns.
   - Race time predictions.

10. **Multi-Sport Support**
    - Currently focused on running. Schema supports `sport_type` but UI/AI don't.
    - Cycling, swimming, triathlon training.

---

## 13. Conventions & Patterns

### Code Style
- **Frontend:** Functional React components, hooks-only, no class components. State managed via `useState`/`useEffect` at component level (no Redux/Zustand).
- **Backend:** ES Modules (`"type": "module"`), async/await throughout, adapter pattern for DB (swap JSON ↔ Postgres).
- **Python:** Type hints (PlanState TypedDict), Pydantic models for request validation, async FastAPI endpoints.

### Naming
- Database: `snake_case` for table/column names
- JavaScript: `camelCase` for variables/functions, `PascalCase` for React components
- Python: `snake_case` for functions, `PascalCase` for classes
- API routes return `camelCase` JSON

### Branching
- Single-branch workflow (main). No CI/CD pipeline currently set up.

### Key Constants
- Demo user Strava ID: `999999999`
- JWT expiry: 24 hours
- Strava token refresh buffer: 5 minutes
- Session max age: 24 hours
- Daily plan structure version: v2.1 (requires `recommended`, `option_2`, `option_3` keys)

---

## 14. LLM / AI Agent Details

### LangGraph Architecture
The AI service uses a **stateful graph** with typed state (`PlanState`):

```
START → orchestrator_node → [route decision]
                              ├→ master_planning_agent → should_generate_weekly → weekly_planner → daily_planner → prepare_result → END
                              ├→ weekly_planner → daily_planner → prepare_result → END
                              ├→ daily_planner → prepare_result → END
                              └→ prepare_result → END (if all plans cached)
```

### LLM Configuration
- **Provider:** OpenRouter API (or local LLM via LM Studio at `localhost:1234`)
- **Planning Model:** Configurable via `MODEL_NAME` env var (e.g., `google/gemini-flash-1.5`)
- **Chat Model:** Configurable via `CHAT_MODEL_NAME` (can be different for cost optimization)
- **System prompts:** Embedded in each agent function in `langgraph_agents.py`
- **Response format:** All agents return JSON, parsed with `parse_json_response()` which handles markdown code fences

### Prompt Engineering Notes
- Master plan prompt includes user's goal type, target date, weekly distance target, preferred workout days, and recent activity history
- Weekly planner gets the master plan week structure and adapts it
- Daily planner generates 3 options where `recommended` must match the weekly plan
- Chat agent receives full context (goal, master, weekly, daily plans) and determines if response is conversational or a plan modification

---

## 15. Quick Reference: How to Add a New Feature

### Adding a new backend API endpoint:
1. Create or edit a route file in `backend/routes/`
2. Add DB operations in `backend/db/postgres.js` and export via `backend/db/index.js`
3. Mount the route in `backend/index.js`
4. Add auth middleware (`requireAuth` from `middleware/auth.js`)

### Adding a new frontend page:
1. Create a new `.jsx` file in `frontend/src/`
2. Add the hash route to the `parseHash()` switch in `App.jsx`
3. Add the nav item to `BottomNav` in `App.jsx` if it needs a bottom nav entry
4. **Use Striive v2 design tokens** — CSS variables (`var(--color-bg)`, `var(--color-ignite)`, etc.) defined in `index.css`, not hardcoded hex colors or Tailwind slate/glass utilities. See `striive_v2_plan.md` for the full token reference.
5. Use `font-display` class for Space Grotesk, `mono-data` or `font-mono` for JetBrains Mono data values

### Adding a new AI capability:
1. Define the new agent function in `python-server/langgraph_agents.py`
2. Add it as a node in `build_orchestrator_graph()`
3. Create the FastAPI endpoint in `python-server/app.py`
4. Add the backend proxy route in `backend/routes/coach.js`
5. Wire up the frontend to call the backend endpoint

### Modifying the database schema:
1. Add SQL to `backend/db/schema.sql`
2. Add the corresponding functions in `backend/db/postgres.js`
3. Export via `backend/db/index.js`
4. Run the migration manually on Supabase (no migration tool currently)

---

## 16. File Sizes (for context on complexity)

| File | Lines | Notes |
|------|-------|-------|
| `backend/db/postgres.js` | 1,071 | Largest backend file — all DB operations |
| `python-server/langgraph_agents.py` | 891 | Multi-agent orchestration, heavy prompt engineering |
| `backend/routes/coach.js` | 442 | Plan management, sync, chat proxy |
| `python-server/app.py` | 399 | FastAPI endpoints + request models |
| `backend/db/schema.sql` | 369 | Full schema with 14 tables |
| `frontend/src/ActivityDetailPage.jsx` | 318* | Maps, charts, AI summary display |
| `frontend/src/App.jsx` | 355 | Root component with auth + routing |
| `frontend/src/ProfilePage.jsx` | 254* | Profile + goal editor |
| `frontend/src/DailyPlanTab.jsx` | 223* | Today's workout with 3 options |
| `frontend/src/CalendarPage.jsx` | 219* | Calendar view |

*Approximate, includes inline styles (Tailwind classes).
