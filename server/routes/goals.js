/**
 * Goals Routes
 * 
 * Handles user training goal CRUD and triggers master plan generation
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
 * GET /api/goals
 * Get user's active goal
 */
router.get('/', requireAuth, async (req, res) => {
    const userId = req.session.userId;

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
                weeksPreview: masterPlan.weeks.slice(0, 4) // First 4 weeks preview
            } : null
        });

    } catch (error) {
        console.error('Get goal failed:', error.message);
        res.status(500).json({ error: 'Failed to get goal' });
    }
});

/**
 * POST /api/goals
 * Create new goal and generate master plan
 */
router.post('/', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { goalType, targetDate, weeklyTarget, preferredDays } = req.body;

    if (!goalType) {
        return res.status(400).json({ error: 'Goal type required' });
    }

    try {
        // Deactivate any existing goals
        await db.deactivateUserGoals(userId);

        // Create new goal
        const goal = await db.createGoal(userId, {
            goalType,
            targetDate,
            weeklyTarget,
            preferredDays
        });

        console.log(`Created goal ${goal.id} for user ${userId}`);

        // Get user's activity history for context
        const activitySummary = await db.getActivitySummary(userId);

        // Generate master plan via AI
        try {
            const response = await axios.post(`${AI_SERVICE_URL}/generate-master-plan`, {
                goal: {
                    type: goalType,
                    targetDate,
                    weeklyTarget
                },
                preferredDays,
                userHistory: activitySummary
            }, { timeout: 60000 });

            const masterPlanData = response.data;

            // Save master plan
            await db.saveMasterPlan(goal.id, masterPlanData);

            console.log(`Generated master plan for goal ${goal.id}`);

            res.json({
                success: true,
                goal: {
                    id: goal.id,
                    type: goalType,
                    targetDate,
                    weeklyTarget,
                    preferredDays
                },
                masterPlan: {
                    totalWeeks: masterPlanData.totalWeeks,
                    peakWeek: masterPlanData.peakWeek,
                    taperStart: masterPlanData.taperStart
                }
            });

        } catch (aiError) {
            console.error('Master plan generation failed:', aiError.message);

            // Goal created but plan failed - still return success
            res.json({
                success: true,
                goal: {
                    id: goal.id,
                    type: goalType,
                    targetDate,
                    weeklyTarget,
                    preferredDays
                },
                masterPlan: null,
                warning: 'Goal saved but master plan generation failed. Will retry on next load.'
            });
        }

    } catch (error) {
        console.error('Create goal failed:', error.message);
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

/**
 * PUT /api/goals/:id
 * Update existing goal (regenerates master plan)
 */
router.put('/:id', requireAuth, async (req, res) => {
    const userId = req.session.userId;
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

        // Clear existing caches
        await db.clearUserCaches(userId);

        // Regenerate master plan
        const activitySummary = await db.getActivitySummary(userId);

        try {
            const response = await axios.post(`${AI_SERVICE_URL}/generate-master-plan`, {
                goal: {
                    type: goalType || existingGoal.goal_type,
                    targetDate: targetDate || existingGoal.target_date,
                    weeklyTarget: weeklyTarget || existingGoal.weekly_target_distance
                },
                preferredDays: preferredDays || existingGoal.preferred_workout_days,
                userHistory: activitySummary
            }, { timeout: 60000 });

            await db.saveMasterPlan(goalId, response.data);

            res.json({
                success: true,
                message: 'Goal updated and plan regenerated'
            });

        } catch (aiError) {
            res.json({
                success: true,
                message: 'Goal updated but plan regeneration failed',
                warning: aiError.message
            });
        }

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
    const userId = req.session.userId;
    const goalId = req.params.id;

    try {
        const existingGoal = await db.getGoalById(goalId);
        if (!existingGoal || existingGoal.user_id.toString() !== userId.toString()) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await db.deleteGoal(goalId);
        await db.clearUserCaches(userId);

        res.json({ success: true });

    } catch (error) {
        console.error('Delete goal failed:', error.message);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

export default router;
