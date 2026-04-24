---
title: "feat: Striive Fitness Expansion + Full v2 Redesign"
type: feat
status: active
date: 2026-04-24
origin: docs/brainstorms/2026-04-24-striive-fitness-expansion-requirements.md
---

# Striive Fitness Expansion + Full v2 Redesign

## Overview

Two parallel tracks land together:

1. **v2 Redesign (Tasks A–D from striive_v2_plan.md)** — four pending frontend components (ProfilePage, ChatWidget, GoalEditorModal/ConfirmationModal, App.jsx routing) get the premium-athletic design treatment: dark-only, Space Grotesk + JetBrains Mono, flat OKLCH surfaces, no glass morphism.

2. **Fitness Expansion** — Striive grows from a running-only app to a holistic fitness tracker. New pillars: **Strength** (parse Hevy weight-training sessions synced via Strava, compute tonnage + muscle-group volume) and **Nutrition** (LLM-powered food logging from chat or a dedicated Fuel screen, TDEE-auto calorie goals).

The design system is authoritative: `/tmp/striive-handoff/striive/project/redesign/` (re-extract from `/mnt/f/Striive-handoff.zip` if /tmp is cleared). Tokens live in `tokens.jsx`. The new "Fuel" bottom-nav tab (`#/fuel`) replaces the old "Plan" tab in the nav bar — the Calendar page remains accessible via the header button on the Home screen.

---

## Problem Frame

Striive is a running app that has accumulated technical debt in its UI (Tailwind color strings instead of CSS variables, overlay-based coach chat instead of a full-screen route). Simultaneously, the user wants to expand the app to track strength workouts parsed automatically from Hevy-via-Strava, and add nutrition tracking via LLM chat.

The frontend design was produced via Claude Design and exported as `Striive Redesign.html`. It introduces a 5-tab BottomNav (Today / Activity / Coach [elevated] / Fuel / You) and full-screen components for all routes.

---

## Requirements Trace

- R1–R7: Strength tracking (WeightTraining detection, Hevy description parsing, storage, tonnage + muscle-group volume, 4-week trend, exercise mapping, change-hash re-parsing)
- R8–R14: Nutrition tracking (chat logging, intent routing, structured macro response, dedicated Fuel page, food_log storage, daily summary, manual entry)
- R15–R19: Macro goal calculation (biometric fields on users, TDEE formula, dynamic daily surplus, macro split override, nightly recalculation)
- R20: Navigation — add Strength/Nutrition without demoting existing routes
- Tasks A–D from `striive_v2_plan.md`: ProfilePage, ChatWidget, GoalEditorModal, App.jsx routing

**Resolved before planning:**
- Retroactive parse: YES — all historical WeightTraining activities are parsed on first deploy (one-time migration script run at startup or via a `/api/admin/retroactive-parse` endpoint called post-deploy).

---

## Scope Boundaries

- No Hevy API integration — Strava description field parsing only
- No barcode/photo food scanning
- No AI-generated meal plans or recipe suggestions
- No body composition tracking beyond height/weight/DOB
- No social or sharing features
- Nav conflict resolution: the design's 5-tab nav (no Calendar tab) is authoritative; CalendarPage remains reachable via the "Plan" button in DailyPlanTab header
- Strength does not get a dedicated BottomNav tab — it lives in Activity list + ActivityDetailPage with a WeightTraining-variant rendering

---

## Context & Research

### Relevant Code and Patterns

- `frontend/src/App.jsx` — hash router, BottomNav, ActivityListPage; existing routing pattern to follow
- `frontend/src/ActivityDetailPage.jsx` — stats grid, Leaflet map; extend with WeightTraining variant
- `frontend/src/DailyPlanTab.jsx` — hero card pattern; already on v2 design tokens
- `frontend/src/CalendarPage.jsx` — already redesigned; keep untouched
- `frontend/src/index.css` — full OKLCH token set (already deployed, use CSS variables throughout)
- `backend/routes/activities.js` — sync flow at `POST /api/activities/sync`; add WeightTraining branch here
- `backend/routes/coach.js` — chat handler at `POST /api/coach/chat`; add food-intent routing here
- `backend/db/schema.sql` — PostgreSQL via Supabase; all schema changes go here as `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE IF NOT EXISTS`
- `backend/db/index.js` — DB abstraction functions; add new query helpers here
- `backend/index.js` — mounts all routes; mount new nutrition router here

### Design Reference Files (extracted)

- `/tmp/striive-handoff/striive/project/redesign/tokens.jsx` — canonical token object `T`
- `/tmp/striive-handoff/striive/project/redesign/screens-misc.jsx` — `ProfileGoals`, `ChatScreen`, `LoginScreen`
- `/tmp/striive-handoff/striive/project/redesign/screens-nutrition.jsx` — `NutritionScreen`, `NutritionChat`, `ManualEntry`, `MacroRing`
- `/tmp/striive-handoff/striive/project/redesign/proto-routes-a.jsx` — connected `BottomNavC` (5 tabs), all route components
- `/tmp/striive-handoff/striive/project/redesign/screens-home.jsx` — `HomeFocus`, `HomeRibbon`

### Existing Design Tokens (index.css)

Already deployed — use CSS variables, not hardcoded OKLCH values:
`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-line`, `--color-line-hi`,
`--color-fg`, `--color-fg-muted`, `--color-fg-dim`, `--color-fg-faint`,
`--color-ignite`, `--color-ignite-hi`, `--color-ignite-lo`, `--color-ignite-wash`, `--color-ignite-ring`,
`--color-mint`, `--color-gold`, `--color-crimson`, `--color-sky`

Font utilities: `font-display` (Space Grotesk), `mono-data` (JetBrains Mono)

### Institutional Learnings

- Strava sync fetches activity summaries only; detailed fields (description, laps, streams) are fetched on-demand in `GET /api/activities/:id`
- DB is Supabase PostgreSQL; `db/index.js` uses parameterized queries via `pg`
- Demo user is blocked from sync operations (hardcoded guard in activities.js); preserve this guard in all new sync paths

---

## Key Technical Decisions

- **Hybrid Hevy parsing (regex primary, LLM fallback)**: Balances zero-cost fast-path for well-formatted Hevy exports with LLM resilience. Confidence threshold: if regex extracts ≥1 set from ≥50% of non-empty lines, accept; otherwise delegate to LLM. LLM prompt returns JSON only.
- **Retroactive parse on first deploy**: Run a one-shot script (or endpoint) that iterates existing WeightTraining activities, fetches descriptions if not yet stored in `activity_details`, and inserts parsed sets. Subsequent syncs use the hash-change detection (R7).
- **TDEE formula**: Mifflin-St Jeor, computed server-side in a new `backend/services/tdee.js`. Activity multiplier derived from rolling 7-day moving time vs. thresholds.
- **Food intent detection in main chat**: Lightweight keyword pass first (contains food-adjacent nouns like "ate", "had", "eating", "meal", "calories"); if matched, delegate to the structured macro-extraction LLM prompt. This avoids a separate classification API call in most cases.
- **Nutrition chat persistence**: New `nutrition_conversations` table (separate from `coach_conversations`); same schema shape.
- **NutritionPage is a full React page** at `frontend/src/NutritionPage.jsx`; mounted as `#/fuel` route in App.jsx.
- **BottomNav becomes 5 tabs**: Today / Activity / Coach (elevated center) / Fuel / You — replacing the old 4-tab + center-button design. Calendar accessible from DailyPlanTab header "Plan" button. (see origin: docs/brainstorms/2026-04-24-striive-fitness-expansion-requirements.md — R20 conflict note)
- **ActivityDetailPage WeightTraining variant**: Detect `sport_type === 'WeightTraining'` and render tonnage + muscle-group cards instead of map + pace stats. No new file needed; conditional rendering within the existing component.
- **Saved recipes**: Stored in `localStorage` keyed by user; no backend table needed in this phase.

---

## Checkpoint System

All agents MUST read and write `docs/plans/CHECKPOINT.md` (repo-relative):

```
## Status

| ID | Unit | Status | File(s) |
|----|------|--------|---------|
| U01 | DB migrations | pending | ... |
...
```

**Protocol for each agent:**
1. Read `docs/plans/CHECKPOINT.md` at startup
2. If your unit is `completed` → exit immediately (idempotent)
3. If your unit is `in_progress` → resume from where you left off (re-read the target file, pick up the work)
4. If your unit is `pending` → mark as `in_progress`, do the work, mark as `completed`

The checkpoint file is created by U01 (the first agent). If it doesn't exist yet, U01 creates it with all units set to `pending`.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────────┐
│ Strava Sync (POST /api/activities/sync)                 │
│  ├─ Running activities → existing pipeline              │
│  └─ WeightTraining → StrengthParser                    │
│        ├─ regex → parse sets                            │
│        └─ LLM fallback → parse sets                    │
│              └─ Store in weight_training_sets           │
│                   + muscle_group_volumes view           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Coach Chat (POST /api/coach/chat)                       │
│  ├─ Intent classifier (keyword + optional LLM)         │
│  │    ├─ training → existing coach response            │
│  │    └─ food     → NutritionParser                   │
│  │           └─ structured macro card + food_log row   │
│  └─ Normal response                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Frontend Routes (#/...)                                  │
│  #/home     → DailyPlanTab (unchanged)                 │
│  #/activity → ActivityListPage (Strength filter chip)  │
│  #/activity/:id → ActivityDetailPage                   │
│        ├─ run/ride → existing map + stats              │
│        └─ WeightTraining → tonnage + muscle cards      │
│  #/coach   → ChatWidget full-screen (Task B)           │
│  #/fuel    → NutritionPage (new)                      │
│  #/profile → ProfilePage (Task A)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Units

> **Spawn one agent per unit. Agents MUST check `docs/plans/CHECKPOINT.md` before starting and update it at start (→ in_progress) and finish (→ completed).**

---

- [ ] **U01: Database Migrations**

**Goal:** Add all new tables and columns required by the expansion.

**Requirements:** R3, R12, R15, R19 (and R11 for nutrition_conversations)

**Dependencies:** None (must run first)

**Files:**
- Modify: `backend/db/schema.sql`
- Create: `backend/db/migrations/001_fitness_expansion.sql`
- Create: `docs/plans/CHECKPOINT.md` (initialize all units as pending)

**Approach:**
- Add to `users` table: `height_cm REAL`, `weight_kg REAL`, `date_of_birth DATE`, `macro_protein_pct REAL DEFAULT 0.30`, `macro_carb_pct REAL DEFAULT 0.45`, `macro_fat_pct REAL DEFAULT 0.25`
- New table `weight_training_sets`: `id BIGSERIAL PK`, `activity_id BIGINT FK activities`, `user_id BIGINT FK users`, `exercise_name TEXT`, `set_number INTEGER`, `reps INTEGER`, `weight_kg REAL`, `muscle_groups TEXT[]`, `description_hash TEXT`, `created_at TIMESTAMPTZ`
- New table `food_logs`: `id BIGSERIAL PK`, `user_id BIGINT FK users`, `logged_at TIMESTAMPTZ DEFAULT NOW()`, `description TEXT`, `meal_slot TEXT`, `kcal INTEGER`, `protein_g INTEGER`, `carbs_g INTEGER`, `fat_g INTEGER`, `fibre_g INTEGER`, `source TEXT` (chat|manual)
- New table `nutrition_goals`: `id BIGSERIAL PK`, `user_id BIGINT FK users`, `date DATE`, `kcal_goal INTEGER`, `protein_g_goal INTEGER`, `carbs_g_goal INTEGER`, `fat_g_goal INTEGER`, UNIQUE(user_id, date)
- New table `nutrition_conversations`: `id BIGSERIAL PK`, `user_id BIGINT FK users`, `role TEXT`, `content TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- Migration file uses `ALTER TABLE IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` for idempotency
- `description_hash` on `weight_training_sets` is SHA-256 of the activity's description; compared on each sync to detect changes (R7)

**Patterns to follow:** `backend/db/schema.sql` existing table patterns; use FK constraints with ON DELETE CASCADE

**Test scenarios:**
- Migration runs twice without error (idempotency)
- `weight_training_sets` has FK to activities and users; cascade delete works
- `nutrition_goals` UNIQUE constraint prevents duplicate date rows per user

**Verification:** All tables exist in Supabase; `\d weight_training_sets` shows all expected columns; no FK violations.

---

- [ ] **U02: Exercise-to-Muscle-Group Mapping**

**Goal:** Static lookup table mapping Hevy exercise names → muscle groups array.

**Requirements:** R6

**Dependencies:** None (can run in parallel with U01)

**Files:**
- Create: `backend/data/muscle_groups.json`

**Approach:**
- JSON object: keys are lowercase canonical exercise names, values are arrays of muscle group strings (e.g., `"bench press": ["chest", "triceps", "shoulders"]`)
- Cover at minimum: bench press, incline bench, overhead press, squat, deadlift, romanian deadlift, leg press, pull-up, lat pulldown, barbell row, dumbbell row, curl, hammer curl, tricep extension, dip, lunge, hip thrust, cable fly, face pull, shrug
- Normalize to lowercase before lookup; strip trailing "s" for plurals with a simple fallback
- Unrecognized exercises map to `["other"]`

**Patterns to follow:** Simple JSON data file; no build step needed; imported as ESM JSON in Node 18+

**Test scenarios:**
- "Bench Press" lookup → `["chest", "triceps", "shoulders"]`
- Unknown exercise → `["other"]`
- Case-insensitive match works

**Verification:** File exists; parseable JSON; covers Hevy's most common exercises.

---

- [ ] **U03: Strength Parser Service**

**Goal:** Parse a Strava/Hevy activity description string into structured sets.

**Requirements:** R2, R6

**Dependencies:** U02 (muscle_groups.json)

**Files:**
- Create: `backend/services/strength_parser.js`

**Approach:**
- Export `parseStrengthDescription(description)` → `{ sets: [...], confidence: 'regex'|'llm'|'none' }`
- Each set: `{ exercise_name, set_number, reps, weight_kg, muscle_groups }`
- Regex path: match patterns like `"Bench Press: 3×10 @ 80kg"`, `"3 sets of 8 reps 75kg"`, `"Squat 5×5 100kg"`. If ≥1 set parsed from ≥50% of non-empty lines, mark confidence `regex`.
- LLM fallback: prompt Claude API (use `claude-haiku-4-5-20251001` for cost efficiency) with a strict JSON-only prompt returning `{ sets: [...] }`. Mark confidence `llm`.
- If neither produces sets, return `{ sets: [], confidence: 'none' }`
- After parsing, enrich each set's `muscle_groups` by looking up `exercise_name` in `muscle_groups.json`
- Compute `description_hash` (SHA-256 of raw description string) and include in return value

**Patterns to follow:** The existing Claude API calls in `backend/routes/coach.js`; use the same Anthropic SDK import pattern

**Test scenarios:**
- Happy path: standard Hevy export format → correct sets with muscle groups
- Edge case: empty description → `{ sets: [], confidence: 'none' }`
- Edge case: freeform notes only, no exercise structure → LLM fallback fires
- Happy path: `"Squat 5×5 @ 100kg"` → set_number 1–5, reps 5, weight_kg 100, muscle_groups includes `"quads"`
- Integration: muscle_groups.json lookup is called for each parsed exercise

**Verification:** Unit can be imported and called; returns correctly shaped output for a sample Hevy description.

---

- [ ] **U04: Strava Sync — WeightTraining Branch + Retroactive Parse**

**Goal:** Detect WeightTraining activities during sync; parse their descriptions; store sets; add retroactive parse on first deploy.

**Requirements:** R1, R2, R3, R4, R5, R7

**Dependencies:** U01, U03

**Files:**
- Modify: `backend/routes/activities.js`
- Create: `backend/scripts/retroactive_parse.js`
- Modify: `backend/db/index.js` (add `saveWeightTrainingSets`, `getWeightTrainingSets`, `deleteWeightTrainingSets`, `listWeightTrainingActivities`)

**Approach:**
- In the sync loop in `POST /api/activities/sync`: after saving each activity, check `sport_type === 'WeightTraining'` (or `'Workout'` as Strava may use either for Hevy sessions — check `activity.sport_type` and `activity.type`)
- For matching activities: fetch the full activity detail (description field) from Strava API, compute SHA-256 of description, compare against stored hash in `weight_training_sets` for this activity
- If hash changed (or no rows exist): delete old rows for this activity, call `strength_parser.parseStrengthDescription()`, save new rows via `saveWeightTrainingSets`
- Preserve demo-user guard (early return before this branch)
- `retroactive_parse.js`: standalone script that queries all existing WeightTraining activities, fetches their descriptions (using stored access tokens), and runs the parser. Idempotent via hash check. Intended to be run once post-deploy: `node backend/scripts/retroactive_parse.js`
- Also expose `POST /api/activities/retroactive-parse` endpoint (auth-gated) for convenience

**Patterns to follow:** Existing per-activity Strava API detail fetch in `GET /api/activities/:id`; demo-user guard at top of sync handler

**Test scenarios:**
- Happy path: new WeightTraining activity synced → description fetched, sets stored, hash stored
- Idempotency: sync same activity twice with same description → no duplicate sets (hash match skips re-parse)
- Change detection: description changes → old sets deleted, new sets inserted, new hash stored
- Running activity: runs through normal pipeline, no strength parsing attempted
- Retroactive script: processing an activity already parsed produces no duplicates

**Verification:** After sync with a test WeightTraining activity, `weight_training_sets` contains correct rows; re-sync does not duplicate.

---

- [ ] **U05: TDEE Service + Nutrition API Routes**

**Goal:** TDEE calculation service; all nutrition backend endpoints.

**Requirements:** R8, R9 (partial — intent routing in U06), R10–R14, R16–R19

**Dependencies:** U01

**Files:**
- Create: `backend/services/tdee.js`
- Create: `backend/routes/nutrition.js`
- Modify: `backend/db/index.js` (add `logFood`, `listFoodLogs`, `deleteFoodLog`, `getNutritionGoal`, `upsertNutritionGoal`, `listNutritionConversations`, `appendNutritionConversation`, `getUserBiometrics`, `updateUserBiometrics`)
- Modify: `backend/index.js` (mount `/api/nutrition` router)

**Approach:**

`tdee.js`:
- Export `calculateTDEE({ height_cm, weight_kg, date_of_birth, gender = 'other', activities_last_7_days })` → `{ bmr, tdee, macro_goals: { kcal, protein_g, carbs_g, fat_g } }`
- Use Mifflin-St Jeor: BMR = 10×weight + 6.25×height − 5×age ± gender adjustment; for `other` gender, use the average of male/female formulas
- Activity multiplier: sum of moving_time_seconds in last 7 days; < 1h → sedentary (×1.2), 1–3h → lightly active (×1.375), 3–6h → moderately active (×1.55), > 6h → very active (×1.725)
- On workout days (`suffer_score > 50` or `moving_time > 3600`): add a dynamic surplus of 200–400 kcal based on intensity
- Apply user's macro split percentages to total kcal

`nutrition.js` routes:
- `GET /api/nutrition/today` — daily food log + computed totals + goal for today
- `POST /api/nutrition/log` — add food entry (from chat or manual; body: `{ description, kcal, protein_g, carbs_g, fat_g, fibre_g, meal_slot, source }`)
- `DELETE /api/nutrition/log/:id` — delete a food log entry
- `GET /api/nutrition/goals` — get current TDEE-based goals (recalculate if stale > 24h or on demand)
- `PUT /api/nutrition/profile` — update biometric fields + macro split overrides on users table
- `POST /api/nutrition/chat` — dedicated nutrition chat; persists to `nutrition_conversations`; uses LLM with food-parsing prompt
- `POST /api/nutrition/goals/recalculate` — force TDEE recalculation; upserts today's `nutrition_goals` row

**Patterns to follow:** `backend/routes/coach.js` for Claude API calls; `backend/db/index.js` existing query patterns; `requireAuth` middleware

**Test scenarios:**
- Happy path: `POST /api/nutrition/log` with valid body → row in food_logs, returns 201 with entry
- Happy path: `GET /api/nutrition/today` → correct totals aggregated from today's food_logs
- Happy path: TDEE recalculate with known biometrics → plausible kcal goal (1800–3500 range for typical athlete)
- Edge case: user has no biometrics → returns default 2000 kcal goal with a `biometrics_missing: true` flag
- Edge case: `DELETE /api/nutrition/log/:id` for another user's entry → 403
- Edge case: `suffer_score` NULL for WeightTraining → falls through to moving_time threshold (R17)

**Verification:** All endpoints respond correctly; food_log rows persist; TDEE calculation is deterministic for same inputs.

---

- [ ] **U06: Coach Chat — Food Intent Routing**

**Goal:** Detect food-logging intent in the main coach chat and route to the nutrition log.

**Requirements:** R8, R9, R10

**Dependencies:** U01, U05

**Files:**
- Modify: `backend/routes/coach.js` (chat handler at `POST /api/coach/chat`)

**Approach:**
- Before the main coach LLM call, run a synchronous keyword classifier:
  - Food-intent keywords: `ate`, `eating`, `had`, `breakfast`, `lunch`, `dinner`, `snack`, `calories`, `kcal`, `protein`, `carbs`, `meal`, `food`, `drank`, `drink`
  - If ≥2 food keywords match (case-insensitive), treat as food intent
  - Also match pattern: message starts with a quantity + food name (e.g., "2 eggs and toast", "chicken bowl")
- On food intent: call the macro-extraction LLM prompt (same as `POST /api/nutrition/chat` logic) with the user message; save result to `food_logs`; return a structured macro card response (R10 — no conversational padding)
- If keyword classifier is uncertain (1 match), make a lightweight LLM binary classification call first
- If not food intent: proceed with normal coach response unchanged

**Patterns to follow:** Existing chat handler structure in `coach.js`; same Claude API call pattern

**Test scenarios:**
- `"I just had 2 scrambled eggs and toast"` → food intent detected, macro card returned, food_log row created
- `"Should I eat before my run?"` — only 1 food keyword — LLM classifier decides → coach response (no logging)
- `"How's my training plan looking?"` → 0 food keywords → normal coach response, nothing logged
- Integration: food entry appears in `GET /api/nutrition/today` after being logged via main chat

**Verification:** Food intent message logs a row; non-food message does not; coach chat still responds normally to training questions.

---

- [ ] **U07: ProfilePage v2 Redesign**

**Goal:** Replace ProfilePage with the design from `screens-misc.jsx → ProfileGoals`.

**Requirements:** Task A from striive_v2_plan.md

**Dependencies:** None (frontend-only, no new API changes needed)

**Files:**
- Modify: `frontend/src/ProfilePage.jsx`

**Approach:**
- Reference: `screens-misc.jsx → ProfileGoals` component
- New structure: user row (gradient avatar ignite→crimson, name, "Since Feb 2024 · Strava linked" in mono) → current goal hero card (ignite ambient glow, goal type + title + days remaining, training-phase progress bar Base→Build→Peak→Taper→Race with dot marker, 3-stat grid weekly km/avg pace/on track, Edit + Mark complete buttons) → fitness snapshot 2×2 grid (VO₂ max, Resting HR, 5k PR, Weekly load with colored trend badges) → settings list (Notifications, Units · Metric, Strava sync, Sign out in crimson)
- Add body metric inputs (height_cm, weight_kg, date_of_birth) to the Edit Goal modal trigger or a separate settings tap — connect to `PUT /api/nutrition/profile` (deferred to implementation: decide exact UI placement)
- Keep: `GET /api/goals` fetch, GoalEditorModal, complete-goal confirmation, sign out clearing localStorage authToken
- Remove: old 2-tab layout (Current Goal / History tabs), all Lucide imports, `#f97415` hardcoded color strings, `glass-card`, `slate-` Tailwind classes
- Use CSS variables throughout, no inline `oklch()` values (those belong in index.css)
- No Lucide imports; use inline SVGs matching `screens-misc.jsx`

**Patterns to follow:** `DailyPlanTab.jsx` as example of v2 CSS variable usage; `screens-misc.jsx → ProfileGoals` as design reference

**Test scenarios:**
- Happy path: page renders at `#/profile` with gradient avatar, goal hero card visible
- Happy path: "Edit goal" tap → GoalEditorModal opens with v2 token styling
- Happy path: "Sign out" → clears localStorage, navigates to `#/login`
- Edge case: no active goal → goal hero shows empty state, not a crash
- No `text-slate-` or `bg-white/` classes remain in the file

**Verification:** `#/profile` shows correct layout; no Lucide imports; no hardcoded color strings; all API calls functional.

---

- [ ] **U08: ChatWidget v2 Redesign**

**Goal:** Replace overlay ChatWidget with the full-screen page design from `screens-misc.jsx → ChatScreen`.

**Requirements:** Task B from striive_v2_plan.md

**Dependencies:** None (frontend-only)

**Files:**
- Modify: `frontend/src/components/ChatWidget.jsx`

**Approach:**
- Reference: `screens-misc.jsx → ChatScreen`
- Convert from overlay component to full-screen page component (no backdrop, no position:fixed overlay)
- Header: back button circle (history.back() or go('#/home')), gradient coach avatar (ignite→crimson), "Coach" title + "● LIVE" in mint mono
- Message thread: user messages right-aligned, ignite background, `border-radius: 16px 16px 4px 16px`; coach messages left-aligned, surface background + line border, `border-radius: 16px 16px 16px 4px`
- Plan updated card: ignite-wash background, ignite ring border, plan details, "View session →" button
- Quick suggestion pills: surface background, line border
- Input bar: pill shape, surface background, "Ask coach…" placeholder, send button (ignite when text, surface-2 when empty)
- Keep: all `/api/coach/chat` API calls, history loading (`/api/coach/chat/history`), `onPlanUpdate`/`onGoalChanged` callbacks, action badges (re-styled with v2 tokens)
- Remove: `emerald/teal/rose` Tailwind classes; Lucide imports; overlay/backdrop structure; `isOpen` prop (always rendered as full page now)

**Patterns to follow:** `DailyPlanTab.jsx` for CSS variable usage; `screens-misc.jsx → ChatScreen` for layout reference

**Test scenarios:**
- Full-screen render at `#/coach` route (not an overlay)
- Back button → navigates to `#/home`
- User can type and send a message; coach response appears in bubble styling
- Plan-updated card appears when coach response includes a plan action
- No `emerald`, `teal`, `rose`, `text-slate-` classes remain

**Verification:** Chat renders full-screen at `#/coach`; no overlay behavior; API calls work.

---

- [ ] **U09: Modal Token Swap (GoalEditorModal + ConfirmationModal)**

**Goal:** Swap hardcoded color strings for CSS variables in both modals. Structural/functional changes: none.

**Requirements:** Task C from striive_v2_plan.md

**Dependencies:** None

**Files:**
- Modify: `frontend/src/GoalEditorModal.jsx`
- Modify: `frontend/src/components/ConfirmationModal.jsx`

**Approach:**
Token replacements (exact mapping):

| Old | New |
|-----|-----|
| `#f97415` | `var(--color-ignite)` |
| `bg-white/5` | `background: var(--color-surface)` |
| `border-white/10` | `border: 1px solid var(--color-line)` |
| `text-slate-400` | `color: var(--color-fg-dim)` |
| `text-slate-300` | `color: var(--color-fg-muted)` |
| `text-white` | `color: var(--color-fg)` |
| `bg-gray-700` | `background: var(--color-surface-2)` |
| `background: '#1e293b'` | `background: var(--color-surface)` |
| Destructive button color | `var(--color-crimson)` |

No structural or behavioral changes.

**Patterns to follow:** `DailyPlanTab.jsx` as CSS variable reference

**Test scenarios:**
- GoalEditorModal opens from ProfilePage and shows ignite-orange accents
- ConfirmationModal destructive action button uses crimson
- No hardcoded hex or `slate`/`gray` Tailwind classes remain in either file

**Verification:** Both modals visually consistent with v2 design; no regression in functionality.

---

- [ ] **U10: App.jsx — Coach Route, 5-Tab BottomNav, Fuel Route**

**Goal:** Wire up `#/coach` full-screen route; update BottomNav to 5-tab design; add `#/fuel` route.

**Requirements:** Task D from striive_v2_plan.md, R20

**Dependencies:** U07, U08, U09 (must be done after those files exist in their new form)

**Files:**
- Modify: `frontend/src/App.jsx`

**Approach:**
- Reference: `proto-routes-a.jsx → BottomNavC` for the 5-tab nav (Today / Activity / Coach [elevated center] / Fuel / You)
- Routing additions:
  - `#/coach` → renders `<ChatWidget />` as full page (no isOpen/onClose props needed; back button inside handles nav)
  - `#/fuel` → renders `<NutritionPage />` (created in U11)
- BottomNav: replace current 4-tab + center-button implementation with 5-tab version from `BottomNavC` in proto-routes-a. Nav items: Today→`#/home`, Activity→`#/activity`, Coach→`#/coach` (elevated circle, 40px, translateY(-10px)), Fuel→`#/fuel`, You→`#/profile`
- Remove `onOpenCoach` prop and its callsite (coach is a full route now)
- Remove the conditional overlay rendering of `<ChatWidget>` (it's now a route)
- Import `NutritionPage` (add after U11 exists)
- Keep all other existing routes unchanged (`#/home`, `#/plan`, `#/activity`, `#/activity/:id`, `#/profile`, `#/login`)

**Patterns to follow:** Existing hash-routing switch in `App.jsx`; `BottomNavC` in `proto-routes-a.jsx`

**Test scenarios:**
- Bottom nav renders 5 tabs: Today, Activity, coach circle, Fuel, You
- Tapping Fuel → renders NutritionPage at `#/fuel`
- Tapping Coach circle → navigates to `#/coach`, renders full-screen ChatWidget
- Back button in ChatWidget returns to `#/home`
- All existing routes still work
- Active tab highlighting is correct for each route

**Verification:** 5-tab nav present; all routes render correct components; no overlay chat widget remaining.

---

- [ ] **U11: NutritionPage (Fuel Screen)**

**Goal:** Build the full Fuel screen connected to the nutrition API.

**Requirements:** R8, R11–R14

**Dependencies:** U05, U10 (App.jsx must declare the route)

**Files:**
- Create: `frontend/src/NutritionPage.jsx`

**Approach:**
- Reference: `screens-nutrition.jsx → NutritionScreen`, `NutritionChat`, `ManualEntry`, `MacroRing`
- Page sections:
  1. **Header**: "Fuel" title (22px, fw600), date in mono, history icon + overflow icon
  2. **Calorie hero card**: large SVG ring (128px) showing calories eaten / goal; remaining kcal large mono; GOAL + BURN data in mono; status badge (Fuel up / On track / At goal); three `MacroRing` components (protein/mint, carbs/gold, fat/sky)
  3. **Action buttons**: "Log with AI" (ignite-wash bg) → opens `NutritionChat` sheet; "Add manually" (surface bg) → opens `ManualEntry` sheet
  4. **Macro split bars**: horizontal progress bars per macro with label + value
  5. **Today's log**: list of food entries (meal-slot initial avatar, food name, macros in mono, kcal); empty state with prompt
- Data: on mount, call `GET /api/nutrition/today`; call `GET /api/nutrition/goals` for targets
- `NutritionChat` sheet: connect to `POST /api/nutrition/chat`; on success, append entry + call `GET /api/nutrition/today` to refresh totals
- `ManualEntry` sheet: on save, call `POST /api/nutrition/log`; refresh totals
- Saved recipes: store in `localStorage` as JSON array keyed by `nutrition_recipes_<userId>`; load/save client-side only (no backend table)
- Bottom nav: use the 5-tab BottomNav from App.jsx with `active="fuel"`

**Patterns to follow:** `screens-nutrition.jsx` as design reference; `DailyPlanTab.jsx` for CSS variable + font-display patterns; `ChatWidget.jsx` for chat UX pattern

**Test scenarios:**
- Happy path: page loads, shows real totals from API, ring shows correct fill
- Happy path: "Log with AI" → type food description → macro card appears in chat → entry added to today's log
- Happy path: "Add manually" → fill form → entry appears in list, totals update
- Edge case: no food logged yet → empty state visible, ring shows 0
- Edge case: biometrics not set → default goal shown, flag visible to user
- Integration: entry logged via main coach chat appears in today's list on this page

**Verification:** Fuel tab renders; AI and manual logging both work; totals update after each log entry.

---

- [ ] **U12: ActivityDetailPage — WeightTraining Variant**

**Goal:** When an activity is `sport_type === 'WeightTraining'`, show strength data instead of map + running stats.

**Requirements:** R4, R5

**Dependencies:** U01, U04

**Files:**
- Modify: `frontend/src/ActivityDetailPage.jsx`
- Modify: `backend/routes/activities.js` (add `GET /api/activities/:id/strength` endpoint returning sets + computed stats)

**Approach:**

Backend endpoint `GET /api/activities/:id/strength`:
- Query `weight_training_sets` for this activity
- Compute: total tonnage (sum of sets × reps × weight_kg), per-muscle-group set counts, set count total
- Return: `{ sets, total_tonnage_kg, muscle_groups: { chest: 8, back: 10, ... }, set_count }`

Frontend in `ActivityDetailPage.jsx`:
- After fetching activity data, check `activity.sport_type === 'WeightTraining'`
- If WeightTraining: hide the Leaflet map and running-specific stats; instead show:
  - **Tonnage hero card**: total tonnage in mono-large, set count, workout duration
  - **Muscle-group breakdown**: horizontal bars per muscle group showing set count; color = `--color-sky` (strength color from Activity list)
  - **Exercise list**: grouped by exercise name, showing sets × reps @ weight_kg for each set
  - **Coach insight card** (if available): same ignite-wash card as running
- If not WeightTraining: existing layout unchanged
- Call `GET /api/activities/:id/strength` for WeightTraining activities; handle loading/error states

**Patterns to follow:** Existing 2-column stats grid in `ActivityDetailPage.jsx`; `screens-activity-v2.jsx` for any additional patterns; muscle group horizontal bar style mirrors `NutritionPage.jsx` macro bars

**Test scenarios:**
- Running activity: map + pace stats shown, no tonnage card
- WeightTraining activity with parsed sets: tonnage hero + muscle breakdown + exercise list shown
- WeightTraining with no parsed sets (confidence: none): empty state shown with "No structured data found" message
- Muscle-group counts are correct (verified against `weight_training_sets` rows)

**Verification:** Running detail unchanged; WeightTraining detail shows strength-specific layout with real data.

---

- [ ] **U13: Verification Pass**

**Goal:** Read-only fidelity and integration check across all 12 units.

**Requirements:** All

**Dependencies:** U01–U12 all completed

**Files:** Read-only; no writes

**Approach:**
- Check CHECKPOINT.md — all units marked completed
- Verify database: all tables exist with correct columns
- Verify frontend routes: `#/profile`, `#/coach`, `#/fuel`, `#/activity/:id` render correct components
- Verify token usage: no hardcoded hex colors or `slate/emerald/teal/rose` Tailwind classes in modified files
- Verify no Lucide imports in ProfilePage or ChatWidget
- Verify API endpoints respond (can check via curl or read route files)
- Verify BottomNav has exactly 5 tabs; coach center button navigates to `#/coach`
- Verify NutritionPage makes real API calls (not static mock data)
- Flag any remaining issues in a summary

**Test scenarios:**
- Manual checklist verification (read files, check for forbidden patterns via grep)

**Verification:** Written summary of pass/fail for each unit's checklist items.

---

## System-Wide Impact

- **Interaction graph:** Strava sync handler now branches for WeightTraining; coach chat now has a pre-filter for food intent. Both changes are additive (no existing code removed).
- **Error propagation:** Strength parser failures (regex fail + LLM error) should log a warning and continue sync without crashing. Nutrition API failures should return 500 with JSON error (not HTML).
- **State lifecycle risks:** `weight_training_sets` DELETE + re-insert on hash change is done in a transaction. `nutrition_goals` UPSERT uses ON CONFLICT DO UPDATE.
- **API surface parity:** New nutrition routes must all use `requireAuth` middleware. Biometric fields are excluded from any admin or aggregate query.
- **Integration coverage:** Food logged via main coach chat must appear in `GET /api/nutrition/today`. Strength sets synced via Strava must appear in `GET /api/activities/:id/strength`.
- **Unchanged invariants:** CalendarPage, DailyPlanTab, running ActivityDetail, existing coach features all remain unchanged. Demo-user guard preserved in all sync paths.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hevy export format varies — regex confidence too low | LLM fallback covers edge cases; `confidence: 'none'` shows graceful empty state |
| Strava `sport_type` for Hevy sessions may be `'Workout'` not `'WeightTraining'` | Check both strings; log actual values from first real sync |
| TDEE returns unreasonable values without biometrics | Default 2000 kcal goal with visible `biometrics_missing` flag |
| Retroactive parse script may be slow for large activity histories | Run in batches of 20; add progress logging; idempotent via hash |
| Nav design conflict (R20 vs design 5-tab) | Accepted: follow design; Calendar accessible via DailyPlanTab header button |
| /tmp/striive-handoff cleared between sessions | Re-extract: `unzip /mnt/f/Striive-handoff.zip -d /tmp/striive-handoff` |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-24-striive-fitness-expansion-requirements.md](docs/brainstorms/2026-04-24-striive-fitness-expansion-requirements.md)
- **Existing design plan:** striive_v2_plan.md
- **Design files:** `/tmp/striive-handoff/striive/project/redesign/` (source: `/mnt/f/Striive-handoff.zip`)
- **BottomNav reference:** `proto-routes-a.jsx → BottomNavC`
- **Nutrition screen reference:** `screens-nutrition.jsx → NutritionScreen`
- **Profile/Chat reference:** `screens-misc.jsx → ProfileGoals`, `ChatScreen`
- **Token reference:** `tokens.jsx → T object` and `frontend/src/index.css`
