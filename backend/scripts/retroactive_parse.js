import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import * as db from '../db/index.js';
import { parseStrengthDescription } from './strength_parser.js';
import { pool } from '../db/postgres.js';

export async function processWeightTrainingActivity(activityId, userId, accessToken) {
    try {
        const detailRes = await axios.get(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
        );
        const description = detailRes.data.description || '';

        if (!description.trim()) {
            return { activityId, status: 'empty' };
        }

        const hash = crypto.createHash('sha256').update(description).digest('hex');
        const existingSets = await db.getWeightTrainingSets(activityId);
        const existingHash = existingSets[0]?.description_hash ?? null;

        if (existingHash === hash && existingSets.length > 0) {
            return { activityId, status: 'skipped' };
        }

        await db.deleteWeightTrainingSets(activityId);
        const sets = parseStrengthDescription(description);
        const setsWithHash = sets.map(s => ({ ...s, description_hash: hash }));
        const inserted = await db.saveWeightTrainingSets(activityId, userId, setsWithHash);

        return { activityId, status: 'inserted', count: inserted };
    } catch (err) {
        console.warn(`[retroactive_parse] Activity ${activityId} failed:`, err.message);
        return { activityId, status: 'error', error: err.message };
    }
}

async function run() {
    console.log('[retroactive_parse] Starting retroactive parse run...');

    let usersResult;
    try {
        usersResult = await pool.query(`
            SELECT strava_id, access_token, refresh_token, expires_at, name
            FROM users
            WHERE access_token IS NOT NULL
              AND strava_id != 999999999
        `);
    } catch (err) {
        console.error('[retroactive_parse] Could not fetch users:', err.message);
        process.exit(1);
    }

    const users = usersResult.rows;
    console.log(`[retroactive_parse] Processing ${users.length} user(s)`);

    const summary = { inserted: 0, skipped: 0, empty: 0, error: 0 };

    for (const user of users) {
        console.log(`[retroactive_parse] User ${user.strava_id} (${user.name})`);

        const activities = await db.listWeightTrainingActivities(user.strava_id);
        console.log(`  Found ${activities.length} WeightTraining/Workout activities`);

        for (const act of activities) {
            const result = await processWeightTrainingActivity(
                act.id,
                user.strava_id,
                user.access_token
            );
            summary[result.status] = (summary[result.status] || 0) + 1;
            console.log(`  Activity ${act.id}: ${result.status}${result.count != null ? ` (${result.count} sets)` : ''}`);
        }
    }

    console.log('[retroactive_parse] Done.', summary);
    process.exit(0);
}

const isMain = process.argv[1] && process.argv[1].endsWith('retroactive_parse.js');
if (isMain) {
    run().catch(err => {
        console.error('[retroactive_parse] Fatal error:', err);
        process.exit(1);
    });
}