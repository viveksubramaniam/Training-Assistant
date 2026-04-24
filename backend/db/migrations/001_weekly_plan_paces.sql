-- Migration: Add personalized pace columns to weekly_plan_cache
-- Resolves GitHub issue #9: daily plans should follow current activity and performance levels

ALTER TABLE weekly_plan_cache
    ADD COLUMN IF NOT EXISTS weekly_easy_pace    VARCHAR(20),  -- e.g. "5:45"  (mm:ss /km)
    ADD COLUMN IF NOT EXISTS weekly_tempo_pace   VARCHAR(20),  -- e.g. "5:00"  (mm:ss /km)
    ADD COLUMN IF NOT EXISTS weekly_long_run_pace VARCHAR(20); -- e.g. "5:50"  (mm:ss /km)
