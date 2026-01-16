-- Run Coach App PostgreSQL Schema
-- Compatible with Supabase (PostgreSQL 15+)
-- Requires: pgvector extension enabled

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- USERS TABLE
-- Stores Strava user profiles and OAuth tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    strava_id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    access_token VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    expires_at BIGINT NOT NULL,
    profile_url TEXT,
    last_sync_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACTIVITIES TABLE
-- Core activity data from Strava summary API
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
    strava_activity_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255),
    sport_type VARCHAR(50),
    workout_type VARCHAR(50),
    device_name VARCHAR(100),
    
    -- Metrics
    distance REAL,                    -- meters
    moving_time INTEGER,              -- seconds
    elapsed_time INTEGER,             -- seconds
    total_elevation_gain REAL,        -- meters
    
    -- Timestamps
    start_date TIMESTAMPTZ NOT NULL,
    start_date_local TIMESTAMPTZ,
    timezone VARCHAR(100),
    utc_offset INTEGER,               -- seconds
    
    -- Performance metrics (commonly queried)
    average_speed REAL,
    max_speed REAL,
    average_heartrate REAL,
    max_heartrate REAL,
    average_watts REAL,
    max_watts REAL,
    weighted_average_watts REAL,
    suffer_score INTEGER,
    calories REAL,
    
    -- Location
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    
    -- Flags
    has_heartrate BOOLEAN DEFAULT FALSE,
    has_detailed_data BOOLEAN DEFAULT FALSE,
    trainer BOOLEAN DEFAULT FALSE,
    commute BOOLEAN DEFAULT FALSE,
    manual BOOLEAN DEFAULT FALSE,
    private BOOLEAN DEFAULT FALSE,
    flagged BOOLEAN DEFAULT FALSE,
    
    -- Counters
    achievement_count INTEGER DEFAULT 0,
    kudos_count INTEGER DEFAULT 0,
    pr_count INTEGER DEFAULT 0,
    
    -- Store full Strava response for fields we don't explicitly model
    raw_summary JSONB,
    
    -- Metadata
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_sport ON activities(user_id, sport_type);
CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type);

-- ============================================================================
-- ACTIVITY DETAILS TABLE
-- Extended data fetched on-demand (polylines, zones, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_details (
    activity_id BIGINT PRIMARY KEY REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    -- Description
    description TEXT,
    
    -- Map data
    polyline TEXT,              -- Full resolution encoded polyline
    summary_polyline TEXT,      -- Compressed polyline
    
    -- Elevation
    elev_high REAL,
    elev_low REAL,
    
    -- Structured data stored as JSONB for flexibility
    zones JSONB,                -- Heart rate/power zone distribution
    best_efforts JSONB,         -- Best effort times (5K, 10K, etc.)
    segment_efforts JSONB,      -- Strava segment matching
    splits_metric JSONB,        -- Kilometer splits
    splits_standard JSONB,      -- Mile splits
    laps JSONB,                 -- Lap data (also in separate table for querying)
    
    -- Gear
    gear_id VARCHAR(50),
    gear_name VARCHAR(255),
    
    -- Metadata
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACTIVITY STREAMS TABLE
-- Time-series data for charts (HR, pace, altitude, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_streams (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    stream_type VARCHAR(50) NOT NULL,  -- time, heartrate, velocity_smooth, altitude, etc.
    data JSONB NOT NULL,               -- Array of values
    resolution VARCHAR(20),            -- low, medium, high
    series_type VARCHAR(20),           -- distance, time
    original_size INTEGER,             -- Original number of data points
    
    UNIQUE(activity_id, stream_type)
);

CREATE INDEX IF NOT EXISTS idx_streams_activity ON activity_streams(activity_id);

-- ============================================================================
-- ACTIVITY LAPS TABLE
-- Normalized lap data for efficient querying
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_laps (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    lap_index INTEGER NOT NULL,
    name VARCHAR(100),
    
    -- Metrics
    distance REAL,
    elapsed_time INTEGER,
    moving_time INTEGER,
    average_speed REAL,
    max_speed REAL,
    average_heartrate REAL,
    max_heartrate REAL,
    average_watts REAL,
    average_cadence REAL,
    total_elevation_gain REAL,
    
    -- Position in stream data
    start_index INTEGER,
    end_index INTEGER,
    
    UNIQUE(activity_id, lap_index)
);

CREATE INDEX IF NOT EXISTS idx_laps_activity ON activity_laps(activity_id);

-- ============================================================================
-- AI SUMMARIES TABLE
-- Versioned AI coaching analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_summaries (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL,
    
    -- Parsed AI response fields
    run_type VARCHAR(100),           -- "Easy Run", "Tempo", "Intervals", etc.
    relative_effort VARCHAR(50),     -- "Low", "Moderate", "High"
    summary_text TEXT,               -- Main analysis
    highlight TEXT,                  -- Key positive observation
    suggestion TEXT,                 -- Coaching recommendation
    
    -- Raw AI response
    raw_response TEXT,
    
    -- Model info
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'success',
    
    -- Selection
    is_selected BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(activity_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_summaries_activity ON ai_summaries(activity_id);

-- ============================================================================
-- ACTIVITY EMBEDDINGS TABLE
-- Vector embeddings for semantic search (AI coaching agent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_embeddings (
    activity_id BIGINT PRIMARY KEY REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    
    -- Vector embedding (1536 dimensions for OpenAI, adjust as needed)
    embedding vector(1536),
    
    -- Metadata
    embedding_model VARCHAR(100),
    embedding_type VARCHAR(50) DEFAULT 'summary',  -- 'summary', 'full', 'metrics'
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON activity_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional for Supabase
-- Uncomment if using Supabase Auth
-- ============================================================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_details ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_streams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_laps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AI COACH TRAINING PLANS SCHEMA
-- ============================================================================

-- USER GOALS TABLE
CREATE TABLE IF NOT EXISTS user_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,
    target_date DATE,
    weekly_target_distance REAL,
    preferred_workout_days JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_active ON user_goals(user_id, is_active) WHERE is_active = TRUE;

-- MASTER PLANS TABLE
CREATE TABLE IF NOT EXISTS master_plans (
    id BIGSERIAL PRIMARY KEY,
    goal_id BIGINT NOT NULL REFERENCES user_goals(id) ON DELETE CASCADE,
    weeks JSONB NOT NULL,
    total_weeks INTEGER NOT NULL,
    peak_week INTEGER,
    taper_start_week INTEGER,
    model VARCHAR(100),
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_plans_goal ON master_plans(goal_id);

-- WEEKLY PLAN CACHE TABLE
CREATE TABLE IF NOT EXISTS weekly_plan_cache (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    plan_data JSONB NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_cache_user_week ON weekly_plan_cache(user_id, week_start);

-- DAILY PLAN CACHE TABLE
CREATE TABLE IF NOT EXISTS daily_plan_cache (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    plan_data JSONB NOT NULL,
    last_activity_id BIGINT,
    chat_modified BOOLEAN DEFAULT FALSE,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_cache_user_date ON daily_plan_cache(user_id, plan_date);

-- ACTIVITY POINTS TABLE
CREATE TABLE IF NOT EXISTS activity_points (
    activity_id BIGINT PRIMARY KEY REFERENCES activities(strava_activity_id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason TEXT,
    awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- COACH CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS coach_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_conversations_user ON coach_conversations(user_id, created_at DESC);

-- Trigger for user_goals updated_at
DROP TRIGGER IF EXISTS user_goals_updated_at ON user_goals;
CREATE TRIGGER user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
