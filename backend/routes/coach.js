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
            forceRegenerate: false
        }, { timeout: 120000 });

        // Check if result is wrapped in 'result' key (from prepare_result node)
        // or available at root (snake_case from state)
        const state = response.data;
        const result = state.result || {};

        console.log('[Async] AI Response State Keys:', Object.keys(state));
        if (state.result) console.log('[Async] AI Response Result Keys:', Object.keys(state.result));

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
 * POST /api/coach/chat
 * Chat with AI coach - can modify plans
 */
router.post('/chat', requireAuth, async (req, res) => {
    const userId = req.session.stravaId;
    const { message } = req.body;

    try {
        const goal = await db.getActiveGoal(userId);
        const masterPlan = goal ? await db.getMasterPlan(goal.id) : null;
        const weekStart = getWeekStart();
        const weeklyPlan = await db.getWeeklyPlanCache(userId, weekStart);

        const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
            userId: String(userId),
            message: message,
            goal: goal ? {
                type: goal.goal_type,
                weeklyTarget: goal.weekly_target_distance
            } : null,
            masterPlan: masterPlan,
            currentPlan: weeklyPlan
        }, { timeout: 60000 });

        const { message: aiMessage, planUpdate, updatedPlan } = response.data;

        console.log('[Chat] AI Response:', { planUpdate, hasUpdatedPlan: !!updatedPlan, hasWeeklyPlan: !!updatedPlan?.weeklyPlan });

        if (planUpdate && updatedPlan?.weeklyPlan) {
            console.log('[Chat] Saving updated weekly plan to cache');
            await db.cacheWeeklyPlan(userId, weekStart, updatedPlan.weeklyPlan);
            console.log('[Chat] Weekly plan saved successfully');
        }

        if (planUpdate && updatedPlan?.dailyPlan) {
            console.log('[Chat] Saving updated daily plan to cache');
            const today = new Date().toISOString().split('T')[0];
            await db.cacheDailyPlan(userId, today, updatedPlan.dailyPlan);
            console.log('[Chat] Daily plan saved successfully');
        }

        res.json({
            message: aiMessage,
            planUpdate: planUpdate,
            updatedPlan: updatedPlan
        });

    } catch (error) {
        console.error('Chat failed:', error.message);
        res.json({
            message: "I'm having trouble right now. Let's try again.",
            planUpdate: false
        });
    }
});

export default router;
