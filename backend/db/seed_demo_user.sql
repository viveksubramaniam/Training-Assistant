-- ============================================================================
-- DEMO USER SEED SCRIPT (Idempotent)
-- Run: psql $DATABASE_URL -f backend/db/seed_demo_user.sql
-- ============================================================================

-- Fixed Demo User ID
-- Using 999999999 to avoid collision with real Strava IDs
DO $$ BEGIN RAISE NOTICE 'Seeding demo user (strava_id = 999999999)...'; END $$;

-- ============================================================================
-- 1. DEMO USER
-- ============================================================================
INSERT INTO users (strava_id, name, access_token, refresh_token, expires_at, profile_url, last_sync_time)
VALUES (
    999999999,
    'Demo Runner',
    'demo_access_token',
    'demo_refresh_token',
    9999999999,
    NULL,
    NOW()
)
ON CONFLICT (strava_id) DO UPDATE SET
    name = EXCLUDED.name,
    last_sync_time = NOW();

-- ============================================================================
-- 2. ACTIVITIES  (~15 runs over the past 4 weeks)
-- ============================================================================
-- Clean existing demo activities first
DELETE FROM activities WHERE user_id = 999999999;

INSERT INTO activities (
    strava_activity_id, user_id, name, sport_type, workout_type,
    distance, moving_time, elapsed_time, total_elevation_gain,
    start_date, start_date_local, timezone,
    average_speed, max_speed, average_heartrate, max_heartrate,
    has_heartrate, has_detailed_data, calories, suffer_score
) VALUES
-- Week 4 (most recent)
(900000001, 999999999, 'Morning Easy Run',          'Run', 'Run', 5200,  1800, 1860, 35,  NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day',  '(GMT-05:00) America/New_York', 2.89, 3.5, 138, 155, true, false, 320, 45),
(900000002, 999999999, 'Tempo Tuesday',              'Run', 'Run', 8000,  2400, 2520, 52,  NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', '(GMT-05:00) America/New_York', 3.33, 4.2, 162, 178, true, false, 510, 78),
(900000003, 999999999, 'Recovery Jog',               'Run', 'Run', 4000,  1500, 1560, 18,  NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', '(GMT-05:00) America/New_York', 2.67, 3.1, 128, 142, true, false, 240, 28),
(900000004, 999999999, 'Weekend Long Run',           'Run', 'Run', 16000, 5400, 5700, 95,  NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', '(GMT-05:00) America/New_York', 2.96, 3.8, 148, 168, true, false, 980, 110),

-- Week 3
(900000005, 999999999, 'Easy Aerobic Run',           'Run', 'Run', 6500,  2200, 2300, 40,  NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days',  '(GMT-05:00) America/New_York', 2.95, 3.6, 140, 158, true, false, 400, 52),
(900000006, 999999999, 'Interval Session',           'Run', 'Run', 7000,  2100, 2400, 28,  NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', '(GMT-05:00) America/New_York', 3.33, 5.0, 168, 185, true, false, 480, 95),
(900000007, 999999999, 'Steady State Run',           'Run', 'Run', 10000, 3300, 3420, 65,  NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', '(GMT-05:00) America/New_York', 3.03, 3.7, 152, 170, true, false, 620, 72),
(900000008, 999999999, 'Saturday Long Run',          'Run', 'Run', 14000, 4800, 5100, 88,  NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days', '(GMT-05:00) America/New_York', 2.92, 3.5, 146, 165, true, false, 850, 98),

-- Week 2
(900000009, 999999999, 'Shakeout Run',               'Run', 'Run', 3500,  1300, 1350, 15,  NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', '(GMT-05:00) America/New_York', 2.69, 3.2, 130, 145, true, false, 210, 25),
(900000010, 999999999, 'Fartlek Fun',                'Run', 'Run', 8500,  2700, 2820, 48,  NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days', '(GMT-05:00) America/New_York', 3.15, 4.8, 158, 182, true, false, 530, 82),
(900000011, 999999999, 'Hill Repeats',               'Run', 'Run', 6000,  2100, 2280, 120, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days', '(GMT-05:00) America/New_York', 2.86, 4.0, 165, 188, true, false, 420, 88),
(900000012, 999999999, 'Long Run with Strides',      'Run', 'Run', 18000, 6000, 6300, 110, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', '(GMT-05:00) America/New_York', 3.00, 4.2, 150, 172, true, false, 1100, 120),

-- Week 1 (oldest)
(900000013, 999999999, 'Easy Recovery',              'Run', 'Run', 4500,  1700, 1740, 22,  NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', '(GMT-05:00) America/New_York', 2.65, 3.0, 125, 140, true, false, 270, 22),
(900000014, 999999999, 'Threshold Cruise Intervals', 'Run', 'Run', 9000,  2850, 3000, 55,  NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days', '(GMT-05:00) America/New_York', 3.16, 4.5, 170, 186, true, false, 580, 92),
(900000015, 999999999, 'Progressive Long Run',       'Run', 'Run', 15000, 5100, 5400, 78,  NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days', '(GMT-05:00) America/New_York', 2.94, 3.9, 148, 170, true, false, 920, 105);

-- ============================================================================
-- 3. AI SUMMARIES (for 5 key activities)
-- ============================================================================
DELETE FROM ai_summaries WHERE activity_id IN (900000001, 900000002, 900000004, 900000006, 900000012);

INSERT INTO ai_summaries (activity_id, version_number, run_type, relative_effort, summary_text, highlight, suggestion, is_selected) VALUES
(900000001, 1, 'Easy Run',      'Low',      'A well-paced easy run that kept heart rate in the aerobic zone. Good recovery effort between harder sessions.',                                     'Heart rate remained consistently below 140 bpm — excellent aerobic discipline.',     'Consider adding 4x20s strides at the end of easy runs to maintain neuromuscular speed.', true),
(900000002, 1, 'Tempo Run',     'Moderate', 'Strong tempo effort with a consistent pace throughout. The negative split in the second half shows growing fitness and mental toughness.',            'Averaged 5:00/km pace with a 162 bpm heart rate — efficient aerobic threshold work.', 'Try extending the tempo portion by 5 minutes next session to build lactate tolerance.',  true),
(900000004, 1, 'Long Run',      'High',     'Excellent long run that builds endurance for your half-marathon goal. Pacing was well-controlled with smart fueling.',                               'Maintained a steady 5:37/km pace over 16km — a key building block for race readiness.', 'Ensure you take a full rest day after long runs. Hydration and sleep are critical.',     true),
(900000006, 1, 'Intervals',     'High',     'High-quality interval session with strong repeats. The 5:00/km+ efforts are developing speed and VO2max capacity.',                                'Hit a max speed of 5.0 m/s during repeats — your fastest session this training block!', 'Keep 2-3 minute recovery jogs between intervals. Don''t rush the rest periods.',          true),
(900000012, 1, 'Long Run',      'High',     'An impressive 18km long run with strides mixed in. This is peak endurance work that directly prepares you for race distance.',                     'Completed 18km with negative splits — your longest and strongest run of the block!',   'You''re building great aerobic capacity. Consider a cutback week soon to absorb gains.', true);

-- ============================================================================
-- 4. USER GOAL (Active half-marathon goal)
-- ============================================================================
DELETE FROM user_goals WHERE user_id = 999999999;

INSERT INTO user_goals (user_id, goal_type, target_date, weekly_target_distance, preferred_workout_days, is_active)
VALUES (
    999999999,
    'Half Marathon',
    (CURRENT_DATE + INTERVAL '10 weeks')::DATE,
    40.0,
    '["Monday", "Wednesday", "Thursday", "Saturday"]'::jsonb,
    true
);

-- ============================================================================
-- 5. MASTER PLAN (12-week half-marathon plan)
-- ============================================================================
DELETE FROM master_plans WHERE goal_id IN (SELECT id FROM user_goals WHERE user_id = 999999999);

INSERT INTO master_plans (goal_id, weeks, total_weeks, peak_week, taper_start_week, model)
SELECT
    g.id,
    '[
        {"week": 1, "theme": "Base Building", "totalDistance": 28, "longRun": 12, "keyWorkout": "Easy aerobic runs", "intensity": "low"},
        {"week": 2, "theme": "Base Building", "totalDistance": 32, "longRun": 14, "keyWorkout": "Steady state run", "intensity": "low"},
        {"week": 3, "theme": "Endurance Development", "totalDistance": 36, "longRun": 16, "keyWorkout": "Tempo intervals", "intensity": "moderate"},
        {"week": 4, "theme": "Cutback Week", "totalDistance": 25, "longRun": 10, "keyWorkout": "Recovery focus", "intensity": "low"},
        {"week": 5, "theme": "Strength Phase", "totalDistance": 38, "longRun": 16, "keyWorkout": "Hill repeats", "intensity": "moderate"},
        {"week": 6, "theme": "Speed Development", "totalDistance": 40, "longRun": 18, "keyWorkout": "Cruise intervals", "intensity": "high"},
        {"week": 7, "theme": "Peak Volume", "totalDistance": 42, "longRun": 20, "keyWorkout": "Race pace segments", "intensity": "high"},
        {"week": 8, "theme": "Cutback Week", "totalDistance": 30, "longRun": 12, "keyWorkout": "Easy running", "intensity": "low"},
        {"week": 9, "theme": "Race Sharpening", "totalDistance": 38, "longRun": 16, "keyWorkout": "Tempo + strides", "intensity": "moderate"},
        {"week": 10, "theme": "Race Sharpening", "totalDistance": 36, "longRun": 14, "keyWorkout": "Goal pace practice", "intensity": "moderate"},
        {"week": 11, "theme": "Taper", "totalDistance": 25, "longRun": 10, "keyWorkout": "Short sharpeners", "intensity": "low"},
        {"week": 12, "theme": "Race Week", "totalDistance": 24, "longRun": 21.1, "keyWorkout": "RACE DAY!", "intensity": "race"}
    ]'::jsonb,
    12,
    7,
    11,
    'demo-seed'
FROM user_goals g WHERE g.user_id = 999999999 AND g.is_active = true
LIMIT 1;

-- ============================================================================
-- 6. WEEKLY PLAN CACHE (current week)
-- ============================================================================
-- Calculate current Monday
DELETE FROM weekly_plan_cache WHERE user_id = 999999999;

INSERT INTO weekly_plan_cache (user_id, week_start, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
VALUES (
    999999999,
    DATE_TRUNC('week', CURRENT_DATE)::DATE, -- Monday of current week
    '{"dayName": "Monday", "workout_type": "Easy Run", "title": "Easy Aerobic Run", "distance": 6, "target_time": "35 mins", "target_pace": "5:50/km", "intensity": 3, "description": "Comfortable pace to build aerobic base.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Tuesday", "workout_type": "Rest", "title": "Rest Day", "distance": 0, "target_time": "0 mins", "target_pace": "-", "intensity": 0, "description": "Full recovery day.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Wednesday", "workout_type": "Tempo", "title": "Tempo Intervals", "distance": 8, "target_time": "40 mins", "target_pace": "5:00/km", "intensity": 7, "description": "3x10min at tempo pace with 2min jog recovery.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Thursday", "workout_type": "Easy Run", "title": "Recovery Run", "distance": 5, "target_time": "30 mins", "target_pace": "6:00/km", "intensity": 2, "description": "Very easy effort to flush out fatigue from tempo.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Friday", "workout_type": "Rest", "title": "Rest Day", "distance": 0, "target_time": "0 mins", "target_pace": "-", "intensity": 0, "description": "Rest before long run.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Saturday", "workout_type": "Long Run", "title": "Long Run with Strides", "distance": 16, "target_time": "90 mins", "target_pace": "5:37/km", "intensity": 6, "description": "Build endurance with 4x100m strides in last 2km.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb,
    '{"dayName": "Sunday", "workout_type": "Rest", "title": "Active Recovery", "distance": 0, "target_time": "0 mins", "target_pace": "-", "intensity": 0, "description": "Light stretching or yoga. Full rest.", "weekNumber": 5, "weekTheme": "Strength Phase", "weekFocus": "Building endurance"}'::jsonb
);

-- ============================================================================
-- 7. DAILY PLAN CACHE (today)
-- ============================================================================
DELETE FROM daily_plan_cache WHERE user_id = 999999999;

INSERT INTO daily_plan_cache (user_id, plan_date, plan_data)
VALUES (
    999999999,
    CURRENT_DATE,
    '{
        "recommended": {
            "title": "Tempo Intervals",
            "description": "3x10 minutes at tempo pace with 2-minute easy jog recovery between sets. Focus on controlled breathing and consistent rhythm.",
            "duration": "40 min",
            "distance": "8 km",
            "targetPace": "5:00/km",
            "coachTip": "Start conservative — the last interval should feel hard but doable. This builds lactate tolerance for race day."
        },
        "option_2": {
            "title": "Easy Recovery Run",
            "description": "Keep it very easy today. Conversational pace only — this is about blood flow, not fitness gains.",
            "duration": "25 min",
            "distance": "4 km",
            "targetPace": "6:30/km",
            "coachTip": "If your legs feel heavy from the weekend long run, this is the smart choice."
        },
        "option_3": {
            "title": "Progressive Run",
            "description": "Start easy and gradually increase pace every 2km. Finish the last km near tempo effort.",
            "duration": "35 min",
            "distance": "7 km",
            "targetPace": "5:45 → 4:50/km",
            "coachTip": "Great option if you feel fresh but want variety. The progression teaches pace awareness."
        }
    }'::jsonb
);

-- ============================================================================
-- DONE
-- ============================================================================
DO $$ BEGIN RAISE NOTICE 'Demo user seeded successfully! Login with the "Try Demo" button.'; END $$;
