-- ============================================================================
-- Migration: 001_fitness_expansion
-- Description: Striive fitness expansion — adds nutrition tracking, weight
--              training sets, and extended user profile columns.
-- Compatible with: Supabase PostgreSQL 15+
-- Idempotent: YES — safe to run multiple times (IF NOT EXISTS / IF column NOT EXISTS)
-- Applied: 2026-04-24
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: Extend users table with body metrics and macro targets
-- Note: Supabase PostgreSQL 15+ supports ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- ----------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm REAL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg REAL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS macro_protein_pct REAL DEFAULT 0.30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS macro_carb_pct REAL DEFAULT 0.45;
ALTER TABLE users ADD COLUMN IF NOT EXISTS macro_fat_pct REAL DEFAULT 0.25;

-- ----------------------------------------------------------------------------
-- SECTION 2: weight_training_sets
-- Stores individual sets extracted from Strava WeightTraining activity
-- descriptions. Linked to activities(strava_activity_id) and users(strava_id).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weight_training_sets (
    id              BIGSERIAL PRIMARY KEY,
    activity_id     BIGINT NOT NULL REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    set_number      INTEGER NOT NULL,
    reps            INTEGER,
    weight_kg       REAL,
    muscle_groups   TEXT[],
    description_hash TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_set_number CHECK (set_number > 0),
    CONSTRAINT valid_reps       CHECK (reps IS NULL OR reps > 0),
    CONSTRAINT valid_weight     CHECK (weight_kg IS NULL OR weight_kg > 0)
);

-- Performance indexes for weight_training_sets
-- Primary lookup pattern: user's sets for an activity
CREATE INDEX IF NOT EXISTS idx_wts_activity     ON weight_training_sets(activity_id);
CREATE INDEX IF NOT EXISTS idx_wts_user_created ON weight_training_sets(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- SECTION 3: food_logs
-- Stores individual food log entries (one row per meal/item logged).
-- Source distinguishes chat-parsed vs manually entered logs.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS food_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    logged_at    TIMESTAMPTZ DEFAULT NOW(),
    description  TEXT,
    meal_slot    TEXT,                          -- e.g. 'breakfast', 'lunch', 'dinner', 'snack'
    kcal         INTEGER,
    protein_g    INTEGER,
    carbs_g      INTEGER,
    fat_g        INTEGER,
    fibre_g      INTEGER,
    source       TEXT CHECK (source IN ('chat', 'manual')),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for food_logs
-- Primary lookup: all logs for a user on a given day (logged_at::date = ?)
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON food_logs(user_id, logged_at DESC);

-- ----------------------------------------------------------------------------
-- SECTION 4: nutrition_goals
-- One row per (user, date). Stores daily macro/calorie targets.
-- UNIQUE constraint enforces single goal row per day per user.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nutrition_goals (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    kcal_goal       INTEGER,
    protein_g_goal  INTEGER,
    carbs_g_goal    INTEGER,
    fat_g_goal      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, date)
);

-- Performance indexes for nutrition_goals
-- Primary lookup: goal for a specific user and date
CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user_date ON nutrition_goals(user_id, date DESC);

-- ----------------------------------------------------------------------------
-- SECTION 5: nutrition_conversations
-- Stores the chat history for the nutrition/fuel AI coach conversation.
-- Mirrors the coach_conversations pattern (role + content per message).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nutrition_conversations (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    role       TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
    content    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance index for nutrition_conversations
-- Primary lookup: conversation history for a user in chronological order
CREATE INDEX IF NOT EXISTS idx_nutrition_conv_user ON nutrition_conversations(user_id, created_at DESC);