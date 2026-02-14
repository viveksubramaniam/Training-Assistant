/**
 * Goals Routes (Simplified for LangGraph)
 * 
 * Handles user training goal CRUD
 * Master plan generation is done by calling /orchestrate endpoint
 */

import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as db from '../db/index.js';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

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

/**
 * GET /api/goals
 * Get user's active goal
 */
router.get('/', requireAuth, async (req, res) => {
    const userId = req.userId;

    try {
        const goal = await db.getActiveGoal(userId);

        if (!goal) {
            return res.json({ hasGoal: false });
        }

        // Get master plan summary
        const masterPlan = await db.getMasterPlan(goal.id);

        res.json({
            hasGoal: true,
            goal: {
                id: goal.id,
                type: goal.goal_type,
                targetDate: goal.target_date,
                weeklyTarget: goal.weekly_target_distance,
                preferredDays: goal.preferred_workout_days,
                createdAt: goal.created_at
            },
            masterPlan: masterPlan ? {
                totalWeeks: masterPlan.total_weeks,
                peakWeek: masterPlan.peak_week,
                taperStart: masterPlan.taper_start_week,
                weeksPreview: masterPlan.weeks?.slice(0, 4) || []
            } : null
        });

    } catch (error) {
        console.error('Get goal failed:', error.message);
        res.status(500).json({ error: 'Failed to get goal' });
    }
});

/**
 * POST /api/goals
 * Create new goal - master plan will be generated via /orchestrate on next load
 */
router.post('/', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { goalType, targetDate, weeklyTarget, preferredDays } = req.body;

    console.log(`POST /api/goals - userId: ${userId}, goalType: ${goalType}`);

    if (!goalType) {
        return res.status(400).json({ error: 'Goal type required' });
    }

    try {
        // Create new goal
        console.log('Creating new goal...');
        const goal = await db.createGoal(userId, {
            goalType,
            targetDate,
            weeklyTarget,
            preferredDays
        });

        console.log(`Created goal ${goal.id} for user ${userId}`);

        // Clear any existing caches so /orchestrate will generate fresh plans
        try {
            await db.clearUserCaches(userId);
        } catch (e) {
            console.log('Cache clear skipped:', e.message);
        }

        res.json({
            success: true,
            hasGoal: true,
            goal: {
                id: goal.id,
                type: goalType,
                targetDate,
                weeklyTarget,
                preferredDays
            },
            message: 'Goal created. Master plan will be generated when you view your daily plan.'
        });

    } catch (error) {
        console.error('Create goal failed:', error.message);
        res.status(500).json({ error: 'Failed to create goal', details: error.message });
    }
});

/**
 * PUT /api/goals/:id
 * Update existing goal - clears caches, plan regenerates on next load
 */
router.put('/:id', requireAuth, async (req, res) => {
    const userId = req.userId;
    const goalId = req.params.id;
    const { goalType, targetDate, weeklyTarget, preferredDays } = req.body;

    try {
        // Verify goal belongs to user
        const existingGoal = await db.getGoalById(goalId);
        if (!existingGoal || existingGoal.user_id.toString() !== userId.toString()) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Update goal
        await db.updateGoal(goalId, {
            goalType,
            targetDate,
            weeklyTarget,
            preferredDays
        });

        // Clear caches so /orchestrate will generate fresh plans
        try {
            await db.clearUserCaches(userId);
        } catch (e) {
            console.log('Cache clear skipped:', e.message);
        }

        res.json({
            success: true,
            hasGoal: true,
            goal: {
                id: goalId,
                type: goalType || existingGoal.goal_type,
                targetDate: targetDate || existingGoal.target_date,
                weeklyTarget: weeklyTarget || existingGoal.weekly_target_distance,
                preferredDays: preferredDays || existingGoal.preferred_workout_days
            },
            message: 'Goal updated. Plan will regenerate when you view your daily plan.'
        });

    } catch (error) {
        console.error('Update goal failed:', error.message);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

/**
 * DELETE /api/goals/:id
 * Delete a goal
 */
router.delete('/:id', requireAuth, async (req, res) => {
    const userId = req.session.stravaId;
    const goalId = req.params.id;

    try {
        const existingGoal = await db.getGoalById(goalId);
        if (!existingGoal || existingGoal.user_id.toString() !== userId.toString()) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await db.deleteGoal(goalId);

        try {
            await db.clearUserCaches(userId);
        } catch (e) {
            console.log('Cache clear skipped:', e.message);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Delete goal failed:', error.message);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

/**
 * GET /api/goals/history
 * Get completed goals history
 */
router.get('/history', requireAuth, async (req, res) => {
    const userId = req.userId;
    try {
        const history = await db.getGoalHistory(userId);
        res.json(history);
    } catch (error) {
        console.error('Get goal history failed:', error.message);
        res.status(500).json({ error: 'Failed to get goal history' });
    }
});

/**
 * POST /api/goals/:id/complete
 * Mark goal as completed
 */
router.post('/:id/complete', requireAuth, async (req, res) => {
    const userId = req.userId;
    const goalId = req.params.id;

    try {
        // Verify goal belongs to user
        const existingGoal = await db.getGoalById(goalId);
        if (!existingGoal || existingGoal.user_id.toString() !== userId.toString()) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const completedGoal = await db.completeGoal(goalId);

        // Clear caches as the active goal is now gone
        try {
            await db.clearUserCaches(userId);
        } catch (e) {
            console.log('Cache clear skipped:', e.message);
        }

        res.json({ success: true, goal: completedGoal });

    } catch (error) {
        console.error('Complete goal failed:', error.message);
        res.status(500).json({ error: 'Failed to complete goal' });
    }
});

export default router;
