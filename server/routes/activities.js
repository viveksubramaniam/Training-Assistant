import express from 'express';
import axios from 'axios';
import * as db from '../db/index.js';
import { requireAuth, ensureValidToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/activities
 * List all activities from local DB
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const activities = await db.listActivities(req.session.stravaId);
        res.json(activities);
    } catch (error) {
        console.error('Error listing activities:', error.message);
        res.status(500).json({ error: 'Failed to list activities' });
    }
});

/**
 * POST /sync (when mounted at /api)
 * Sync activities from Strava
 */
router.post('/sync', requireAuth, async (req, res) => {
    const user = await db.getUser(req.session.stravaId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure valid token using helper
    try {
        await ensureValidToken(user);
    } catch (err) {
        return res.status(401).json({ error: 'Authentication failed: ' + err.message });
    }

    const { fullSync } = req.body;
    console.log(`Starting sync for user ${user.name}. Full Sync: ${fullSync}`);

    let page = 1;
    let allFetched = [];
    const per_page = 200;

    // If fullSync is requested, start from 0 (Epoch), otherwise use lastSyncTime
    const after = fullSync ? 0 : (user.lastSyncTime ? Math.floor(user.lastSyncTime / 1000) : 1420070400);

    try {
        while (true) {
            console.log(`Fetching page ${page}...`);
            const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
                headers: { Authorization: `Bearer ${user.accessToken}` },
                params: {
                    per_page,
                    page,
                    after
                }
            });

            const activities = response.data;
            if (!activities || activities.length === 0) {
                break;
            }

            allFetched.push(...activities);
            console.log(`Fetched ${activities.length} activities.`);

            if (activities.length < per_page) {
                break; // No more pages
            }
            page++;
        }

        console.log(`Total new activities fetched: ${allFetched.length}`);

        // Add hasDetailedData flag to all activities (initially false)
        const activitiesWithFlag = allFetched.map(activity => ({
            ...activity,
            hasDetailedData: false
        }));

        // Save activities using DB abstraction
        const count = await db.saveActivities(req.session.stravaId, activitiesWithFlag);

        // Update user's lastSyncTime
        user.lastSyncTime = Date.now();
        await db.saveUser(user);

        const totalActivities = (await db.listActivities(req.session.stravaId)).length;

        res.json({
            success: true,
            count: allFetched.length,
            total: totalActivities,
            lastSyncTime: user.lastSyncTime
        });

    } catch (error) {
        console.error('Sync failed:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to sync with Strava' });
    }
});

/**
 * GET /api/activities/:id
 * Get detailed activity data (with lazy loading and caching)
 */
router.get('/:id', requireAuth, async (req, res) => {
    const activityId = req.params.id;
    const userId = req.session.stravaId;

    // Validate activity ID is numeric
    // Temporarily disabled for debugging
    // if (!/^\d+$/.test(activityId)) {
    //     console.log(`Invalid activity ID: ${activityId}`);
    //     return res.status(400).json({ error: 'Invalid activity ID' });
    // }

    // Check if we have detailed data in cache
    const cachedActivity = await db.getActivity(userId, activityId);

    if (cachedActivity && cachedActivity.hasDetailedData) {
        console.log(`Returning cached detailed data for activity ${activityId}`);
        return res.json(cachedActivity);
    }

    // Not in cache or not detailed - fetch from Strava
    console.log(`Fetching detailed data from Strava for activity ${activityId}`);

    let user = await db.getUser(userId);

    // Ensure valid token using helper
    try {
        await ensureValidToken(user);
    } catch (err) {
        return res.status(401).json({ error: 'Authentication failed: ' + err.message });
    }

    try {
        // Fetch detailed activity, zones, and streams from Strava
        const [activityRes, zonesRes, streamsRes] = await Promise.all([
            axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
                headers: { Authorization: `Bearer ${user.accessToken}` }
            }),
            axios.get(`https://www.strava.com/api/v3/activities/${activityId}/zones`, {
                headers: { Authorization: `Bearer ${user.accessToken}` }
            }).catch(err => ({ data: [] })), // Handle zones not found gracefully
            axios.get(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,heartrate,velocity_smooth&key_by_type=true`, {
                headers: { Authorization: `Bearer ${user.accessToken}` }
            }).catch(err => ({ data: {} })) // Handle streams error gracefully
        ]);

        const detailedActivity = {
            ...activityRes.data,
            zones: zonesRes.data,
            streams: streamsRes.data,
            hasDetailedData: true  // Mark as having detailed data
        };

        // Save to database cache
        await db.updateActivity(userId, activityId, detailedActivity);
        console.log(`Cached detailed data for activity ${activityId}`);

        res.json(detailedActivity);

    } catch (error) {
        console.error('Error fetching activity details:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch activity details' });
    }
});

export default router;
