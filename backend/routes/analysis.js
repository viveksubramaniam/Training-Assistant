import express from 'express';
import axios from 'axios';
import * as db from '../db/index.js';

const router = express.Router();

// AI Service Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * GET /api/activities/:id/analysis
 * Get cached AI analysis for an activity
 */
router.get('/:id/analysis', async (req, res) => {
    const activityId = req.params.id;
    const summary = await db.getSummary(activityId);

    if (summary) {
        return res.json(summary);
    }
    res.status(404).json({ error: 'Summary not found' });
});

/**
 * POST /api/activities/:id/analysis
 * Generate AI analysis for an activity
 */
router.post('/:id/analysis', async (req, res) => {
    const activityId = req.params.id;
    const { activityData } = req.body;

    if (!activityData) {
        return res.status(400).json({ error: 'Activity data required' });
    }

    try {
        console.log(`Generating AI Analysis for Activity ${activityId} via Python service...`);

        // Call Python AI Service
        const response = await axios.post(`${AI_SERVICE_URL}/analyze`, activityData, {
            timeout: 60000 // 60 second timeout for LLM generation
        });

        const analysisData = response.data;

        // Save to database using abstraction layer
        const savedSummary = await db.saveSummary(activityId, analysisData);

        res.json(savedSummary);

    } catch (error) {
        console.error('Analysis Generation failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'AI service unavailable. Is the Python AI service running on ' + AI_SERVICE_URL + '?'
            });
        }

        res.status(500).json({
            error: error.response?.data?.detail || 'Failed to generate AI analysis'
        });
    }
});

/**
 * POST /api/activities/:id/analysis/regenerate
 * Regenerate AI analysis (create new version)
 */
router.post('/:id/analysis/regenerate', async (req, res) => {
    const activityId = req.params.id;
    const { activityData } = req.body;

    if (!activityData) {
        return res.status(400).json({ error: 'Activity data required' });
    }

    try {
        // Check if we can regenerate (max 3 versions)
        const existing = await db.getSummary(activityId);
        if (existing && existing.versions && existing.versions.length >= 3) {
            return res.status(400).json({ error: 'Maximum 3 versions reached' });
        }

        if (existing && existing.selectedVersion) {
            return res.status(400).json({ error: 'Cannot regenerate after selecting a version' });
        }

        console.log(`Regenerating AI Analysis for Activity ${activityId}...`);

        // Call Python AI Service
        const response = await axios.post(`${AI_SERVICE_URL}/analyze`, activityData, {
            timeout: 60000
        });

        const analysisData = response.data;

        // Save as new version
        const savedSummary = await db.saveSummary(activityId, analysisData);

        res.json(savedSummary);

    } catch (error) {
        console.error('Regeneration failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'AI service unavailable. Is the Python AI service running on ' + AI_SERVICE_URL + '?'
            });
        }

        res.status(500).json({
            error: error.response?.data?.detail || 'Failed to regenerate AI analysis'
        });
    }
});

/**
 * POST /api/activities/:id/analysis/select
 * Select a specific version of AI analysis (delete others)
 */
router.post('/:id/analysis/select', async (req, res) => {
    const activityId = req.params.id;
    const { versionNumber } = req.body;

    if (!versionNumber) {
        return res.status(400).json({ error: 'Version number required' });
    }

    try {
        const result = await db.selectSummaryVersion(activityId, versionNumber);

        if (!result) {
            return res.status(404).json({ error: 'Summary or version not found' });
        }

        res.json(result);

    } catch (error) {
        console.error('Version selection failed:', error.message);
        res.status(500).json({ error: 'Failed to select version' });
    }
});

/**
 * DELETE /api/activities/:id/analysis
 * Delete AI summary for an activity (for regeneration)
 */
router.delete('/:id/analysis', async (req, res) => {
    const activityId = req.params.id;

    try {
        const deleted = await db.deleteSummary(activityId);

        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Summary not found' });
        }
    } catch (error) {
        console.error('Delete summary failed:', error.message);
        res.status(500).json({ error: 'Failed to delete summary' });
    }
});

export default router;
