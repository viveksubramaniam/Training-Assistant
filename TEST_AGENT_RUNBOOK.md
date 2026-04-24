# TEST AGENT RUNBOOK — Run Coach App

> **Purpose:** A comprehensive, executable test plan covering every feature, API endpoint, and user flow in the Run Coach App. Designed so that any AI agent or human tester can systematically verify the entire application.

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Service Health Checks](#2-service-health-checks)
3. [Authentication & Session Tests](#3-authentication--session-tests)
4. [Activity Management Tests](#4-activity-management-tests)
5. [AI Analysis Tests](#5-ai-analysis-tests)
6. [Goal Management Tests](#6-goal-management-tests)
7. [Plan Orchestration Tests](#7-plan-orchestration-tests)
8. [AI Chat Tests](#8-ai-chat-tests)
9. [Frontend UI / E2E Tests](#9-frontend-ui--e2e-tests)
10. [Python AI Service Direct Tests](#10-python-ai-service-direct-tests)
11. [Database Integrity Tests](#11-database-integrity-tests)
12. [Error Handling & Edge Cases](#12-error-handling--edge-cases)
13. [Performance & Timeout Tests](#13-performance--timeout-tests)
14. [Security Tests](#14-security-tests)

---

## 1. Test Environment Setup

### Prerequisites

| Requirement | Details |
|---|---|
| Node.js | v20.x |
| Python | 3.11+ |
| PostgreSQL | 15+ (or Supabase connection) |
| Strava API Credentials | Client ID + Secret (for live Strava tests only) |
| OpenRouter/LLM API Key | For AI service tests |

### Startup Checklist

```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev
# Expected: "Server running on port 3000"

# Terminal 2: Python AI Service
cd python-server && source venv/bin/activate && python app.py
# Expected: "Uvicorn running on http://0.0.0.0:5001"

# Terminal 3: Frontend
cd frontend && npm install && npm run dev
# Expected: Vite dev server on http://localhost:5173
```

### Test Data

- **Demo user Strava ID:** `999999999`
- **Demo JWT:** Obtain via `POST /api/auth/strava/demo-login`
- All tests below that require auth should use `Authorization: Bearer <JWT>` header

### Obtaining a Test JWT

```bash
# Get a demo JWT for all subsequent tests
curl -X POST http://localhost:3000/api/auth/strava/demo-login
# Expected: { "token": "<jwt-string>" }
# Save this token as $TOKEN for all subsequent requests
export TOKEN="<paste-jwt-here>"
```

---

## 2. Service Health Checks

### TEST-HEALTH-01: Backend responds

```bash
curl http://localhost:3000/api/user
```

| Check | Expected |
|---|---|
| Status | `401` (no auth provided) |
| Body | `{ "error": "Not authenticated" }` |

### TEST-HEALTH-02: Python AI service health

```bash
curl http://localhost:5001/health
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.status | `"healthy"` |
| Body.service | `"ai-coach"` |
| Body.version | `"2.0.0"` |
| Body.timestamp | Valid ISO 8601 timestamp |

### TEST-HEALTH-03: Frontend serves

```bash
curl -s http://localhost:5173 | head -20
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body | HTML containing `<div id="root">` |

### TEST-HEALTH-04: Vite proxy works

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/user
```

| Check | Expected |
|---|---|
| Status | `401` (proxied to backend, no auth) |

---

## 3. Authentication & Session Tests

### TEST-AUTH-01: Strava OAuth login redirect

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/api/auth/strava/login
```

| Check | Expected |
|---|---|
| Status | `302` redirect |
| Redirect URL | Starts with `https://www.strava.com/oauth/authorize?` |
| URL params | Contains `client_id`, `redirect_uri`, `scope=read,activity:read_all,profile:read_all` |

### TEST-AUTH-02: Demo login succeeds

```bash
curl -X POST http://localhost:3000/api/auth/strava/demo-login
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.token | Non-empty JWT string |
| JWT payload (decode) | Contains `stravaId: 999999999`, `isDemo: true`, `name` field |
| JWT expiry | ~24 hours from now |

### TEST-AUTH-03: Demo login — user not seeded

> Only testable if demo user is deleted from DB

| Check | Expected |
|---|---|
| Status | `500` |
| Body.error | `"Demo user not found. Please run the seed script first."` |

### TEST-AUTH-04: Get current user (valid token)

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/user
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.name | Non-empty string (demo user's name) |
| Body.isDemo | `true` |
| Body.streak | Number ≥ 0 |
| Body.lastSyncTime | Timestamp or null |
| Body.profile | String (profile URL) or null |

### TEST-AUTH-05: Get user — no token

```bash
curl http://localhost:3000/api/user
```

| Check | Expected |
|---|---|
| Status | `401` |
| Body.error | `"Not authenticated"` |

### TEST-AUTH-06: Get user — invalid/expired token

```bash
curl -H "Authorization: Bearer invalid.jwt.token" http://localhost:3000/api/user
```

| Check | Expected |
|---|---|
| Status | `401` |
| Body.error | `"Invalid token"` |

### TEST-AUTH-07: Logout

```bash
curl -X POST http://localhost:3000/api/logout
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |

---

## 4. Activity Management Tests

### TEST-ACT-01: List activities (authenticated)

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/activities
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body | JSON array |
| Each item | Has `id`, `name`, `distance`, `start_date`, `sport_type` |
| Array length | ≥ 0 (demo user should have seeded activities) |

### TEST-ACT-02: List activities — no auth

```bash
curl http://localhost:3000/api/activities
```

| Check | Expected |
|---|---|
| Status | `401` |

### TEST-ACT-03: Get single activity detail (cached)

```bash
# Use an activity ID from TEST-ACT-01
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/activities/<ACTIVITY_ID>
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.id | Matches requested ID |
| Body.name | Non-empty string |
| Body.distance | Number (meters) |
| Body.moving_time | Number (seconds) |

### TEST-ACT-04: Get activity detail — not found (demo user)

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/activities/99999999999
```

| Check | Expected |
|---|---|
| Status | `404` |
| Body.error | `"Activity not found in demo data."` |

### TEST-ACT-05: Sync activities — demo user (blocked)

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullSync": false}' http://localhost:3000/api/activities/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.count | `0` |
| Body.message | `"Demo mode — sync disabled."` |

### TEST-ACT-06: Sync activities — real user (requires Strava credentials)

> Requires a real Strava-authenticated JWT. Skip if testing demo only.

```bash
curl -X POST -H "Authorization: Bearer $REAL_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullSync": false}' http://localhost:3000/api/activities/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.count | Number ≥ 0 |
| Body.total | Number ≥ Body.count |
| Body.lastSyncTime | Timestamp |

### TEST-ACT-07: Full sync

```bash
curl -X POST -H "Authorization: Bearer $REAL_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullSync": true}' http://localhost:3000/api/activities/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.count | ≥ previous sync count (re-fetches all from epoch) |

---

## 5. AI Analysis Tests

### TEST-ANALYSIS-01: Get cached analysis (none exists)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/activities/<ACTIVITY_ID>/analysis
```

| Check | Expected |
|---|---|
| Status | `404` (if no analysis cached) OR `200` (if previously generated) |
| Body (404) | `{ "error": "Summary not found" }` |
| Body (200) | Contains `runType`, `summary`, `highlight`, `suggestion`, `relativeEffort` |

### TEST-ANALYSIS-02: Generate AI analysis

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "activityData": {
      "id": "<ACTIVITY_ID>",
      "name": "Morning Run",
      "start_date": "2026-02-20T07:00:00Z",
      "distance": 5000,
      "moving_time": 1800,
      "average_speed": 2.78,
      "average_heartrate": 145,
      "total_elevation_gain": 50,
      "type": "Run"
    }
  }' http://localhost:3000/api/activities/<ACTIVITY_ID>/analysis
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.activityId | Matches `<ACTIVITY_ID>` |
| Body.text | Non-empty string (JSON with coaching analysis) |
| Body.status | `"success"` |
| Body.model | Non-empty string |
| Body.generatedAt | ISO 8601 timestamp |

### TEST-ANALYSIS-03: Regenerate analysis (new version)

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"activityData": { "id": "<ACTIVITY_ID>", "name": "Run", "start_date": "2026-02-20", "distance": 5000, "moving_time": 1800, "average_speed": 2.78, "average_heartrate": 145, "total_elevation_gain": 50, "type": "Run" }}' \
  http://localhost:3000/api/activities/<ACTIVITY_ID>/analysis/regenerate
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body | New version of analysis |

### TEST-ANALYSIS-04: Regenerate — max versions reached

> Run TEST-ANALYSIS-03 three times, then try again

| Check | Expected |
|---|---|
| Status | `400` |
| Body.error | `"Maximum 3 versions reached"` |

### TEST-ANALYSIS-05: Select analysis version

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"versionNumber": 1}' \
  http://localhost:3000/api/activities/<ACTIVITY_ID>/analysis/select
```

| Check | Expected |
|---|---|
| Status | `200` |

### TEST-ANALYSIS-06: Delete analysis

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/activities/<ACTIVITY_ID>/analysis
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |

### TEST-ANALYSIS-07: AI service unreachable

> Stop the Python server, then try to generate analysis

| Check | Expected |
|---|---|
| Status | `503` |
| Body.error | Contains `"AI service unavailable"` |

---

## 6. Goal Management Tests

### TEST-GOAL-01: Get goal — no goal set

> Ensure user has no active goal first

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/goals
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.hasGoal | `false` |

### TEST-GOAL-02: Create goal

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"goalType": "half_marathon", "targetDate": "2026-06-01", "weeklyTarget": 40, "preferredDays": ["monday", "wednesday", "friday", "saturday"]}' \
  http://localhost:3000/api/goals
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.hasGoal | `true` |
| Body.goal.type | `"half_marathon"` |
| Body.goal.targetDate | `"2026-06-01"` |
| Body.goal.weeklyTarget | `40` |
| Body.goal.preferredDays | Array of 4 days |
| Body.goal.id | Numeric ID |

### TEST-GOAL-03: Create goal — missing required field

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{}' http://localhost:3000/api/goals
```

| Check | Expected |
|---|---|
| Status | `400` |
| Body.error | `"Goal type required"` |

### TEST-GOAL-04: Get goal — has active goal

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/goals
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.hasGoal | `true` |
| Body.goal | Object with `id`, `type`, `targetDate`, `weeklyTarget`, `preferredDays`, `createdAt` |
| Body.masterPlan | Object or `null` |

### TEST-GOAL-05: Update goal

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"goalType": "marathon", "targetDate": "2026-09-15", "weeklyTarget": 60}' \
  http://localhost:3000/api/goals/<GOAL_ID>
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.goal.type | `"marathon"` |

### TEST-GOAL-06: Update goal — wrong user

> Use a goal ID that belongs to a different user

| Check | Expected |
|---|---|
| Status | `404` |
| Body.error | `"Goal not found"` |

### TEST-GOAL-07: Complete goal

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/goals/<GOAL_ID>/complete
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.goal | Completed goal object |

### TEST-GOAL-08: Get goal history

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/goals/history
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body | Array of completed goals |

### TEST-GOAL-09: Delete goal

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/goals/<GOAL_ID>
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |

---

## 7. Plan Orchestration Tests

### TEST-PLAN-01: Sync / trigger orchestration — no goal

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.status | `"no_goal"` |
| Body.message | `"No active goal found"` |

### TEST-PLAN-02: Sync — triggers plan generation

> Ensure user has an active goal but no cached plans

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.status | `"syncing"` or `"ready"` |
| Side effect | Background orchestration is triggered (check backend logs) |

### TEST-PLAN-03: Sync — all plans cached (returns ready)

> Run after plans have been generated

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/sync
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.status | `"ready"` |

### TEST-PLAN-04: Get daily plan

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/daily-plan
```

| Check | Expected (plan exists) |
|---|---|
| Status | `200` |
| Body | Contains `recommended`, `option_2`, `option_3` keys |
| Each option | Has `title`, `description`, `type` |
| `recommended` | Has `distance`, `targetPace` |

| Check | Expected (plan generating) |
|---|---|
| Status | `200` |
| Body.status | `"generating"` |

### TEST-PLAN-05: Get weekly plan

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/weekly-plan
```

| Check | Expected (plan exists) |
|---|---|
| Status | `200` |
| Body | Contains day keys (monday, tuesday, ..., sunday) |
| Each day | Has workout data (JSONB) |

| Check | Expected (plan generating) |
|---|---|
| Status | `200` |
| Body.status | `"generating"` |

### TEST-PLAN-06: Get master plan

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/master-plan
```

| Check | Expected (plan exists) |
|---|---|
| Status | `200` |
| Body.weeks | Array of week objects |
| Body.total_weeks | Number |
| Body.currentWeek | Number ≥ 1 |
| Body.startDate | ISO timestamp |

| Check | Expected (no goal) |
|---|---|
| Body.error | `"No active goal"` |

### TEST-PLAN-07: Force regenerate plans

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/regenerate
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.success | `true` |
| Body.hasMasterPlan | `true` or `false` |
| Body.hasWeeklyPlan | `true` or `false` |
| Body.hasDailyPlan | `true` or `false` |
| Response time | < 120 seconds |

### TEST-PLAN-08: Regenerate — no goal

> Delete goal first, then regenerate

| Check | Expected |
|---|---|
| Status | `400` |
| Body.error | `"No active goal found"` |

### TEST-PLAN-09: Get streak

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/streak
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.streakDays | Number ≥ 0 |

---

## 8. AI Chat Tests

### TEST-CHAT-01: General coaching question

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message": "How should I warm up before a tempo run?"}' \
  http://localhost:3000/api/coach/chat
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.message | Non-empty coaching response |
| Body.planUpdate | `false` |
| Body.updatedPlan | `undefined` or `null` |

### TEST-CHAT-02: Plan modification request

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message": "Make today easier, I am really tired"}' \
  http://localhost:3000/api/coach/chat
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.message | Acknowledgement of plan change |
| Body.planUpdate | `true` |
| Body.updatedPlan | Object with modified plan data |

### TEST-CHAT-03: Chat — empty message

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message": ""}' http://localhost:3000/api/coach/chat
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.message | Some response (LLM handles empty input gracefully) |

### TEST-CHAT-04: Chat — AI service down

> Stop the Python server

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message": "Hello coach"}' http://localhost:3000/api/coach/chat
```

| Check | Expected |
|---|---|
| Status | `200` (graceful error) |
| Body.message | `"I'm having trouble right now. Let's try again."` |
| Body.planUpdate | `false` |

---

## 9. Frontend UI / E2E Tests

> These tests should be performed in a browser at `http://localhost:5173`

### TEST-UI-01: Login screen renders

| Step | Expected |
|---|---|
| Navigate to `http://localhost:5173` (not logged in) | Login screen visible |
| "STRIIVE" heading visible | ✅ |
| Strava login button present | ✅ |
| "Try Demo Account" button present | ✅ |
| Version label visible | ✅ |

### TEST-UI-02: Demo login flow

| Step | Expected |
|---|---|
| Click "Try Demo Account" | Button shows "Loading demo..." |
| Wait for redirect | App loads with demo user data |
| User name displayed | Demo user's name visible |
| Sync button | Not visible (demo mode) |

### TEST-UI-03: Bottom navigation

| Step | Expected |
|---|---|
| Home tab (🏠) | Shows `DailyPlanTab` — today's workout |
| Calendar tab (📅) | Shows `CalendarPage` — weekly/master plan |
| Chat button (🧠 center) | Opens `ChatWidget` overlay |
| Stats tab (📊) | Shows Activity Log list |
| Profile tab (👤) | Shows `ProfilePage` |

### TEST-UI-04: Daily Plan Tab

| Step | Expected |
|---|---|
| Navigate to Home tab | Daily plan loads (may show "generating" loader first) |
| 3 workout options visible | Recommended, Option 2, Option 3 cards |
| Click a workout card | Expands to show detail (description, pace, time) |
| Weekly plan preview visible | Shows 7-day overview |

### TEST-UI-05: Activity Log

| Step | Expected |
|---|---|
| Navigate to Stats tab | Activity list renders |
| Each card shows | Name, date, distance (km), pace, HR |
| Filter bubbles | "All" + activity types (Run, etc.) |
| Click filter | List filters correctly |
| Click activity card | Activity detail page opens |

### TEST-UI-06: Activity Detail Page

| Step | Expected |
|---|---|
| Click an activity | Full-screen detail page slides in |
| Map visible | Leaflet map with polyline (if data available) |
| Pace chart | Recharts line chart |
| Heart rate chart | Recharts line chart (if HR data) |
| AI analysis section | Shows cached analysis or "Generate" button |
| Click "Generate Analysis" | Loading spinner → AI analysis appears |
| Close button | Returns to activity list |

### TEST-UI-07: Calendar Page

| Step | Expected |
|---|---|
| Navigate to Calendar tab | Master plan timeline visible |
| Current week highlighted | ✅ |
| Weekly plan section | Shows daily workout assignments |
| Loading state | Shows loader if plans are generating |

### TEST-UI-08: Profile Page

| Step | Expected |
|---|---|
| Navigate to Profile tab | User name, profile image visible |
| Goal section | Shows current goal or "Set Goal" prompt |
| Click "Edit Goal" | `GoalEditorModal` opens |
| Set goal form | goal type, target date, weekly distance, preferred days |
| Save goal | Modal closes, confirmation shown |
| Logout button (top right) | ✅ Visible, functional |
| Click Logout | Returns to login screen |

### TEST-UI-09: Chat Widget

| Step | Expected |
|---|---|
| Click chat button (bottom nav) | Chat widget slides up from bottom |
| Initial message | AI greeting visible |
| Type message + send | User message appears, "Thinking..." loader shows |
| AI response arrives | Assistant message appears |
| Send plan modification | "Plan updated" badge appears on message |
| Grab handle area | Click/drag to close |
| Send on Enter | Works (Shift+Enter does not send) |

### TEST-UI-10: Goal Editor Modal

| Step | Expected |
|---|---|
| Open goal editor | Modal overlay renders |
| Goal type selector | Options: 10K, Half Marathon, Marathon |
| Target date | Date picker functional |
| Weekly distance target | Number input |
| Preferred days | Multi-select (Mon-Sun) |
| Save | Calls POST/PUT `/api/goals`, triggers plan regeneration |
| Cancel | Modal closes without changes |

### TEST-UI-11: Loading & Error States

| Step | Expected |
|---|---|
| Initial app load | Spinner with "Initializing Coach..." |
| Plan generating | `TrainingPlanLoader` or `PlanCreatingLoader` animation |
| Network error | Error message displayed gracefully |
| AI service timeout | Chat shows fallback message |

---

## 10. Python AI Service Direct Tests

### TEST-PY-01: Health check

```bash
curl http://localhost:5001/health
```

| Check | Expected |
|---|---|
| Body.status | `"healthy"` |

### TEST-PY-02: Orchestrate with full payload

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "userId": "999999999",
    "goal": {"type": "half_marathon", "targetDate": "2026-06-01", "weeklyTarget": 40},
    "masterPlan": null,
    "weeklyPlan": null,
    "recentActivities": [
      {"date": "2026-02-24", "distance": 8000, "duration": 2700, "type": "Run"},
      {"date": "2026-02-22", "distance": 5000, "duration": 1800, "type": "Run"}
    ],
    "forceRegenerate": true
  }' http://localhost:5001/orchestrate
```

| Check | Expected |
|---|---|
| Status | `200` |
| Response time | < 120 seconds |
| Body | Contains `result` or plan keys (`masterPlan`, `weeklyPlan`, `dailyPlan`) |
| Body.error | Should be `null` or absent |
| Master plan output | Has `weeks` array, `total_weeks`, `peak_week` |
| Weekly plan output | Has monday–sunday keys |
| Daily plan output | Has `recommended`, `option_2`, `option_3` |

### TEST-PY-03: Orchestrate — minimal payload (no goal)

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId": "999999999"}' http://localhost:5001/orchestrate
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body | Contains error or empty plans (no goal = no orchestration) |

### TEST-PY-04: Orchestrate — invalid payload (missing userId)

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"goal": {"type": "10k"}}' http://localhost:5001/orchestrate
```

| Check | Expected |
|---|---|
| Status | `422` (Pydantic validation error) |
| Body.detail | Array of validation error objects |

### TEST-PY-05: Chat — general question

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "userId": "999999999",
    "message": "What is a good warm up routine?",
    "currentPlan": null,
    "goal": null,
    "masterPlan": null
  }' http://localhost:5001/chat
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.message | Non-empty coaching response |
| Body.planUpdate | `false` |

### TEST-PY-06: Chat — plan modification

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "userId": "999999999",
    "message": "Swap today for a rest day please",
    "currentPlan": {"monday": {"type": "tempo"}, "tuesday": {"type": "easy"}},
    "goal": {"type": "half_marathon", "weeklyTarget": 40},
    "masterPlan": null
  }' http://localhost:5001/chat
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.planUpdate | `true` |
| Body.updatedPlan | Object with modified plan |
| Body.message | Acknowledgement string |

### TEST-PY-07: Chat — missing message (validation error)

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId": "999999999"}' http://localhost:5001/chat
```

| Check | Expected |
|---|---|
| Status | `422` |
| Body.detail | Validation error for missing `message` field |

### TEST-PY-08: Analyze activity

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "id": "12345",
    "name": "Evening Run",
    "start_date": "2026-02-25T18:00:00Z",
    "distance": 10000,
    "moving_time": 3600,
    "average_speed": 2.78,
    "average_heartrate": 155,
    "total_elevation_gain": 100,
    "type": "Run"
  }' http://localhost:5001/analyze
```

| Check | Expected |
|---|---|
| Status | `200` |
| Body.activityId | `"12345"` |
| Body.status | `"success"` |
| Body.text | JSON string containing `runType`, `summary`, `highlight`, `suggestion`, `relativeEffort` |
| Body.model | Non-empty |
| Body.generatedAt | ISO timestamp |

### TEST-PY-09: Analyze — no API key configured

> Temporarily unset `OPENAI_API_KEY` and restart Python server

| Check | Expected |
|---|---|
| Status | `200` |
| Body.status | `"error"` |
| Body.text | `"Analysis temporarily unavailable - API key not configured."` |

### TEST-PY-10: Pydantic validation error logging

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"bad_field": true}' http://localhost:5001/orchestrate
```

| Check | Expected |
|---|---|
| Status | `422` |
| Server log | Shows `[VALIDATION ERROR]` with field location and message |

---

## 11. Database Integrity Tests

### TEST-DB-01: User table integrity

```sql
SELECT strava_id, name, access_token IS NOT NULL as has_token,
       refresh_token IS NOT NULL as has_refresh, expires_at
FROM users WHERE strava_id = 999999999;
```

| Check | Expected |
|---|---|
| Row exists | ✅ |
| name | Non-empty |
| has_token | `true` |
| has_refresh | `true` |
| expires_at | Number > 0 |

### TEST-DB-02: Activity data integrity

```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN distance IS NOT NULL THEN 1 END) as has_distance,
       COUNT(CASE WHEN start_date IS NOT NULL THEN 1 END) as has_date
FROM activities WHERE user_id = 999999999;
```

| Check | Expected |
|---|---|
| total | ≥ 1 (demo user seeded) |
| has_distance | = total |
| has_date | = total |

### TEST-DB-03: Daily plan cache constraint

```sql
-- Verify v2.1 structure constraint
SELECT plan_data ? 'recommended' as has_recommended,
       plan_data ? 'option_2' as has_opt2,
       plan_data ? 'option_3' as has_opt3
FROM daily_plan_cache WHERE user_id = 999999999
ORDER BY plan_date DESC LIMIT 1;
```

| Check | Expected |
|---|---|
| has_recommended | `true` |
| has_opt2 | `true` |
| has_opt3 | `true` |

### TEST-DB-04: Foreign key cascade

```sql
-- Delete a user and verify child records are cleaned up
-- WARNING: Only test on test database!
DELETE FROM users WHERE strava_id = <TEST_USER_ID>;
SELECT COUNT(*) FROM activities WHERE user_id = <TEST_USER_ID>;      -- Should be 0
SELECT COUNT(*) FROM user_goals WHERE user_id = <TEST_USER_ID>;      -- Should be 0
SELECT COUNT(*) FROM daily_plan_cache WHERE user_id = <TEST_USER_ID>;-- Should be 0
```

### TEST-DB-05: Unique constraints

```sql
-- Try inserting duplicate weekly plan cache
INSERT INTO weekly_plan_cache (user_id, week_start, monday)
VALUES (999999999, '2026-02-23', '{"type": "rest"}');
-- Run twice — second should fail with unique violation on (user_id, week_start)
```

---

## 12. Error Handling & Edge Cases

### TEST-ERR-01: Backend handles Python service ECONNREFUSED

> Stop Python server, call any endpoint that proxies to AI service

| Endpoint | Expected |
|---|---|
| `POST /api/activities/:id/analysis` | `503` with "AI service unavailable" |
| `POST /api/coach/regenerate` | `500` with error details |
| `POST /api/coach/chat` | `200` with graceful fallback message |

### TEST-ERR-02: LLM returns non-JSON

> Test if `parse_json_response()` handles garbled LLM output gracefully

| Check | Expected |
|---|---|
| Chat endpoint | Returns fallback message, does not crash |
| Orchestrate | Returns error object, does not crash server |

### TEST-ERR-03: Invalid activity IDs

```bash
# Non-numeric ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/activities/abc
# Very large ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/activities/99999999999999999
```

| Check | Expected |
|---|---|
| Status | `404` or `400` |
| No server crash | ✅ |

### TEST-ERR-04: Concurrent plan generation

> Call `/api/coach/sync` multiple times rapidly

```bash
for i in {1..5}; do
  curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/coach/sync &
done
wait
```

| Check | Expected |
|---|---|
| No crashes | ✅ |
| No duplicate plans in DB | ✅ (unique constraints should prevent) |

### TEST-ERR-05: Expired Strava token handling

> This tests the auto-refresh in `middleware/auth.js`

| Check | Expected |
|---|---|
| Token close to expiry (< 5 min buffer) | Auto-refreshed before API call |
| New tokens saved to DB | ✅ |
| If refresh fails | `401` with "Failed to refresh authentication token" |

### TEST-ERR-06: Large payload handling

```bash
# Backend accepts up to 10mb JSON
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"activityData": '"$(python3 -c "import json; print(json.dumps({'data': 'x' * 5000000}))")"'}' \
  http://localhost:3000/api/activities/12345/analysis
```

| Check | Expected |
|---|---|
| Status | `200` or `413` (depends on actual payload) |
| No server crash | ✅ |

---

## 13. Performance & Timeout Tests

### TEST-PERF-01: Plan orchestration timeout

| Metric | Expected |
|---|---|
| `/orchestrate` response time | < 120s (configured timeout) |
| If timeout exceeded | Backend returns 500 with timeout message |

### TEST-PERF-02: Activity analysis timeout

| Metric | Expected |
|---|---|
| `/analyze` response time | < 60s (configured timeout) |

### TEST-PERF-03: Chat response time

| Metric | Expected |
|---|---|
| `/chat` response time | < 30s (configured timeout) |

### TEST-PERF-04: Activity list loading

| Metric | Expected |
|---|---|
| `GET /api/activities` response time | < 2s for demo user |
| Pagination | Not implemented (loads all activities at once) |

### TEST-PERF-05: Frontend initial load

| Metric | Expected |
|---|---|
| Time to interactive | < 3s on localhost |
| Bundle size | Check with `npm run build && ls -la dist/assets/` |

---

## 14. Security Tests

### TEST-SEC-01: JWT validation

```bash
# Tampered JWT
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdHJhdmFJZCI6MTIzNDV9.tampered" \
  http://localhost:3000/api/user
```

| Check | Expected |
|---|---|
| Status | `401` |

### TEST-SEC-02: SQL injection resistance

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/activities/1%3B%20DROP%20TABLE%20users%3B--"
```

| Check | Expected |
|---|---|
| Status | `404` or `400` |
| `users` table intact | ✅ (parameterized queries in `postgres.js`) |

### TEST-SEC-03: CORS enforcement

```bash
curl -H "Origin: https://evil-site.com" -H "Authorization: Bearer $TOKEN" \
  -v http://localhost:3000/api/user 2>&1 | grep "access-control"
```

| Check | Expected |
|---|---|
| `access-control-allow-origin` | NOT `https://evil-site.com` (blocked by CORS allowlist) |

### TEST-SEC-04: Auth required on protected endpoints

| Endpoint | Without Auth |
|---|---|
| `GET /api/activities` | `401` |
| `GET /api/goals` | `401` |
| `POST /api/coach/sync` | `401` |
| `POST /api/coach/chat` | `401` |
| `GET /api/coach/daily-plan` | `401` |
| `POST /api/activities/sync` | `401` |

### TEST-SEC-05: Demo user cannot sync Strava data

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullSync": true}' http://localhost:3000/api/activities/sync
```

| Check | Expected |
|---|---|
| Body.count | `0` |
| Body.message | `"Demo mode — sync disabled."` |
| No Strava API call made | ✅ |

---

## Appendix A: Complete API Call Map

### Frontend → Backend API Calls

| Component | Method | Endpoint | Trigger |
|---|---|---|---|
| `App.jsx` (LoginScreen) | POST | `/api/auth/strava/demo-login` | "Try Demo" button click |
| `App.jsx` (LoginScreen) | GET | `/api/auth/strava/login` | "Login with Strava" button (redirect) |
| `App.jsx` (fetchInitialData) | GET | `/api/user` | App mount (auth check) |
| `App.jsx` (fetchInitialData) | GET | `/api/activities` | App mount (load activities) |
| `App.jsx` (handleSync) | POST | `/api/activities/sync` | Sync button press |
| `App.jsx` (handleSync) | GET | `/api/activities` | After sync success (refresh list) |
| `App.jsx` (handleSync) | GET | `/api/user` | After sync success (refresh user data) |
| `DailyPlanTab.jsx` | GET | `/api/coach/daily-plan` | Tab mount + polling |
| `DailyPlanTab.jsx` | GET | `/api/coach/weekly-plan` | Tab mount |
| `DailyPlanTab.jsx` | POST | `/api/coach/sync` | If no plans cached |
| `CalendarPage.jsx` | GET | `/api/coach/master-plan` | Page mount |
| `CalendarPage.jsx` | GET | `/api/coach/weekly-plan` | Page mount |
| `CalendarPage.jsx` | POST | `/api/coach/sync` | If no plans cached |
| `ProfilePage.jsx` | GET | `/api/goals` | Page mount |
| `ProfilePage.jsx` | GET | `/api/goals/history` | Page mount |
| `ProfilePage.jsx` | POST | `/api/goals` | Create new goal |
| `ProfilePage.jsx` | PUT | `/api/goals/:id` | Update existing goal |
| `ProfilePage.jsx` | POST | `/api/goals/:id/complete` | Complete goal |
| `ProfilePage.jsx` | POST | `/api/coach/regenerate` | After goal save |
| `ActivityDetailPage.jsx` | GET | `/api/activities/:id` | Detail page mount |
| `ActivityDetailPage.jsx` | GET | `/api/activities/:id/analysis` | Detail page mount |
| `ActivityDetailPage.jsx` | POST | `/api/activities/:id/analysis` | "Generate Analysis" click |
| `ChatWidget.jsx` | POST | `/api/coach/chat` | Send message |
| `WeeklyPlanTab.jsx` | GET | `/api/coach/weekly-plan` | Tab mount |

### Backend → Python AI Service Calls

| Backend Route | Method | Python Endpoint | Purpose |
|---|---|---|---|
| `coach.js` (triggerOrchestration) | POST | `/orchestrate` | Plan generation via LangGraph |
| `coach.js` (regenerate) | POST | `/orchestrate` | Force plan regeneration |
| `coach.js` (chat) | POST | `/chat` | AI chat + plan modification |
| `analysis.js` (analysis) | POST | `/analyze` | Activity AI analysis |
| `analysis.js` (regenerate) | POST | `/analyze` | Regenerate analysis version |

### Python AI Service → External APIs

| Function | Target | Purpose |
|---|---|---|
| `call_llm()` in `langgraph_agents.py` | OpenRouter API (`openrouter.ai/api/v1/chat/completions`) | All LLM calls (planning, analysis) |
| `chat_with_coach()` in `app.py` | OpenRouter API | Chat responses |
| `analyze_activity()` in `app.py` | OpenRouter API | Activity analysis |

---

## Appendix B: Test Execution Checklist

Use this checklist to track test progress:

```
[ ] 2. Service Health Checks (4 tests)
[ ] 3. Authentication & Session (7 tests)
[ ] 4. Activity Management (7 tests)
[ ] 5. AI Analysis (7 tests)
[ ] 6. Goal Management (9 tests)
[ ] 7. Plan Orchestration (9 tests)
[ ] 8. AI Chat (4 tests)
[ ] 9. Frontend UI / E2E (11 tests)
[ ] 10. Python AI Service Direct (10 tests)
[ ] 11. Database Integrity (5 tests)
[ ] 12. Error Handling & Edge Cases (6 tests)
[ ] 13. Performance & Timeout (5 tests)
[ ] 14. Security (5 tests)

TOTAL: 89 tests
```
