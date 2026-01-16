/**
 * Coach Routes
 * 
 * Handles AI coach endpoints for daily/weekly plans and chat
 */

import { Router } from 'express';
import axios from 'axios';
import * as db from '../db/index.js';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

/**
 * GET /api/coach/daily-plan
 * Returns 3 workout options for today
 */
router.get('/daily-plan', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Check cache first
        const cached = await db.getDailyPlanCache(userId, today);

        if (cached && !cached.stale) {
            console.log(`Returning cached daily plan for ${today}`);
            return res.json(cached.plan_data);
        }

        // Get user's active goal and master plan
        const goal = await db.getActiveGoal(userId);
        if (!goal) {
            return res.json({
                noGoal: true,
                message: "Set a training goal to get personalized recommendations"
            });
        }

        const masterPlan = await db.getMasterPlan(goal.id);

        // Get recent activities (last 7 days)
        const recentActivities = await db.getRecentActivities(userId, 7);

        // Get weekly points
        const weeklyPoints = await db.getWeeklyPoints(userId);

        // Call AI service for daily recommendation
        const response = await axios.post(`${AI_SERVICE_URL}/daily-recommendation`, {
            goal: {
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance
            },
            masterPlan: masterPlan?.weeks || [],
            recentActivities: recentActivities.map(a => ({
                date: a.start_date,
                type: a.sport_type,
                distance: a.distance,
                duration: a.moving_time,
                avgHR: a.average_heartrate,
                sufferScore: a.suffer_score
            })),
            today: today,
            preferredDays: goal.preferred_workout_days
        }, { timeout: 30000 });

        const dailyPlan = {
            ...response.data,
            weeklyPoints
        };

        // Cache the result
        const latestActivityId = recentActivities[0]?.id || null;
        await db.cacheDailyPlan(userId, today, dailyPlan, latestActivityId);

        res.json(dailyPlan);

    } catch (error) {
        console.error('Daily plan generation failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'AI service unavailable'
            });
        }

        res.status(500).json({
            error: 'Failed to generate daily plan'
        });
    }
});

/**
 * GET /api/coach/weekly-plan
 * Returns full week's workout schedule
 */
router.get('/weekly-plan', requireAuth, async (req, res) => {
    const userId = req.session.userId;

    // Get week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];

    try {
        // Check cache first
        const cached = await db.getWeeklyPlanCache(userId, weekStart);

        if (cached) {
            console.log(`Returning cached weekly plan for week of ${weekStart}`);
            return res.json(cached.plan_data);
        }

        // Get user's active goal and master plan
        const goal = await db.getActiveGoal(userId);
        if (!goal) {
            return res.json({
                noGoal: true,
                message: "Set a training goal to get a weekly plan"
            });
        }

        const masterPlan = await db.getMasterPlan(goal.id);

        // Calculate which week number we're on
        const goalStart = new Date(goal.created_at);
        const weeksSinceStart = Math.floor((new Date() - goalStart) / (7 * 24 * 60 * 60 * 1000)) + 1;

        // Call AI service for weekly plan
        const response = await axios.post(`${AI_SERVICE_URL}/weekly-plan`, {
            goal: {
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance
            },
            masterPlan: masterPlan?.weeks || [],
            currentWeek: weeksSinceStart,
            weekStart: weekStart,
            preferredDays: goal.preferred_workout_days
        }, { timeout: 30000 });

        const weeklyPlan = response.data;

        // Cache the result
        await db.cacheWeeklyPlan(userId, weekStart, weeklyPlan);

        res.json(weeklyPlan);

    } catch (error) {
        console.error('Weekly plan generation failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'AI service unavailable'
            });
        }

        res.status(500).json({
            error: 'Failed to generate weekly plan'
        });
    }
});

/**
 * POST /api/coach/chat
 * Send message to coach, get response
 */
router.post('/chat', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { message, context } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        // Save user message
        await db.saveCoachMessage(userId, 'user', message, context);

        // Get recent conversation history
        const history = await db.getCoachHistory(userId, 10);

        // Get current daily plan context
        const today = new Date().toISOString().split('T')[0];
        const dailyPlan = await db.getDailyPlanCache(userId, today);

        // Call AI service
        const response = await axios.post(`${AI_SERVICE_URL}/coach-chat`, {
            message,
            history: history.map(h => ({ role: h.role, content: h.message })),
            currentPlan: dailyPlan?.plan_data || null
        }, { timeout: 30000 });

        const assistantMessage = response.data.message;
        const planUpdate = response.data.planUpdate;

        // Save assistant response
        await db.saveCoachMessage(userId, 'assistant', assistantMessage);

        // If coach suggests plan modification, invalidate daily cache
        if (planUpdate) {
            await db.invalidateDailyPlanCache(userId, today);
        }

        res.json({
            message: assistantMessage,
            planUpdate
        });

    } catch (error) {
        console.error('Coach chat failed:', error.message);
        res.status(500).json({
            error: 'Coach is unavailable'
        });
    }
});

/**
 * GET /api/coach/streak
 * Get current training streak
 */
router.get('/streak', requireAuth, async (req, res) => {
    const userId = req.session.userId;

    try {
        const streak = await db.calculateStreak(userId);
        res.json({ streakDays: streak });
    } catch (error) {
        console.error('Streak calculation failed:', error.message);
        res.json({ streakDays: 0 });
    }
});

export default router;
