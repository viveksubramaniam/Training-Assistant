/**
 * PostgreSQL Database Adapter (Supabase)
 * 
 * This module provides PostgreSQL implementation of the database interface.
 * Uses the same function signatures as the JSON adapter for seamless switching.
 */

import pg from 'pg';
const { Pool } = pg;

// Get connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('✗ DATABASE_URL not set - PostgreSQL adapter will fail');
}

// Initialize connection pool
// Supabase requires SSL in production
export const pool = new Pool({
    connectionString,
    ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.query('SELECT NOW()')
    .then(() => console.log('✓ PostgreSQL connected to Supabase'))
    .catch(err => console.error('✗ PostgreSQL connection failed:', err.message));

/* ========================================================================== */
/*                           ACTIVITIES OPERATIONS                            */
/* ========================================================================== */

/**
 * Get a single activity by ID
 */
export const getActivity = async (userId, activityId) => {
    const result = await pool.query(`
        SELECT a.*,
               d.polyline, d.summary_polyline, d.zones, d.best_efforts,
               d.segment_efforts, d.splits_metric, d.splits_standard, d.laps as laps_json,
               d.elev_high, d.elev_low, d.description as detail_description
        FROM activities a
        LEFT JOIN activity_details d ON a.strava_activity_id = d.activity_id
        WHERE a.user_id = $1 AND a.strava_activity_id = $2
    `, [userId, activityId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const activity = mapRowToActivity(row);

    // Fetch streams
    if (activity.hasDetailedData) {
        const streams = await getActivityStreams(activityId);
        activity.streams = streams;
        console.log(`[DB] Fetched streams for ${activityId}:`, Object.keys(streams));
    }

    console.log(`[DB] Retrieved activity ${activityId}, hasDetailed: ${activity.hasDetailedData}, Map:`, !!activity.map);
    return activity;
};

/**
 * List all activities for a user
 */
export const listActivities = async (userId) => {
    const result = await pool.query(`
        SELECT * FROM activities 
        WHERE user_id = $1 
        ORDER BY start_date DESC
    `, [userId]);

    return result.rows.map(row => mapRowToActivity(row));
};

/**
 * Save/update activities for a user (bulk operation for Strava sync)
 */
export const saveActivities = async (userId, activities) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const activity of activities) {
            await client.query(`
                INSERT INTO activities (
                    strava_activity_id, user_id, name, sport_type, workout_type, device_name,
                    distance, moving_time, elapsed_time, total_elevation_gain,
                    start_date, start_date_local, timezone, utc_offset,
                    average_speed, max_speed, average_heartrate, max_heartrate,
                    average_watts, max_watts, weighted_average_watts, suffer_score, calories,
                    start_lat, start_lng, end_lat, end_lng,
                    has_heartrate, has_detailed_data, trainer, commute, manual, private, flagged,
                    achievement_count, kudos_count, pr_count,
                    raw_summary, synced_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14,
                    $15, $16, $17, $18,
                    $19, $20, $21, $22, $23,
                    $24, $25, $26, $27,
                    $28, $29, $30, $31, $32, $33, $34,
                    $35, $36, $37,
                    $38, NOW()
                )
                ON CONFLICT (strava_activity_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    sport_type = EXCLUDED.sport_type,
                    workout_type = EXCLUDED.workout_type,
                    device_name = EXCLUDED.device_name,
                    distance = EXCLUDED.distance,
                    moving_time = EXCLUDED.moving_time,
                    elapsed_time = EXCLUDED.elapsed_time,
                    total_elevation_gain = EXCLUDED.total_elevation_gain,
                    average_speed = EXCLUDED.average_speed,
                    max_speed = EXCLUDED.max_speed,
                    average_heartrate = EXCLUDED.average_heartrate,
                    max_heartrate = EXCLUDED.max_heartrate,
                    suffer_score = EXCLUDED.suffer_score,
                    achievement_count = EXCLUDED.achievement_count,
                    kudos_count = EXCLUDED.kudos_count,
                    pr_count = EXCLUDED.pr_count,
                    raw_summary = EXCLUDED.raw_summary,
                    synced_at = NOW()
            `, [
                activity.id,
                userId,
                activity.name,
                activity.sport_type || activity.type,
                activity.workout_type?.toString(),
                activity.device_name,
                activity.distance,
                activity.moving_time,
                activity.elapsed_time,
                activity.total_elevation_gain,
                activity.start_date,
                activity.start_date_local,
                activity.timezone,
                activity.utc_offset,
                activity.average_speed,
                activity.max_speed,
                activity.average_heartrate,
                activity.max_heartrate,
                activity.average_watts,
                activity.max_watts,
                activity.weighted_average_watts,
                activity.suffer_score,
                activity.calories,
                activity.start_latlng?.[0],
                activity.start_latlng?.[1],
                activity.end_latlng?.[0],
                activity.end_latlng?.[1],
                activity.has_heartrate || false,
                activity.hasDetailedData || false,
                activity.trainer || false,
                activity.commute || false,
                activity.manual || false,
                activity.private || false,
                activity.flagged || false,
                activity.achievement_count || 0,
                activity.kudos_count || 0,
                activity.pr_count || 0,
                JSON.stringify(activity)
            ]);
        }

        await client.query('COMMIT');
        return activities.length;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Update a single activity (used for caching detailed data)
 */
export const updateActivity = async (userId, activityId, updates) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update main activity record
        await client.query(`
            UPDATE activities 
            SET has_detailed_data = true, synced_at = NOW()
            WHERE strava_activity_id = $1 AND user_id = $2
        `, [activityId, userId]);

        // Upsert activity details
        await client.query(`
            INSERT INTO activity_details (
                activity_id, description, polyline, summary_polyline,
                elev_high, elev_low, zones, best_efforts, segment_efforts,
                splits_metric, splits_standard, laps, gear_id, fetched_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
            )
            ON CONFLICT (activity_id) DO UPDATE SET
                description = EXCLUDED.description,
                polyline = EXCLUDED.polyline,
                summary_polyline = EXCLUDED.summary_polyline,
                elev_high = EXCLUDED.elev_high,
                elev_low = EXCLUDED.elev_low,
                zones = EXCLUDED.zones,
                best_efforts = EXCLUDED.best_efforts,
                segment_efforts = EXCLUDED.segment_efforts,
                splits_metric = EXCLUDED.splits_metric,
                splits_standard = EXCLUDED.splits_standard,
                laps = EXCLUDED.laps,
                gear_id = EXCLUDED.gear_id,
                fetched_at = NOW()
        `, [
            activityId,
            updates.description,
            updates.map?.polyline,
            updates.map?.summary_polyline,
            updates.elev_high,
            updates.elev_low,
            JSON.stringify(updates.zones),
            JSON.stringify(updates.best_efforts),
            JSON.stringify(updates.segment_efforts),
            JSON.stringify(updates.splits_metric),
            JSON.stringify(updates.splits_standard),
            JSON.stringify(updates.laps),
            updates.gear?.id
        ]);

        console.log(`[DB] Upserted details for ${activityId}. Map present in updates:`, !!updates.map);

        // Save streams if present
        if (updates.streams) {
            for (const [streamType, streamData] of Object.entries(updates.streams)) {
                if (streamData && streamData.data) {
                    await client.query(`
                        INSERT INTO activity_streams (activity_id, stream_type, data, resolution, series_type, original_size)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (activity_id, stream_type) DO UPDATE SET
                            data = EXCLUDED.data,
                            resolution = EXCLUDED.resolution,
                            series_type = EXCLUDED.series_type,
                            original_size = EXCLUDED.original_size
                    `, [
                        activityId,
                        streamType,
                        JSON.stringify(streamData.data),
                        streamData.resolution,
                        streamData.series_type,
                        streamData.original_size
                    ]);
                }
            }
        }

        await client.query('COMMIT');

        // Return updated activity
        return getActivity(userId, activityId);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/* ========================================================================== */
/*                              USER OPERATIONS                               */
/* ========================================================================== */

/**
 * Get user data (for authentication/profile)
 */
export const getUser = async (userId) => {
    const result = await pool.query(`
        SELECT * FROM users WHERE strava_id = $1
    `, [userId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        stravaId: row.strava_id,
        name: row.name,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
        profile: row.profile_url,
        lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time).getTime() : null
    };
};

/**
 * Save/update user data
 */
export const saveUser = async (user) => {
    await pool.query(`
        INSERT INTO users (strava_id, name, access_token, refresh_token, expires_at, profile_url, last_sync_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (strava_id) DO UPDATE SET
            name = EXCLUDED.name,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            profile_url = EXCLUDED.profile_url,
            last_sync_time = EXCLUDED.last_sync_time,
            updated_at = NOW()
    `, [
        user.stravaId,
        user.name,
        user.accessToken,
        user.refreshToken,
        user.expiresAt,
        user.profile,
        user.lastSyncTime ? new Date(user.lastSyncTime) : null
    ]);
};

/* ========================================================================== */
/*                          AI SUMMARIES OPERATIONS                           */
/* ========================================================================== */

/**
 * Get cached AI summary for an activity (with all versions)
 */
export const getSummary = async (activityId) => {
    const result = await pool.query(`
        SELECT * FROM ai_summaries 
        WHERE activity_id = $1 
        ORDER BY version_number ASC
    `, [activityId]);

    if (result.rows.length === 0) return null;

    // Convert to versioned format for compatibility
    const versions = result.rows.map(row => ({
        versionNumber: row.version_number,
        activityId: row.activity_id.toString(),
        text: row.raw_response,
        generatedAt: row.generated_at,
        model: row.model,
        status: row.status,
        cachedAt: row.cached_at
    }));

    const selectedRow = result.rows.find(r => r.is_selected);

    return {
        activityId: activityId.toString(),
        versions,
        selectedVersion: selectedRow?.version_number || null,
        regenerationCount: versions.length
    };
};

/**
 * Save AI summary for an activity (adds as new version)
 */
export const saveSummary = async (activityId, summaryData) => {
    // Get current max version
    const countResult = await pool.query(`
        SELECT COALESCE(MAX(version_number), 0) as max_version 
        FROM ai_summaries WHERE activity_id = $1
    `, [activityId]);

    const nextVersion = countResult.rows[0].max_version + 1;

    // Only allow up to 3 versions
    if (nextVersion > 3) {
        console.log('Max 3 versions reached for activity', activityId);
        return getSummary(activityId);
    }

    // Parse the AI response to extract structured fields
    let parsed = {};
    try {
        parsed = JSON.parse(summaryData.text);
    } catch (e) {
        // Text response, not JSON
    }

    await pool.query(`
        INSERT INTO ai_summaries (
            activity_id, version_number, run_type, relative_effort,
            summary_text, highlight, suggestion, raw_response,
            model, status, generated_at, cached_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
        activityId,
        nextVersion,
        parsed.runType || null,
        parsed.relativeEffort || null,
        parsed.summary || null,
        parsed.highlight || null,
        parsed.suggestion || null,
        summaryData.text,
        summaryData.model,
        summaryData.status || 'success',
        summaryData.generatedAt
    ]);

    return getSummary(activityId);
};

/**
 * Select a version and delete others
 */
export const selectSummaryVersion = async (activityId, versionNumber) => {
    await pool.query(`
        UPDATE ai_summaries SET is_selected = (version_number = $2)
        WHERE activity_id = $1
    `, [activityId, versionNumber]);

    // Delete non-selected versions
    await pool.query(`
        DELETE FROM ai_summaries 
        WHERE activity_id = $1 AND version_number != $2
    `, [activityId, versionNumber]);

    return getSummary(activityId);
};

/**
 * Delete AI summary for an activity
 */
export const deleteSummary = async (activityId) => {
    const result = await pool.query(`
        DELETE FROM ai_summaries WHERE activity_id = $1
    `, [activityId]);

    return result.rowCount > 0;
};

/* ========================================================================== */
/*                          EMBEDDING OPERATIONS                              */
/* ========================================================================== */

/**
 * Save embedding for an activity
 */
export const saveEmbedding = async (activityId, embedding, model) => {
    await pool.query(`
        INSERT INTO activity_embeddings (activity_id, embedding, embedding_model, generated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (activity_id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            generated_at = NOW()
    `, [activityId, JSON.stringify(embedding), model]);

    return { activityId, model };
};

/**
 * Search similar activities by embedding (cosine similarity)
 */
export const searchSimilarActivities = async (userId, embedding, limit = 10) => {
    const result = await pool.query(`
        SELECT a.*, 1 - (e.embedding <=> $1::vector) as similarity
        FROM activities a
        JOIN activity_embeddings e ON a.strava_activity_id = e.activity_id
        WHERE a.user_id = $2
        ORDER BY e.embedding <=> $1::vector
        LIMIT $3
    `, [JSON.stringify(embedding), userId, limit]);

    return result.rows.map(row => ({
        ...mapRowToActivity(row),
        similarity: row.similarity
    }));
};

/* ========================================================================== */
/*                              HELPER FUNCTIONS                              */
/* ========================================================================== */

/**
 * Map database row to Strava-compatible activity object
 */
function mapRowToActivity(row) {
    // Start with raw_summary if available for full Strava compatibility
    const base = row.raw_summary ?
        (typeof row.raw_summary === 'string' ? JSON.parse(row.raw_summary) : row.raw_summary)
        : {};

    return {
        ...base,
        id: row.strava_activity_id,
        name: row.name,
        type: row.sport_type,
        sport_type: row.sport_type,
        workout_type: row.workout_type,
        device_name: row.device_name,
        distance: row.distance,
        moving_time: row.moving_time,
        elapsed_time: row.elapsed_time,
        total_elevation_gain: row.total_elevation_gain,
        start_date: row.start_date,
        start_date_local: row.start_date_local,
        timezone: row.timezone,
        utc_offset: row.utc_offset,
        average_speed: row.average_speed,
        max_speed: row.max_speed,
        average_heartrate: row.average_heartrate,
        heartRate: row.average_heartrate, // Alias for frontend compatibility
        max_heartrate: row.max_heartrate,
        average_watts: row.average_watts,
        suffer_score: row.suffer_score,
        has_heartrate: row.has_heartrate,
        hasDetailedData: row.has_detailed_data,
        start_latlng: row.start_lat && row.start_lng ? [row.start_lat, row.start_lng] : [],
        end_latlng: row.end_lat && row.end_lng ? [row.end_lat, row.end_lng] : [],
        achievement_count: row.achievement_count,
        kudos_count: row.kudos_count,
        pr_count: row.pr_count,
        // Include details if joined
        ...(row.polyline !== undefined && {
            map: {
                polyline: row.polyline,
                summary_polyline: row.summary_polyline
            },
            elev_high: row.elev_high,
            elev_low: row.elev_low,
            zones: row.zones,
            laps: row.laps_json,
            description: row.detail_description
        })
    };
}

/**
 * Get activity streams
 */
export const getActivityStreams = async (activityId) => {
    const result = await pool.query(`
        SELECT stream_type, data FROM activity_streams WHERE activity_id = $1
    `, [activityId]);

    const streams = {};
    for (const row of result.rows) {
        streams[row.stream_type] = {
            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        };
    }
    return streams;
};

/* ========================================================================== */
/*                          COACH/GOALS OPERATIONS                            */
/* ========================================================================== */

/**
 * Get user's active goal
 */
export const getActiveGoal = async (userId) => {
    const result = await pool.query(`
        SELECT * FROM user_goals 
        WHERE user_id = $1 AND is_active = TRUE 
        LIMIT 1
    `, [userId]);
    return result.rows[0] || null;
};

/**
 * Get goal by ID
 */
export const getGoalById = async (goalId) => {
    const result = await pool.query(`SELECT * FROM user_goals WHERE id = $1`, [goalId]);
    return result.rows[0] || null;
};

/**
 * Create new goal
 */
/**
 * Create new goal
 */
export const createGoal = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Deactivate ALL existing goals for this user
        await client.query(`
            UPDATE user_goals 
            SET is_active = FALSE 
            WHERE user_id = $1
        `, [userId]);

        // 2. Create the new ACTIVE goal
        const result = await client.query(`
            INSERT INTO user_goals (user_id, goal_type, target_date, weekly_target_distance, preferred_workout_days, is_active)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING *
        `, [userId, data.goalType, data.targetDate, data.weeklyTarget, JSON.stringify(data.preferredDays)]);

        await client.query('COMMIT');

        // Trigger generic cleanup asynchronously (don't await)
        cleanupOldGoals(userId);

        return result.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Garbage collect inactive goals > 30 days old
 */
export const cleanupOldGoals = async (userId) => {
    try {
        const res = await pool.query(`
            DELETE FROM user_goals 
            WHERE user_id = $1 
            AND is_active = FALSE 
            AND created_at < NOW() - INTERVAL '30 days'
        `, [userId]);
        if (res.rowCount > 0) {
            console.log(`[GC] Deleted ${res.rowCount} old inactive goals for user ${userId}`);
        }
    } catch (err) {
        console.error('[GC] Error deleting old goals:', err);
    }
};

/**
 * Update goal
 */
export const updateGoal = async (goalId, data) => {
    await pool.query(`
        UPDATE user_goals SET
            goal_type = COALESCE($2, goal_type),
            target_date = COALESCE($3, target_date),
            weekly_target_distance = COALESCE($4, weekly_target_distance),
            preferred_workout_days = COALESCE($5, preferred_workout_days)
        WHERE id = $1
    `, [goalId, data.goalType, data.targetDate, data.weeklyTarget, data.preferredDays ? JSON.stringify(data.preferredDays) : null]);
};

/**
 * Deactivate all user goals
 */
export const deactivateUserGoals = async (userId) => {
    await pool.query('UPDATE user_goals SET is_active = FALSE WHERE user_id = $1', [userId]);
};

// ------------------------------------------------------------------
// PLAN CACHING & STREAKS
// ------------------------------------------------------------------


export const getDailyPlanCache = async (userId, date) => {
    const res = await pool.query(
        `SELECT * FROM daily_plan_cache WHERE user_id = $1 AND plan_date = $2`,
        [userId, date]
    );
    return res.rows[0];
};

export const saveDailyPlanCache = async (userId, date, planData, lastActivityId) => {
    await pool.query(`
        INSERT INTO daily_plan_cache (user_id, plan_date, plan_data, last_activity_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, plan_date) DO UPDATE SET 
            plan_data = EXCLUDED.plan_data,
            last_activity_id = EXCLUDED.last_activity_id
    `, [userId, date, planData, lastActivityId || null]);
};

export const getWeeklyPlanCache = async (userId, userWeekStart) => {
    const res = await pool.query(
        `SELECT week_start, monday, tuesday, wednesday, thursday, friday, saturday, sunday 
         FROM weekly_plan_cache 
         WHERE user_id = $1 AND week_start = $2`,
        [userId, userWeekStart]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const days = [
        row.monday, row.tuesday, row.wednesday, row.thursday, row.friday, row.saturday, row.sunday
    ];

    // Check if we have data (if all null, return null)
    if (days.every(d => d === null)) return null;

    // Fill in missing days as "Recovery/Rest"
    const weekStart = new Date(row.week_start);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const processedDays = days.map((dayData, index) => {
        // Calculate date for this day
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];

        if (dayData) {
            return {
                ...dayData,
                date: dateStr,
                dayName: dayNames[index]
            };
        } else {
            return {
                dayName: dayNames[index],
                date: dateStr,
                workout_type: 'Rest',
                title: 'Rest Day',
                target_time: '0 mins',
                target_pace: '-',
                intensity: 0
            };
        }
    });

    return {
        weekNumber: row.monday?.weekNumber || 1, // Fallback
        weekTheme: row.monday?.weekTheme || 'Training',
        weekFocus: row.monday?.weekFocus || 'General',
        days: processedDays
    };
};

export const saveWeeklyPlanCache = async (userId, userWeekStart, planData) => {
    // Map array of days to columns
    const dayMap = {};
    if (planData.days && Array.isArray(planData.days)) {
        planData.days.forEach(day => {
            const lowerName = day.dayName.toLowerCase();
            if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(lowerName)) {
                // Store metadata inside the day object for retrieval reconstruction if needed
                dayMap[lowerName] = {
                    ...day,
                    weekNumber: planData.weekNumber,
                    weekTheme: planData.weekTheme,
                    weekFocus: planData.weekFocus
                };
            }
        });
    }

    await pool.query(`
        INSERT INTO weekly_plan_cache (
            user_id, week_start, 
            monday, tuesday, wednesday, thursday, friday, saturday, sunday
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, week_start) DO UPDATE SET 
            monday = EXCLUDED.monday,
            tuesday = EXCLUDED.tuesday,
            wednesday = EXCLUDED.wednesday,
            thursday = EXCLUDED.thursday,
            friday = EXCLUDED.friday,
            saturday = EXCLUDED.saturday,
            sunday = EXCLUDED.sunday
    `, [
        userId, userWeekStart,
        dayMap.monday || null, dayMap.tuesday || null, dayMap.wednesday || null, dayMap.thursday || null,
        dayMap.friday || null, dayMap.saturday || null, dayMap.sunday || null
    ]);
};

export const calculateStreak = async (userId) => {
    const res = await pool.query(`
        WITH dates AS (
            SELECT DISTINCT date_trunc('day', start_date) as day
            FROM activities
            WHERE user_id = $1
        ),
        groups AS (
            SELECT day, ROW_NUMBER() OVER (ORDER BY day) as rn
            FROM dates
        )
        SELECT COUNT(*) as streak
        FROM groups
        GROUP BY day - rn * INTERVAL '1 day'
        ORDER BY streak DESC
        LIMIT 1
    `, [userId]);
    return parseInt(res.rows[0]?.streak || 0);
};

/**
 * Delete goal
 */
export const deleteGoal = async (goalId) => {
    await pool.query(`DELETE FROM user_goals WHERE id = $1`, [goalId]);
};

/**
 * Get master plan for a goal
 */
export const getMasterPlan = async (goalId) => {
    const result = await pool.query(`SELECT * FROM master_plans WHERE goal_id = $1`, [goalId]);
    return result.rows[0] || null;
};

/**
 * Save master plan
 */
export const saveMasterPlan = async (goalId, planData) => {
    console.log(`Saving master plan for goal ${goalId}. Weeks: ${planData.weeks?.length}`);
    try {
        await pool.query(`
            INSERT INTO master_plans (goal_id, weeks, total_weeks, peak_week, taper_start_week, model)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (goal_id) DO UPDATE SET
                weeks = EXCLUDED.weeks,
                total_weeks = EXCLUDED.total_weeks,
                peak_week = EXCLUDED.peak_week,
                taper_start_week = EXCLUDED.taper_start_week,
                generated_at = NOW()
        `, [
            goalId,
            JSON.stringify(planData.weeks),
            planData.totalWeeks || planData.total_weeks,
            planData.peakWeek || planData.peak_week,
            planData.taperStart || planData.taperStartWeek || planData.taper_start_week,
            planData.model || 'local'
        ]);
        console.log('Master plan saved to DB successfully');
    } catch (err) {
        console.error('DB Error saving master plan:', err);
        throw err;
    }
};

/**
 * Clear all caches for a user (when goal changes)
 */
export const clearUserCaches = async (userId) => {
    console.log(`Clearing caches for user ${userId}`);
    try {
        // Clear daily plan caches
        await pool.query(`
            DELETE FROM daily_plan_cache WHERE user_id = $1
        `, [userId]);

        // Clear weekly plan caches
        await pool.query(`
            DELETE FROM weekly_plan_cache WHERE user_id = $1
        `, [userId]);

        // Clear master plans (linked to invalid/old goals)
        // Since goal might have been updated, we delete master plans for this user's goals
        // Or simpler: delete all master plans for user's goals
        // But master_plans stores goal_id, not user_id. We need to join or assume goals.js handles goal deletion

        // Wait, getting user's active goal to clear its master plan
        const result = await pool.query(`SELECT id FROM user_goals WHERE user_id = $1`, [userId]);
        const goalIds = result.rows.map(r => r.id);

        if (goalIds.length > 0) {
            await pool.query(`
                DELETE FROM master_plans WHERE goal_id = ANY($1)
            `, [goalIds]);
        }

        console.log('User caches and master plans cleared');
    } catch (err) {
        console.error('Error clearing caches:', err.message);
        // Don't throw - cache clearing is not critical
    }
};

/**
 * Get activity summary for AI context
 * Returns aggregated stats for recent activities
 */
export const getActivitySummary = async (userId) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_activities,
                COALESCE(SUM(distance), 0) as total_distance,
                COALESCE(AVG(distance), 0) as avg_distance,
                COALESCE(AVG(average_heartrate), 0) as avg_hr,
                MAX(start_date) as last_activity
            FROM activities 
            WHERE user_id = $1 AND start_date > NOW() - INTERVAL '30 days'
        `, [userId]);

        return result.rows[0] || { total_activities: 0, total_distance: 0 };
    } catch (err) {
        console.error('Error getting activity summary:', err.message);
        return { total_activities: 0, total_distance: 0 };
    }
};

/**
 * Get coach chat history for a user
 */
export const getCoachHistory = async (userId, limit = 10) => {
    try {
        const result = await pool.query(`
            SELECT role, message, created_at
            FROM coach_messages 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        `, [userId, limit]);

        return result.rows.reverse(); // Return in chronological order
    } catch (err) {
        // Table might not exist - return empty array
        console.error('Error getting coach history:', err.message);
        return [];
    }
};

/**
 * Save a coach chat message
 */
export const saveCoachMessage = async (userId, role, message, context = null) => {
    try {
        await pool.query(`
            INSERT INTO coach_messages (user_id, role, message, context)
            VALUES ($1, $2, $3, $4)
        `, [userId, role, message, context ? JSON.stringify(context) : null]);
    } catch (err) {
        // Table might not exist - silently fail
        console.error('Error saving coach message:', err.message);
    }
};

/**
 * Get weekly training points from completed activities
 * Compares actual distance to weekly target
 */
export const getWeeklyPoints = async (userId) => {
    try {
        // Get Monday of current week
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);

        // Get activities from this week
        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(distance), 0) as total_distance,
                COUNT(*) as activity_count
            FROM activities 
            WHERE user_id = $1 
            AND start_date >= $2
            AND sport_type = 'Run'
        `, [userId, weekStart.toISOString()]);

        const row = result.rows[0];
        const totalKm = parseFloat(row.total_distance) / 1000 || 0;

        // Get weekly target from active goal
        const goalResult = await pool.query(`
            SELECT weekly_target_distance FROM user_goals 
            WHERE user_id = $1 AND is_active = true 
            LIMIT 1
        `, [userId]);

        const weeklyTarget = goalResult.rows[0]?.weekly_target_distance || 30;
        const progressPercent = Math.min(100, Math.round((totalKm / weeklyTarget) * 100));

        return {
            completedKm: Math.round(totalKm * 10) / 10,
            targetKm: weeklyTarget,
            progressPercent,
            activityCount: parseInt(row.activity_count) || 0
        };
    } catch (err) {
        console.error('Error getting weekly points:', err.message);
        return { completedKm: 0, targetKm: 30, progressPercent: 0, activityCount: 0 };
    }
};

/**
 * Get recent activities for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of activities to return (default 7)
 */
export const getRecentActivities = async (userId, limit = 7) => {
    try {
        const result = await pool.query(`
            SELECT 
                strava_activity_id as id,
                name,
                sport_type,
                distance,
                moving_time,
                total_elevation_gain,
                start_date,
                average_heartrate
            FROM activities 
            WHERE user_id = $1 
            ORDER BY start_date DESC 
            LIMIT $2
        `, [userId, limit]);

        return result.rows;
    } catch (err) {
        console.error('Error getting recent activities:', err.message);
        return [];
    }
};

// End of file
