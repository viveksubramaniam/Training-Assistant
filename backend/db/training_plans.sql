-- AI Coach Training Plans Schema
-- Extension of the main run-coach-app schema

-- ============================================================================
-- USER GOALS TABLE
-- Stores user's training goals and preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    
    -- Goal details
    goal_type VARCHAR(50) NOT NULL,         -- '5K', '10K', 'Half Marathon', 'Marathon', 'General Fitness'
    target_date DATE,
    weekly_target_distance REAL,            -- km
    preferred_workout_days JSONB,           -- ['Mon', 'Wed', 'Fri', 'Sun']
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_active ON user_goals(user_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- MASTER PLANS TABLE
-- Full training plan generated when goal is created
-- ============================================================================
CREATE TABLE IF NOT EXISTS master_plans (
    id BIGSERIAL PRIMARY KEY,
    goal_id BIGINT NOT NULL REFERENCES user_goals(id) ON DELETE CASCADE,
    
    -- Plan data
    weeks JSONB NOT NULL,                   -- Array of weekly themes/goals
    total_weeks INTEGER NOT NULL,
    peak_week INTEGER,                      -- Week with highest volume
    taper_start_week INTEGER,               -- When to start reducing
    
    -- AI metadata
    model VARCHAR(100),
    
    -- Timestamps
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_plans_goal ON master_plans(goal_id);

-- ============================================================================
-- WEEKLY PLAN CACHE TABLE
-- Cached weekly workout schedules
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_plan_cache (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    
    -- Plan data
    plan_data JSONB NOT NULL,               -- Full week's workouts
    
    -- Timestamps
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_cache_user_week ON weekly_plan_cache(user_id, week_start);

-- ============================================================================
-- DAILY PLAN CACHE TABLE
-- Cached daily workout recommendations
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_plan_cache (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    
    -- Plan data
    plan_data JSONB NOT NULL,               -- 3 workout options + points
    
    -- Invalidation tracking
    last_activity_id BIGINT,                -- Track which activity was latest when cached
    chat_modified BOOLEAN DEFAULT FALSE,    -- If user modified via chat
    
    -- Timestamps
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_cache_user_date ON daily_plan_cache(user_id, plan_date);

-- ============================================================================
-- ACTIVITY POINTS TABLE
-- Points awarded by AI for completed activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_points (
    activity_id BIGINT PRIMARY KEY REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    points INTEGER NOT NULL,
    reason TEXT,                            -- "Completed as planned", "Extra effort bonus"
    
    -- Timestamps
    awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COACH CONVERSATIONS TABLE
-- Chat history with the AI coach
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    
    role VARCHAR(10) NOT NULL,              -- 'user' or 'assistant'
    message TEXT NOT NULL,
    
    -- Context at time of message (optional)
    context JSONB,                          -- Current workout context if relevant
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_conversations_user ON coach_conversations(user_id, created_at DESC);

-- ============================================================================
-- TRIGGER: Update updated_at on user_goals
-- ============================================================================
DROP TRIGGER IF EXISTS user_goals_updated_at ON user_goals;
CREATE TRIGGER user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
