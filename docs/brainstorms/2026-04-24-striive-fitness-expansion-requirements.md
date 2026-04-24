---
date: 2026-04-24
topic: striive-fitness-expansion
---

# Striive: All-Around Fitness Tracker Expansion

## Problem Frame

Striive is currently a running-only coaching app. The user wants to expand it into a holistic fitness tracker that retains its running specialisation but adds two new pillars:

1. **Strength tracking** — automatically parse weight-training sessions synced from Hevy via Strava, tracking volume (tonnage + muscle-group sets) over time.
2. **Nutrition tracking** — an LLM-powered food log accessible from the main chat and a dedicated food tracker page, with macro goals dynamically calculated from the user's activity data, height, and weight.

The frontend design will be handled separately (via Claude design tooling). This document covers product logic only.

```
┌──────────────────────────────────────────────────────────────┐
│                        STRIIVE                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Running     │  │  Strength        │  │  Nutrition    │  │
│  │  Coach       │  │  Tracker         │  │  Tracker      │  │
│  │  (existing)  │  │  (new)           │  │  (new)        │  │
│  │              │  │                  │  │               │  │
│  │ Plans, daily │  │ Hevy→Strava      │  │ Chat-based    │  │
│  │ coaching,    │  │ parsing,         │  │ food logging, │  │
│  │ AI chat      │  │ volume trends    │  │ macro goals   │  │
│  └──────────────┘  └──────────────────┘  └───────────────┘  │
│                         ↑ all feed into ↑                    │
│            Macro/calorie goal auto-calculation (TDEE)        │
└──────────────────────────────────────────────────────────────┘
```

---

## Requirements

### Strength Tracking

- **R1.** When syncing Strava activities, identify weight-training sessions by `sport_type = 'WeightTraining'` (or equivalent Strava type).
- **R2.** Parse the `description` field from `activity_details` into structured sets: exercise name, sets, reps, and weight (kg). Use regex first; fall back to LLM parsing when regex confidence is low.
- **R3.** Store parsed sets in a new `weight_training_sets` table linked to the activity.
- **R4.** Expose a volume summary per workout session showing two metrics:
  - **Total tonnage** (sum of sets × reps × weight in kg)
  - **Per-muscle-group set count** (e.g., Chest: 8 sets, Back: 10 sets, Other: 4 sets)
- **R5.** Show a volume trend over time (e.g., rolling 4-week tonnage by muscle group) so the user can see progressive overload or deload weeks.
- **R6.** The system must map exercise names to muscle groups using a static lookup table (e.g., "Bench Press" → Chest, Triceps). Unmapped exercises are shown as "Other".
- **R7.** Re-parsing is triggered when the user syncs Strava; already-parsed activities are not re-parsed unless the description has changed. Change detection uses a stored hash (e.g., SHA-256) of the description text compared on each sync. When a change is detected, the existing `weight_training_sets` rows for that activity are deleted and re-created from the new parse.

### Nutrition Tracking

- **R8.** The user can log food by describing it in natural language in either the **main coach chat** or a **dedicated nutrition chat** on the food tracker page.
- **R9.** The main coach chat must detect food-logging intent and route those messages to the nutrition log automatically, without requiring the user to navigate away.
- **R10.** The LLM response to a food log message must return **only structured macro data**: calories, protein (g), carbs (g), fat (g), and fibre (g). No conversational padding — just the breakdown.
- **R11.** The food tracker page has a dedicated chat panel with its own persisted conversation history (separate from `coach_conversations`). This context is nutrition-only.
- **R12.** Logged food entries are stored with a timestamp, the natural language description, the parsed macro values, and the meal slot (breakfast / lunch / dinner / snack — auto-inferred or user-correctable).
- **R13.** A daily summary shows actual intake vs. goal for calories, protein, carbs, and fat.
- **R14.** The user can manually add a food entry (name + manual macro values) without using the chat, as a fallback.

### Macro Goal Calculation

- **R15.** Add `height_cm`, `weight_kg`, and `date_of_birth` fields to the `users` table; these are entered on the existing Profile page.
- **R16.** Base daily calorie and macro targets are auto-calculated using a TDEE formula (Mifflin-St Jeor or Harris-Benedict) seeded with the user's height, weight, age, and a baseline activity multiplier derived from their recent Strava activity frequency.
- **R17.** On days with a completed high-intensity or long workout (based on activity `suffer_score` or moving time thresholds), the system adds a dynamic calorie surplus to the base target. On rest days, it applies the sedentary multiplier. When `suffer_score` is NULL (common for WeightTraining activities and manual entries), fall through to the moving time threshold; if moving time also unavailable, treat the day as moderate intensity.
- **R18.** Macro splits (protein/carb/fat percentages) default to a performance-athlete preset (e.g., 30% protein / 45% carb / 25% fat) but can be overridden by the user on the Profile page.
- **R19.** Recalculate goals nightly (or on demand) when new activity data is available; store computed daily targets in a `nutrition_goals` table keyed by user and date.

### App Identity

- **R20.** Add Strength and Nutrition entries to the app's primary navigation without removing or demoting existing Coach, Calendar, and Activity entries.

---

## User Flow

### Weight Training Sync Flow

```
User taps "Sync Strava"
        │
        ▼
Fetch new Strava activities
        │
        ▼
For each activity:
  sport_type = WeightTraining?
        │
   Yes  │  No
        │───────────────────────────────► Standard running sync flow
        ▼
  Fetch activity_details (description field)
        │
        ▼
  Run regex parser
        │
  Confidence ≥ threshold?
        │
   Yes  │  No
        │  └──────────────────► LLM parser (extract structured sets)
        ▼
  Store in weight_training_sets
        │
        ▼
  Map exercises → muscle groups
        │
        ▼
  Compute tonnage + set counts
        │
        ▼
  Update volume cache
```

### Nutrition Logging Flow (Main Chat)

```
User sends message in main coach chat
        │
        ▼
Intent classifier: training-related or food-related?
        │
  Food  │  Training
        │  └─────────────────────────────► Normal coach response
        ▼
LLM extracts macros from description
        │
        ▼
Return structured macro card (calories, protein, carbs, fat, fibre)
        │
        ▼
Write food_log entry (user_id, date, description, macros, meal_slot)
        │
        ▼
Show entry added confirmation + running daily total
```

---

## Success Criteria

- Weight training sessions synced from Hevy via Strava are parsed and displayed with tonnage and muscle-group volume — no manual data entry required. At least 90% of WeightTraining sessions with a non-empty description produce at least one structured set; parse failures show a graceful empty state with a manual entry prompt.
- User can describe a meal in plain language and receive a clean macro breakdown that is stored against that day.
- Daily macro summary correctly reflects both manually added and chat-logged food.
- Auto-calculated calorie targets visibly increase on hard training days vs. rest days.
- Volume trend data is visible over at least 4 weeks.

---

## Scope Boundaries

- **No Hevy API integration** — only Strava description parsing. If Hevy changes its export format, the regex/LLM parser adapts.
- **No barcode/photo food scanning** — NLP food description only in this phase.
- **No AI-generated meal plans or recipe suggestions** — only logging and macro tracking.
- **No body composition tracking** (body fat %, measurements) — only height, weight, and age on the profile.
- **No social/sharing features** for nutrition or strength data.
- **Frontend design is out of scope** — this spec covers data model, parsing logic, and API contracts only.

---

## Key Decisions

- **Hybrid Hevy parsing (regex + LLM fallback)**: Balances zero-cost fast-path for well-structured Hevy exports with LLM resilience for edge cases or added notes.
- **Volume metrics = tonnage + muscle-group sets**: Both are surfaced; neither is hidden behind a settings toggle.
- **Main chat routes food intent automatically**: Lower friction than forcing users to the food tracker page to log a meal mid-conversation.
- **TDEE auto-calculation**: System owns the goal, not the user — reducing setup friction while still allowing macro-split overrides.
- **Profile page for body metrics**: Minimal new surface area; avoids a separate body metrics section for now.
- **Separate nutrition chat persistence**: `nutrition_conversations` table is independent of `coach_conversations`, keeping nutrition context clean and enabling a focused food-tracker chat experience.

---

## Dependencies / Assumptions

- Hevy exports to Strava with a consistent enough text format that regex covers ≥80% of cases. *This assumption must be validated against real Hevy-synced Strava descriptions before committing to the regex-primary architecture.*
- `activity_details.description` is already being fetched and stored for weight-training activities (same pipeline as running). *Verify: the current on-demand detail fetch in the activities route applies to all sport types.*
- A muscle-group mapping dictionary for common exercises can be bundled as a static JSON file (no external API needed).
- TDEE calculation runs server-side; no sensitive biometric data leaves the backend.
- **Migration required**: `ALTER TABLE users ADD COLUMN height_cm REAL, ADD COLUMN weight_kg REAL, ADD COLUMN date_of_birth DATE;` must be applied before any Profile page or nutrition feature work. This is a prerequisite step.
- **Access control**: Biometric fields (`height_cm`, `weight_kg`, `date_of_birth`) and all nutrition data are readable and writable only by the authenticated user who owns the record. These fields are excluded from any aggregate or admin-facing queries. Write endpoints for food logs and goal overrides derive the target `user_id` from the authenticated session token, not from client-supplied parameters.
- **Data retention**: `nutrition_conversations` entries and food log rows are deleted on account closure. A rolling retention window (e.g., 18 months) or explicit user deletion should be defined before launch.

---

## Outstanding Questions

### Resolve Before Planning

- **[Affects R2, R7][User decision]** Does the user want Hevy descriptions re-parsed retroactively for all historical WeightTraining activities on first deploy, or only for newly synced ones going forward?

### Deferred to Planning

- **[Affects R1][Technical]** Confirm which `sport_type` values Strava uses for Hevy-synced sessions (e.g., `WeightTraining`, `Workout`, `Crossfit`) — check a real synced activity in the DB.
- **[Affects R2][Technical]** Confirm that `activity_details` is being fetched and stored for non-run activities in the current sync pipeline (`backend/routes/activities.js`).
- **[Affects R16][Technical]** Choose TDEE formula (Mifflin-St Jeor recommended) and decide where the calculation lives (backend service vs. DB-stored procedure).
- **[Affects R9][Technical]** Design the intent classifier for the main chat — lightweight keyword detection vs. small LLM classification call.
- **[Affects R3, R12, R19][Technical]** Full schema for `weight_training_sets`, `food_logs`, `nutrition_goals`, and `nutrition_conversations` tables.
- **[Affects R6][Needs research]** Compile the exercise-to-muscle-group mapping dictionary for Hevy's standard exercise library.

---

## Next Steps

→ Resolve the one `Resolve Before Planning` question, then `/ce:plan` for structured implementation planning.
