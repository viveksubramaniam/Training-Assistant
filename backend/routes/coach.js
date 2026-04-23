/**
 * Coach Routes (Simplified for LangGraph)
 * 
 * All plan generation goes through /orchestrate endpoint
 * Chat goes through /chat endpoint
 */

import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as db from '../db/index.js';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// Helper: Get Monday of current week as YYYY-MM-DD
const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
};

// Helper: Match a day string (date, abbreviated name, or full name) against a plan day
const DAY_NAME_MAP = {
    'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed', 'thursday': 'Thu',
    'friday': 'Fri', 'saturday': 'Sat', 'sunday': 'Sun',
    'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
    'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
};
const matchDay = (planDay, searchStr) => {
    if (!searchStr) return false;
    const s = searchStr.toLowerCase().trim();
    // Match by exact date
    if (planDay.date === searchStr) return true;
    // Match by day name (abbreviated or full)
    const normalized = DAY_NAME_MAP[s];
    if (normalized && planDay.dayName === normalized) return true;
    // Match by direct dayName comparison (case-insensitive)
    if (planDay.dayName?.toLowerCase() === s) return true;
    return false;
};

// Auth middleware
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'secret_key');
        req.userId = decoded.stravaId; // Attach to request
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};


// ═══════════════════════════════════════════════════════════════════════════
// Programmatic Fallback Plan Generators
// Used when the AI/LLM service is unavailable or returns invalid data
// ═══════════════════════════════════════════════════════════════════════════

const GOAL_TEMPLATES = {
    '5K': { weeklyKm: 20, longRunKm: 8, easyRunKm: 4, tempoKm: 5, intervalDesc: '6x400m', totalWeeks: 8 },
    '10K': { weeklyKm: 30, longRunKm: 12, easyRunKm: 5, tempoKm: 7, intervalDesc: '6x800m', totalWeeks: 10 },
    'half_marathon': { weeklyKm: 40, longRunKm: 16, easyRunKm: 6, tempoKm: 8, intervalDesc: '4x1600m', totalWeeks: 14 },
    'marathon': { weeklyKm: 55, longRunKm: 25, easyRunKm: 8, tempoKm: 10, intervalDesc: '5x1600m', totalWeeks: 18 },
    'general': { weeklyKm: 25, longRunKm: 10, easyRunKm: 5, tempoKm: 6, intervalDesc: '6x400m', totalWeeks: 12 }
};

const generateFallbackWeeklyPlan = (goalType, weekStart) => {
    const template = GOAL_TEMPLATES[goalType] || GOAL_TEMPLATES['general'];
    const startDate = new Date(weekStart);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const days = [
        { title: 'Easy Run', workout_type: 'easy', distance: template.easyRunKm, intensity: 'low', description: `Comfortable ${template.easyRunKm}km at conversational pace. Keep heart rate in Zone 2.` },
        { title: 'Rest Day', workout_type: 'rest', distance: 0, intensity: 'rest', description: 'Active recovery — stretching, foam rolling, or a gentle walk.' },
        { title: 'Tempo Run', workout_type: 'tempo', distance: template.tempoKm, intensity: 'moderate', description: `${template.tempoKm}km at comfortably hard pace. You should be able to speak in short phrases.` },
        { title: 'Easy Run', workout_type: 'easy', distance: template.easyRunKm, intensity: 'low', description: `Recovery ${template.easyRunKm}km at easy effort. Focus on good form.` },
        { title: 'Intervals', workout_type: 'intervals', distance: template.tempoKm, intensity: 'high', description: `${template.intervalDesc} with equal rest. Total volume ~${template.tempoKm}km including warm-up/cool-down.` },
        { title: 'Long Run', workout_type: 'long_run', distance: template.longRunKm, intensity: 'moderate', description: `${template.longRunKm}km at easy-to-moderate pace. Build endurance — the cornerstone of distance running.` },
        { title: 'Rest Day', workout_type: 'rest', distance: 0, intensity: 'rest', description: 'Full rest day. Let your body adapt and recover from the week.' }
    ].map((day, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return {
            ...day,
            dayName: dayNames[i],
            date: d.toISOString().split('T')[0],
            target_pace: day.intensity === 'high' ? 'Hard' : day.intensity === 'moderate' ? 'Moderate' : 'Easy',
            target_time: day.distance > 0 ? `${Math.round(day.distance * 6)}min` : '0'
        };
    });

    return { days, weekStart, goalType, generatedBy: 'fallback' };
};

const generateFallbackDailyPlan = (goalType, dayOfWeek) => {
    const template = GOAL_TEMPLATES[goalType] || GOAL_TEMPLATES['general'];
    // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
    const isRestDay = dayOfWeek === 0 || dayOfWeek === 2; // Sun, Tue
    const isLongRunDay = dayOfWeek === 6; // Sat
    const isHardDay = dayOfWeek === 5; // Fri

    if (isRestDay) {
        return {
            recommended: { title: 'Rest Day', type: 'rest', description: 'Take a well-deserved rest day. Your body grows stronger during recovery.', distance: '0', targetPace: 'N/A', duration: '0', coachTip: 'Rest is when your body adapts. Hydrate, stretch, and sleep well!' },
            option_2: { title: 'Light Walk', type: 'recovery', description: 'A gentle 20-minute walk to keep blood flowing without stress.', distance: '1-2km', targetPace: 'Easy', duration: '20min' },
            option_3: { title: 'Yoga & Mobility', type: 'recovery', description: '15-minute stretching and mobility routine for recovery.', distance: '0', targetPace: 'N/A', duration: '15min' }
        };
    }

    const mainDistance = isLongRunDay ? template.longRunKm : isHardDay ? template.tempoKm : template.easyRunKm;
    const mainType = isLongRunDay ? 'Long Run' : isHardDay ? 'Intervals' : 'Easy Run';
    const mainDesc = isLongRunDay
        ? `Build endurance with a ${mainDistance}km run at easy-to-moderate pace.`
        : isHardDay
            ? `${template.intervalDesc} with rest intervals. Total ~${mainDistance}km.`
            : `Comfortable ${mainDistance}km at conversational pace.`;

    return {
        recommended: {
            title: mainType, type: mainType.toLowerCase().replace(' ', '_'),
            description: mainDesc, distance: `${mainDistance}km`,
            targetPace: isHardDay ? 'Hard' : isLongRunDay ? 'Moderate' : 'Easy',
            duration: `${Math.round(mainDistance * 6)}min`,
            coachTip: isHardDay ? 'Push yourself but listen to your body. Quality over quantity!' : 'Keep it comfortable — you should be able to hold a conversation.'
        },
        option_2: {
            title: 'Lighter Version', type: 'easy',
            description: `Scaled-down ${Math.round(mainDistance * 0.7)}km at easy pace. Good option if you\'re feeling tired.`,
            distance: `${Math.round(mainDistance * 0.7)}km`, targetPace: 'Easy',
            duration: `${Math.round(mainDistance * 0.7 * 6)}min`
        },
        option_3: {
            title: 'Challenge Version', type: 'tempo',
            description: `Extended ${Math.round(mainDistance * 1.25)}km with tempo segments. For when you\'re feeling strong!`,
            distance: `${Math.round(mainDistance * 1.25)}km`, targetPace: 'Moderate-Hard',
            duration: `${Math.round(mainDistance * 1.25 * 6)}min`
        }
    };
};

const generateFallbackMasterPlan = (goalType, targetDate) => {
    const template = GOAL_TEMPLATES[goalType] || GOAL_TEMPLATES['general'];
    const weeks = [];
    const now = new Date();
    const end = targetDate ? new Date(targetDate) : new Date(now.getTime() + template.totalWeeks * 7 * 24 * 60 * 60 * 1000);
    const totalWeeks = Math.max(4, Math.ceil((end - now) / (7 * 24 * 60 * 60 * 1000)));

    const phases = [
        { name: 'Base Building', pct: 0.35, focus: 'Build aerobic base and running habit' },
        { name: 'Build Phase', pct: 0.30, focus: 'Increase volume and introduce speed work' },
        { name: 'Peak Phase', pct: 0.20, focus: 'Race-specific workouts at goal pace' },
        { name: 'Taper', pct: 0.15, focus: 'Reduce volume, maintain intensity, stay fresh' }
    ];

    let weekNum = 1;
    for (const phase of phases) {
        const phaseWeeks = Math.max(1, Math.round(totalWeeks * phase.pct));
        for (let w = 0; w < phaseWeeks && weekNum <= totalWeeks; w++) {
            const volumeMultiplier = phase.name === 'Taper' ? 0.6 + (0.4 * (1 - w / phaseWeeks)) : 0.7 + (0.3 * w / phaseWeeks);
            weeks.push({
                week: weekNum,
                phase: phase.name,
                focus: phase.focus,
                totalDistance: Math.round(template.weeklyKm * volumeMultiplier),
                longRun: Math.round(template.longRunKm * volumeMultiplier)
            });
            weekNum++;
        }
    }

    return { weeks, goalType, totalWeeks, generatedBy: 'fallback' };
};

// Helper: Background orchestration (Async)
const triggerOrchestration = async (userId) => {
    console.log(`[Async] Triggering orchestration for user ${userId}`);
    try {
        const goal = await db.getActiveGoal(userId);
        if (!goal) return { error: "No goal" };

        const masterPlan = await db.getMasterPlan(goal.id);
        const weekStart = getWeekStart();
        const cachedWeekly = await db.getWeeklyPlanCache(userId, weekStart);

        // Get recent activities for context
        const recentActivities = await db.getRecentActivities(userId, 7);
        const activitiesSummary = recentActivities.map(a => ({
            date: a.start_date,
            distance: a.distance,
            duration: a.moving_time,
            type: a.sport_type
        }));

        // Get fitness profile for personalization
        const fitnessProfile = await db.getFitnessProfile(userId);
        console.log(`[Async] Fitness profile: avgPace=${fitnessProfile.avgPaceMinKm}, weeklyKm=${fitnessProfile.avgWeeklyDistanceKm}, PBs=${fitnessProfile.personalBests.length}`);

        console.log(`[Async] Calling AI service at: ${AI_SERVICE_URL}/orchestrate`);
        console.log(`[Async] Payload userId: ${userId}, Goal: ${goal.goal_type}`);

        const response = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
            userId: String(userId),
            goal: {
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance
            },
            masterPlan: masterPlan,
            weeklyPlan: cachedWeekly,
            recentActivities: activitiesSummary,
            fitnessProfile,
            forceRegenerate: false
        }, { timeout: 120000 });

        // Check if result is wrapped in 'result' key (from prepare_result node)
        // or available at root (snake_case from state)
        const state = response.data;
        const result = state.result || {};

        console.log('[Async] AI Response State Keys:', Object.keys(state));
        if (state.result) console.log('[Async] AI Response Result Keys:', Object.keys(state.result));

        // ── LLM Output Log ──
        console.log(`[LLM-OUTPUT] [orchestrate] userId=${userId} | resultKeys=${Object.keys(result).join(',')} | stateKeys=${Object.keys(state).join(',')} | timestamp=${new Date().toISOString()}`);

        const weeklyPlan = result.weeklyPlan || state.weekly_plan || state.weeklyPlan;
        console.log('[Async] Extracted Weekly Plan:', weeklyPlan ? 'Yes (Object)' : 'No/Null/Undefined');

        const dailyPlan = result.dailyPlan || state.daily_plan || state.dailyPlan;
        const todayWorkout = result.todayWorkout || state.todayWorkout;
        const flags = result.flags || state.flags || {};

        // Extract and Save Master Plan if newly generated (or returned)
        const newMasterPlan = result.masterPlan || result.master_plan || state.masterPlan || state.master_plan;
        if (newMasterPlan && newMasterPlan.weeks) {
            console.log(`[Async] Saving/Updating master plan`);
            await db.saveMasterPlan(goal.id, newMasterPlan);
        }

        // Cache weekly plan if newly generated
        if (weeklyPlan && !cachedWeekly) {
            console.log(`[Async] Caching new weekly plan`);
            await db.cacheWeeklyPlan(userId, weekStart, weeklyPlan);
        }

        if (dailyPlan) {
            console.log(`[Async] Caching new daily plan. dailyPlan keys:`, Object.keys(dailyPlan));
            const today = new Date().toISOString().split('T')[0];
            const latestActivity = await db.getRecentActivities(userId, 1);
            const latestActivityId = latestActivity[0]?.id || null;

            // Re-construct full daily plan object
            const weeklyPoints = await db.getWeeklyPoints(userId);
            const finalDailyPlan = {
                ...dailyPlan,
                weeklyPoints,
                todayFromWeekly: todayWorkout,
                flags
            };

            console.log(`[Async] Final daily plan structure (truncated):`, JSON.stringify(finalDailyPlan).substring(0, 500));
            try {
                await db.cacheDailyPlan(userId, today, finalDailyPlan, latestActivityId);
                console.log(`[Async] Daily plan saved successfully for ${today}`);
            } catch (saveError) {
                console.error(`[Async] FAILED to save daily plan:`, saveError.message);
            }
        } else {
            console.log(`[Async] No dailyPlan returned from AI service. Result keys:`, Object.keys(result), `State keys:`, Object.keys(state));
        }

        console.log(`[Async] Orchestration complete for user ${userId}`);

    } catch (error) {
        console.error('[Async] Orchestration failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('[Async] AI service is not reachable at', AI_SERVICE_URL);
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            console.error('[Async] Request timed out - AI service may be overloaded');
        }

        // ═══ FALLBACK PLAN GENERATION ═══
        console.log(`[Async-Fallback] Generating programmatic fallback plans for user ${userId}`);
        try {
            const goal = await db.getActiveGoal(userId);
            if (!goal) return;

            const goalType = goal.goal_type || 'general';
            const weekStart = getWeekStart();
            const today = new Date().toISOString().split('T')[0];
            const dayOfWeek = new Date().getDay();

            // Generate fallback master plan if none exists
            const existingMaster = await db.getMasterPlan(goal.id);
            if (!existingMaster) {
                const fallbackMaster = generateFallbackMasterPlan(goalType, goal.target_date);
                await db.saveMasterPlan(goal.id, fallbackMaster);
                console.log(`[Async-Fallback] Saved fallback master plan (${fallbackMaster.weeks.length} weeks)`);
            }

            // Generate fallback weekly plan if none exists
            const existingWeekly = await db.getWeeklyPlanCache(userId, weekStart);
            if (!existingWeekly) {
                const fallbackWeekly = generateFallbackWeeklyPlan(goalType, weekStart);
                await db.cacheWeeklyPlan(userId, weekStart, fallbackWeekly);
                console.log(`[Async-Fallback] Saved fallback weekly plan`);
            }

            // Generate fallback daily plan if none exists
            const existingDaily = await db.getDailyPlanCache(userId, today);
            if (!existingDaily || existingDaily.stale) {
                const fallbackDaily = generateFallbackDailyPlan(goalType, dayOfWeek);
                await db.cacheDailyPlan(userId, today, fallbackDaily);
                console.log(`[Async-Fallback] Saved fallback daily plan`);
            }

            console.log(`[Async-Fallback] Fallback plans saved successfully for user ${userId}`);
        } catch (fallbackErr) {
            console.error('[Async-Fallback] Fallback generation also failed:', fallbackErr.message);
        }
    }
};

/**
 * POST /api/coach/sync
 * Triggers background plan generation if needed
 */
router.post('/sync', requireAuth, async (req, res) => {
    console.log(`[Sync] Received sync request for User ${req.userId}`); // verification log
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();

    const goal = await db.getActiveGoal(userId);
    if (!goal) {
        return res.json({
            status: 'no_goal',
            message: 'No active goal found'
        });
    }

    // Check if we have valid plans
    const masterPlan = await db.getMasterPlan(goal.id);
    const hasDaily = await db.getDailyPlanCache(userId, today);
    const hasWeekly = await db.getWeeklyPlanCache(userId, weekStart);

    // Check for valid structure in daily plan
    const isDailyValid = hasDaily && !hasDaily.stale &&
        (hasDaily.plan_data.dailyPlan || hasDaily.plan_data.recommended);

    // Trigger if any plan is missing: Master, Weekly, or Daily
    if (!masterPlan || !hasWeekly || !isDailyValid) {
        // Trigger background generation (fire and forget)
        triggerOrchestration(userId).catch(err => console.error('Background sync crashed', err));

        return res.json({
            status: 'syncing',
            message: 'Generating training plans...'
        });
    }

    res.json({ status: 'ready' });
});

/**
 * POST /api/coach/regenerate
 * Force regenerate all plans after goal change
 */
router.post('/regenerate', requireAuth, async (req, res) => {
    const userId = req.userId;
    console.log(`[Regenerate] Force regenerating plans for user ${userId}`);

    try {
        const goal = await db.getActiveGoal(userId);
        if (!goal) {
            return res.status(400).json({ error: 'No active goal found' });
        }

        // Get recent activities for context
        const recentActivities = await db.getRecentActivities(userId, 7);
        const activitiesSummary = recentActivities.map(a => ({
            date: a.start_date,
            distance: a.distance,
            duration: a.moving_time,
            type: a.sport_type
        }));

        // Get fitness profile for personalization
        const fitnessProfile = await db.getFitnessProfile(userId);
        console.log(`[Regenerate] Fitness profile: avgPace=${fitnessProfile.avgPaceMinKm}, weeklyKm=${fitnessProfile.avgWeeklyDistanceKm}, PBs=${fitnessProfile.personalBests.length}`);

        console.log(`[Regenerate] Calling AI service with forceRegenerate=true...`);
        const response = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
            userId: String(userId),
            goal: {
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance,
                preferredDays: goal.preferred_workout_days
            },
            masterPlan: null, // Force regeneration
            weeklyPlan: null, // Force regeneration
            recentActivities: activitiesSummary,
            fitnessProfile,
            forceRegenerate: true
        }, { timeout: 120000 });

        const responseData = response.data;
        // The API might return { result: ... } or just the result object directly
        const result = responseData.result || responseData;

        console.log('[Regenerate] Response Keys:', Object.keys(responseData));
        if (result !== responseData) console.log('[Regenerate] Result Keys:', Object.keys(result));

        // Python returns camelCase "masterPlan" in prepare_result, but let's be safe
        const newMasterPlan = result.masterPlan || result.master_plan || responseData.masterPlan || responseData.master_plan;

        if (newMasterPlan) {
            console.log('[Regenerate] newMasterPlan object found. Weeks:', newMasterPlan.weeks?.length);
        } else {
            console.log('[Regenerate] newMasterPlan is null/undefined');
        }

        const weeklyPlan = result.weeklyPlan || result.weekly_plan || responseData.weeklyPlan || responseData.weekly_plan;
        const dailyPlan = result.dailyPlan || result.daily_plan || responseData.dailyPlan || responseData.daily_plan;

        // Cache the new plans
        const weekStart = getWeekStart();
        if (weeklyPlan) {
            console.log(`[Regenerate] Caching new weekly plan`);
            await db.cacheWeeklyPlan(userId, weekStart, weeklyPlan);
        }

        if (dailyPlan) {
            console.log(`[Regenerate] Caching new daily plan`);
            const today = new Date().toISOString().split('T')[0];
            await db.cacheDailyPlan(userId, today, dailyPlan);
        }

        // Save master plan if returned
        if (newMasterPlan && newMasterPlan.weeks) {
            console.log(`[Regenerate] Saving new master plan`);
            await db.saveMasterPlan(goal.id, newMasterPlan);
        }

        console.log(`[Regenerate] Plan regeneration complete for user ${userId}`);

        res.json({
            success: true,
            message: 'Plans regenerated successfully',
            hasMasterPlan: !!newMasterPlan,
            hasWeeklyPlan: !!weeklyPlan,
            hasDailyPlan: !!dailyPlan
        });

    } catch (error) {
        console.error('[Regenerate] Failed:', error.message);
        res.status(500).json({
            error: 'Failed to regenerate plans',
            details: error.message
        });
    }
});

/**
 * GET /api/coach/daily-plan
 * Returns daily workout (Non-blocking)
 */
router.get('/daily-plan', requireAuth, async (req, res) => {
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Check cache first
        const cached = await db.getDailyPlanCache(userId, today);

        if (cached && !cached.stale) {
            const plan = cached.plan_data;
            // Validate plan structure (must have recommended option or be a legacy flat structure)
            if (plan.dailyPlan || plan.recommended) {
                console.log(`Returning cached daily plan for ${today}`);
                return res.json(plan);
            }
            console.log('Cached plan is incomplete/invalid, treating as missing');
        }

        // If not compatible/ready, return generating status
        // Frontend handles this by showing loader and polling
        res.json({ status: 'generating' });

    } catch (error) {
        console.error('Daily plan fetch failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch daily plan' });
    }
});

/**
 * GET /api/coach/weekly-plan
 * Returns weekly plan (Non-blocking)
 */
router.get('/weekly-plan', requireAuth, async (req, res) => {
    const userId = req.userId;
    const weekStart = getWeekStart();

    try {
        // Check cache first
        const cached = await db.getWeeklyPlanCache(userId, weekStart);

        if (cached) {
            console.log(`Returning cached weekly plan for week of ${weekStart}`);
            return res.json(cached);
        }

        // If not found, return generating status
        res.json({ status: 'generating' });

    } catch (error) {
        console.error('Weekly plan fetch failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch weekly plan' });
    }
});

/**
 * GET /api/coach/master-plan
 * Returns full master plan for visualization
 */
router.get('/master-plan', requireAuth, async (req, res) => {
    const userId = req.userId;
    console.log(`[MasterPlan] Fetching for user ${userId}`);

    try {
        const goal = await db.getActiveGoal(userId);
        console.log(`[MasterPlan] Active goal:`, goal);

        if (!goal) {
            return res.json({ error: "No active goal" });
        }

        console.log(`[MasterPlan] Fetching plan for goal ID: ${goal.id}`);
        const masterPlan = await db.getMasterPlan(goal.id);
        console.log(`[MasterPlan] Plan found:`, masterPlan ? 'Yes' : 'No');

        // Calculate current week
        const goalStart = new Date(goal.created_at);
        const currentWeek = Math.floor((new Date() - goalStart) / (7 * 24 * 60 * 60 * 1000)) + 1;

        res.json({ ...masterPlan, currentWeek, startDate: goal.created_at });
    } catch (error) {
        console.error('Fetch master plan failed:', error);
        res.status(500).json({ error: 'Failed to fetch master plan' });
    }
});

/**
 * GET /api/coach/streak
 */
router.get('/streak', requireAuth, async (req, res) => {
    const userId = req.userId;

    try {
        const streak = await db.calculateStreak(userId);
        res.json({ streakDays: streak });
    } catch (error) {
        console.error('Streak calculation failed:', error.message);
        res.json({ streakDays: 0 });
    }
});

/**
 * GET /api/coach/fitness-profile
 * Returns aggregated fitness metrics for the authenticated user
 */
router.get('/fitness-profile', requireAuth, async (req, res) => {
    const userId = req.userId;
    try {
        const profile = await db.getFitnessProfile(userId);
        console.log(`[FitnessProfile] Returned for user ${userId}: avgPace=${profile.avgPaceMinKm}, weeklyKm=${profile.avgWeeklyDistanceKm}, PBs=${profile.personalBests.length}`);
        res.json(profile);
    } catch (error) {
        console.error('Fitness profile failed:', error.message);
        res.status(500).json({ error: 'Failed to get fitness profile' });
    }
});

/**
 * GET /api/coach/chat/history
 * Returns chat conversation history for the authenticated user
 */
router.get('/chat/history', requireAuth, async (req, res) => {
    const userId = req.userId;
    try {
        const history = await db.getCoachHistory(userId, 50);
        // Map DB rows to frontend message format
        const messages = history.map(row => {
            const msg = {
                role: row.role,
                content: row.message,
                timestamp: row.created_at
            };
            if (row.context) {
                const ctx = typeof row.context === 'string' ? JSON.parse(row.context) : row.context;
                if (ctx.action) msg.action = ctx.action;
                if (ctx.planUpdate) msg.planUpdate = ctx.planUpdate;
                if (ctx.goalChanged) msg.goalChanged = ctx.goalChanged;
            }
            return msg;
        });
        res.json({ messages });
    } catch (error) {
        console.error('Chat history fetch failed:', error.message);
        res.json({ messages: [] });
    }
});

/**
 * POST /api/coach/swap-workout
 * Swap the current day's workout with an alternate option
 */
router.post('/swap-workout', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { alternateTitle } = req.body;

    try {
        const weekStart = getWeekStart();
        const today = new Date().toISOString().split('T')[0];

        // Get current weekly plan
        const weeklyPlan = await db.getWeeklyPlanCache(userId, weekStart);
        if (!weeklyPlan || !weeklyPlan.days) {
            return res.status(400).json({ error: 'No weekly plan found' });
        }

        // Find today's workout and the matching alternate
        const todayIndex = weeklyPlan.days.findIndex(d => matchDay(d, today));
        if (todayIndex === -1) {
            return res.status(400).json({ error: 'Could not find today in the weekly plan' });
        }

        const currentWorkout = weeklyPlan.days[todayIndex];

        // Log the swap action
        console.log(`[SwapWorkout] User ${userId} swapping "${currentWorkout.title}" with "${alternateTitle}"`);

        // Create a note of the swap in the daily plan cache
        const today_iso = new Date().toISOString().split('T')[0];
        const dailyCache = await db.getDailyPlanCache(userId, today_iso);

        if (dailyCache && dailyCache.plan_data) {
            const dailyPlan = dailyCache.plan_data;

            // Create a swapped version - replace the recommended with the alternate if available
            const swappedRecommended = {
                title: alternateTitle,
                type: 'swapped',
                description: `Swapped from: ${currentWorkout.title}. You chose to replace your scheduled workout with this alternative.`,
                distance: dailyPlan.option_2?.distance || dailyPlan.option_3?.distance || currentWorkout.distance,
                targetPace: dailyPlan.option_2?.targetPace || dailyPlan.option_3?.target_pace || currentWorkout.target_pace,
                duration: dailyPlan.option_2?.duration || dailyPlan.option_3?.duration || currentWorkout.target_time,
                coachTip: 'You\'ve made your choice. Go get it!'
            };

            // Update the daily plan cache
            const updatedDailyPlan = {
                ...dailyPlan,
                recommended: swappedRecommended,
                swapped: true,
                swappedFrom: currentWorkout.title,
                swappedTo: alternateTitle
            };

            await db.cacheDailyPlan(userId, today_iso, updatedDailyPlan);
        }

        // Update the weekly plan if needed
        const updatedDays = weeklyPlan.days.map((d, i) => {
            if (i === todayIndex) {
                return {
                    ...d,
                    title: alternateTitle,
                    swapped: true,
                    originalTitle: d.title
                };
            }
            return d;
        });

        const updatedWeeklyPlan = { ...weeklyPlan, days: updatedDays };
        await db.cacheWeeklyPlan(userId, weekStart, updatedWeeklyPlan);

        // Save the action to coach history
        await db.saveCoachMessage(userId, 'system', `Swapped workout: ${currentWorkout.title} → ${alternateTitle}`, {
            action: 'swap_workouts',
            from: currentWorkout.title,
            to: alternateTitle,
            date: today_iso
        });

        console.log(`[SwapWorkout] Successfully swapped workout for user ${userId}`);
        res.json({
            success: true,
            message: `Swapped to ${alternateTitle}`,
            swappedFrom: currentWorkout.title,
            swappedTo: alternateTitle,
            date: today_iso
        });

    } catch (error) {
        console.error('[SwapWorkout] Failed:', error.message);
        res.status(500).json({
            error: 'Failed to swap workout',
            details: error.message
        });
    }
});

/**
 * POST /api/coach/chat
 * Enhanced chat with AI coach - handles goal CRUD, workout modifications, and plan changes
 */
router.post('/chat', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    try {
        // Gather rich context for the AI
        const goal = await db.getActiveGoal(userId);
        const masterPlan = goal ? await db.getMasterPlan(goal.id) : null;
        const weekStart = getWeekStart();
        const weeklyPlan = await db.getWeeklyPlanCache(userId, weekStart);
        const today = new Date().toISOString().split('T')[0];
        const dailyPlanCache = await db.getDailyPlanCache(userId, today);
        const dailyPlan = dailyPlanCache?.plan_data || null;
        const recentActivities = await db.getRecentActivities(userId, 5);
        const activitiesSummary = recentActivities.map(a => ({
            date: a.start_date,
            distance: a.distance,
            duration: a.moving_time,
            type: a.sport_type
        }));

        // Call Python AI service with full context
        const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
            userId: String(userId),
            message,
            goal: goal ? {
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance
            } : null,
            masterPlan,
            currentPlan: weeklyPlan,
            dailyPlan,
            recentActivities: activitiesSummary,
            preferredDays: goal?.preferred_workout_days || null
        }, { timeout: 60000 });

        const { message: aiMessage, action, params, planUpdate, updatedPlan } = response.data;

        // ── LLM Output Log ──
        console.log(`[LLM-OUTPUT] [chat] userId=${userId} | action=${action || 'chat'} | params=${JSON.stringify(params || {})} | planUpdate=${!!planUpdate} | hasUpdatedPlan=${!!updatedPlan} | messagePreview="${(aiMessage || '').substring(0, 100)}" | timestamp=${new Date().toISOString()}`);
        console.log('[Chat] AI Response:', { action, params, planUpdate, hasUpdatedPlan: !!updatedPlan });

        // Save user message to DB
        await db.saveCoachMessage(userId, 'user', message);

        let actionResult = null;
        let goalChanged = false;

        // Process action
        switch (action) {
            case 'create_goal': {
                const goalType = params.goal_type || 'general';
                const targetDate = params.target_date || null;
                const weeklyTarget = params.weekly_target || null;
                const preferredDays = params.preferred_days || null;

                const newGoal = await db.createGoal(userId, {
                    goalType,
                    targetDate,
                    weeklyTarget,
                    preferredDays
                });

                // Clear caches so plans regenerate
                try { await db.clearUserCaches(userId); } catch (e) { console.log('Cache clear skipped:', e.message); }

                // Trigger plan generation in background
                triggerOrchestration(userId).catch(err => console.error('Background orchestration failed:', err.message));

                actionResult = { goalId: newGoal.id, goalType, targetDate, weeklyTarget };
                goalChanged = true;
                console.log(`[Chat] Created goal: ${goalType} for user ${userId}`);
                break;
            }

            case 'update_goal': {
                if (!goal) {
                    return res.json({
                        message: "You don't have an active goal to update. Would you like to create one?",
                        action: 'chat',
                        planUpdate: false,
                        goalChanged: false
                    });
                }

                const updates = {};
                if (params.goal_type) updates.goalType = params.goal_type;
                if (params.target_date) updates.targetDate = params.target_date;
                if (params.weekly_target) updates.weeklyTarget = params.weekly_target;
                if (params.preferred_days) updates.preferredDays = params.preferred_days;

                await db.updateGoal(goal.id, updates);

                // Clear caches so plans regenerate
                try { await db.clearUserCaches(userId); } catch (e) { console.log('Cache clear skipped:', e.message); }

                // Trigger plan generation in background
                triggerOrchestration(userId).catch(err => console.error('Background orchestration failed:', err.message));

                actionResult = { goalId: goal.id, ...updates };
                goalChanged = true;
                console.log(`[Chat] Updated goal ${goal.id} for user ${userId}`);
                break;
            }

            case 'delete_goal': {
                if (!goal) {
                    return res.json({
                        message: "You don't have an active goal to remove.",
                        action: 'chat',
                        planUpdate: false,
                        goalChanged: false
                    });
                }

                await db.deleteGoal(goal.id);
                try { await db.clearUserCaches(userId); } catch (e) { console.log('Cache clear skipped:', e.message); }

                actionResult = { deletedGoalId: goal.id };
                goalChanged = true;
                console.log(`[Chat] Deleted goal ${goal.id} for user ${userId}`);
                break;
            }

            case 'skip_workout': {
                if (weeklyPlan && weeklyPlan.days) {
                    const skipDate = params.date === 'today' ? today : params.date;
                    const updatedDays = weeklyPlan.days.map(day => {
                        if (matchDay(day, skipDate)) {
                            return {
                                ...day,
                                title: 'Rest Day (Skipped)',
                                workout_type: 'rest',
                                distance: 0,
                                description: `Originally: ${day.title}. Skipped${params.reason ? ': ' + params.reason : ''}.`,
                                intensity: 'rest',
                                skipped: true,
                                originalTitle: day.title
                            };
                        }
                        return day;
                    });

                    const updatedWeeklyPlan = { ...weeklyPlan, days: updatedDays };
                    await db.cacheWeeklyPlan(userId, weekStart, updatedWeeklyPlan);

                    // Also update daily plan cache if skipping today
                    if (skipDate === today) {
                        const restDayPlan = {
                            recommended: {
                                title: 'Rest Day',
                                type: 'rest',
                                description: `Take a well-deserved rest day.${params.reason ? ' ' + params.reason : ''}`,
                                distance: '0',
                                targetPace: 'N/A',
                                duration: '0',
                                coachTip: 'Rest is when your body adapts and gets stronger. Enjoy the recovery!'
                            },
                            option_2: {
                                title: 'Light Walk',
                                type: 'recovery',
                                description: 'A gentle 15-20 minute walk to keep your body moving without stress.',
                                distance: '1-2km',
                                targetPace: 'Easy',
                                duration: '15-20min'
                            },
                            option_3: {
                                title: 'Stretching & Mobility',
                                type: 'recovery',
                                description: '15-minute stretching and foam rolling session for recovery.',
                                distance: '0',
                                targetPace: 'N/A',
                                duration: '15min'
                            }
                        };
                        await db.cacheDailyPlan(userId, today, restDayPlan);
                    }

                    actionResult = { skippedDate: skipDate, reason: params.reason };
                    console.log(`[Chat] Skipped workout on ${skipDate} for user ${userId}`);
                } else {
                    actionResult = { error: 'No weekly plan found to modify' };
                }
                break;
            }

            case 'swap_workouts': {
                if (weeklyPlan && weeklyPlan.days) {
                    const fromDate = params.from_date;
                    const toDate = params.to_date;

                    let fromIdx = weeklyPlan.days.findIndex(d => matchDay(d, fromDate));
                    let toIdx = weeklyPlan.days.findIndex(d => matchDay(d, toDate));

                    if (fromIdx !== -1 && toIdx !== -1) {
                        const updatedDays = [...weeklyPlan.days];
                        // Swap the workout data but keep the dates and day names
                        const fromWorkout = { ...updatedDays[fromIdx] };
                        const toWorkout = { ...updatedDays[toIdx] };

                        updatedDays[fromIdx] = {
                            ...updatedDays[fromIdx],
                            title: toWorkout.title,
                            workout_type: toWorkout.workout_type,
                            distance: toWorkout.distance,
                            description: toWorkout.description,
                            intensity: toWorkout.intensity,
                            target_time: toWorkout.target_time,
                            target_pace: toWorkout.target_pace
                        };
                        updatedDays[toIdx] = {
                            ...updatedDays[toIdx],
                            title: fromWorkout.title,
                            workout_type: fromWorkout.workout_type,
                            distance: fromWorkout.distance,
                            description: fromWorkout.description,
                            intensity: fromWorkout.intensity,
                            target_time: fromWorkout.target_time,
                            target_pace: fromWorkout.target_pace
                        };

                        const updatedWeeklyPlan = { ...weeklyPlan, days: updatedDays };
                        await db.cacheWeeklyPlan(userId, weekStart, updatedWeeklyPlan);

                        actionResult = { fromDate, toDate, swapped: true };
                        console.log(`[Chat] Swapped workouts: ${fromDate} <-> ${toDate} for user ${userId}`);
                    } else {
                        actionResult = { error: 'Could not find the specified days in the weekly plan' };
                    }
                } else {
                    actionResult = { error: 'No weekly plan found to modify' };
                }
                break;
            }

            case 'adjust_difficulty':
            case 'adjust_intensity': {
                // Prefer LLM-generated adjusted plan from Python
                if (updatedPlan && updatedPlan.dailyPlan && updatedPlan.dailyPlan.recommended) {
                    await db.cacheDailyPlan(userId, today, updatedPlan.dailyPlan);
                    actionResult = { adjusted: true, method: 'llm', direction: params.direction || 'easier' };
                    console.log(`[Chat] LLM-adjusted daily plan saved for user ${userId}`);
                } else {
                    // Fallback: programmatic intensity adjustment
                    const direction = params.direction || 'easier';
                    const percentage = params.percentage || 30;
                    const scaleFactor = direction === 'easier' ? (1 - percentage / 100) : (1 + percentage / 100);

                    const dailyCache = await db.getDailyPlanCache(userId, today);
                    if (dailyCache && dailyCache.plan_data) {
                        const currentPlan = dailyCache.plan_data;
                        const adjustWorkout = (workout) => {
                            if (!workout || workout.type === 'rest') return workout;
                            const dist = parseFloat(workout.distance) || 0;
                            const newDist = Math.round(dist * scaleFactor * 10) / 10;
                            const dur = parseInt(workout.duration) || 0;
                            const newDur = Math.round(dur * scaleFactor);
                            return {
                                ...workout,
                                distance: `${newDist}km`,
                                duration: `${newDur}min`,
                                title: direction === 'easier'
                                    ? workout.title.replace(/Tempo|Intervals|Threshold/i, 'Easy Run')
                                    : workout.title.replace(/Easy Run|Recovery/i, 'Tempo Run'),
                                targetPace: direction === 'easier' ? 'Easy' : 'Moderate-Hard',
                                description: `${direction === 'easier' ? 'Scaled down' : 'Scaled up'} from original. ${workout.description}`
                            };
                        };

                        const adjustedPlan = {
                            recommended: adjustWorkout(currentPlan.recommended),
                            option_2: adjustWorkout(currentPlan.option_2),
                            option_3: adjustWorkout(currentPlan.option_3)
                        };
                        await db.cacheDailyPlan(userId, today, adjustedPlan);
                        actionResult = { adjusted: true, method: 'programmatic', direction, percentage };
                        console.log(`[Chat] Programmatic fallback: adjusted intensity ${direction} by ${percentage}% for user ${userId}`);
                    } else {
                        actionResult = { error: 'No daily plan found to adjust' };
                    }
                }
                break;
            }

            case 'modify_plan': {
                // These are handled by the Python service (modify_plan_from_chat)
                // The response already contains updatedPlan
                if (planUpdate && updatedPlan?.weeklyPlan) {
                    await db.cacheWeeklyPlan(userId, weekStart, updatedPlan.weeklyPlan);
                }
                if (planUpdate && updatedPlan?.dailyPlan) {
                    await db.cacheDailyPlan(userId, today, updatedPlan.dailyPlan);
                }
                actionResult = { modified: true };
                break;
            }

            case 'weekly_summary': {
                // Build summary from weekly plan + recent activities
                const summaryParts = [];
                if (weeklyPlan && weeklyPlan.days) {
                    const totalPlannedKm = weeklyPlan.days.reduce((sum, d) => sum + (parseFloat(d.distance) || 0), 0);
                    const completedDays = weeklyPlan.days.filter(d => {
                        const dayDate = d.date;
                        return dayDate && dayDate <= today;
                    }).length;
                    const restDays = weeklyPlan.days.filter(d => d.workout_type === 'rest' || d.intensity === 'rest').length;
                    summaryParts.push(`Weekly plan: ${totalPlannedKm}km planned across ${7 - restDays} training days`);
                    summaryParts.push(`Progress: Day ${completedDays}/7 of the week`);
                }

                const recentActs = await db.getRecentActivities(userId, 7);
                if (recentActs.length > 0) {
                    const totalActualKm = Math.round(recentActs.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000 * 10) / 10;
                    summaryParts.push(`Completed this week: ${totalActualKm}km across ${recentActs.length} activities`);
                }

                actionResult = { summary: summaryParts.join('. ') };
                console.log(`[Chat] Generated weekly summary for user ${userId}`);
                break;
            }

            case 'extend_goal': {
                if (!goal) {
                    return res.json({
                        message: "You don't have an active goal to extend.",
                        action: 'chat', planUpdate: false, goalChanged: false
                    });
                }

                const weeksToAdd = params.weeks || 2;
                const currentDate = new Date(goal.target_date);
                currentDate.setDate(currentDate.getDate() + (weeksToAdd * 7));
                const newTargetDate = currentDate.toISOString().split('T')[0];

                await db.updateGoal(goal.id, { targetDate: newTargetDate });

                // Clear caches so plans regenerate with new timeline
                try { await db.clearUserCaches(userId); } catch (e) { console.log('Cache clear skipped:', e.message); }
                triggerOrchestration(userId).catch(err => console.error('Background orchestration failed:', err.message));

                actionResult = { originalDate: goal.target_date, newDate: newTargetDate, weeksAdded: weeksToAdd };
                goalChanged = true;
                console.log(`[Chat] Extended goal by ${weeksToAdd} weeks to ${newTargetDate} for user ${userId}`);
                break;
            }

            case 'get_estimate':
            case 'chat':
            default: {
                // Pure informational responses, no side effects
                actionResult = null;
                break;
            }
        }

        const effectiveActionForResponse = action || 'chat';
        const isPlanUpdate = planUpdate || ['skip_workout', 'swap_workouts', 'adjust_intensity', 'adjust_difficulty'].includes(effectiveActionForResponse);

        res.json({
            message: aiMessage,
            action: effectiveActionForResponse,
            actionResult,
            planUpdate: isPlanUpdate,
            updatedPlan,
            goalChanged
        });

        // Save assistant message to DB (after sending response for speed)
        const effectiveAction = action || 'chat';
        await db.saveCoachMessage(userId, 'assistant', aiMessage, {
            action: effectiveAction,
            params,
            planUpdate: planUpdate || effectiveAction === 'skip_workout' || effectiveAction === 'swap_workouts',
            goalChanged,
            actionResult
        });

    } catch (error) {
        console.error('Chat failed:', error.message);
        res.json({
            message: "I'm having trouble right now. Let's try again.",
            action: 'chat',
            planUpdate: false,
            goalChanged: false
        });
    }
});

export default router;
