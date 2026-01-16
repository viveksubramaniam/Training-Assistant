/**
 * JSON File Database Adapter (LowDB)
 * 
 * This is the original JSON file storage implementation.
 * Kept for backward compatibility and development without PostgreSQL.
 */

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

// Initialize databases
const activitiesAdapter = new JSONFile('db.json');
const summariesAdapter = new JSONFile('ai_summaries.json');

const activitiesDb = new Low(activitiesAdapter, { users: {} });
const summariesDb = new Low(summariesAdapter, { summaries: [] });

// Initialize databases
await activitiesDb.read();
await summariesDb.read();

if (!activitiesDb.data.users) {
    activitiesDb.data = { users: {} };
    await activitiesDb.write();
}

if (!summariesDb.data.summaries) {
    summariesDb.data = { summaries: [] };
    await summariesDb.write();
}

/* ========================================================================== */
/*                           ACTIVITIES OPERATIONS                            */
/* ========================================================================== */

/**
 * Get a single activity by ID
 */
export const getActivity = (userId, activityId) => {
    const user = activitiesDb.data.users[userId];
    if (!user || !user.activities) return null;
    return user.activities.find(a => a.id.toString() === activityId.toString());
};

/**
 * List all activities for a user
 */
export const listActivities = (userId) => {
    const user = activitiesDb.data.users[userId];
    return user?.activities || [];
};

/**
 * Save/update activities for a user (bulk operation for Strava sync)
 */
export const saveActivities = async (userId, activities) => {
    if (!activitiesDb.data.users[userId]) {
        activitiesDb.data.users[userId] = { activities: [] };
    }

    const user = activitiesDb.data.users[userId];

    // Merge logic: create a map of existing activities
    const activityMap = new Map();
    (user.activities || []).forEach(a => activityMap.set(a.id, a));

    // Add/update new activities
    activities.forEach(a => activityMap.set(a.id, a));

    // Convert back to array and sort by date (newest first)
    user.activities = Array.from(activityMap.values()).sort((a, b) =>
        new Date(b.start_date) - new Date(a.start_date)
    );

    await activitiesDb.write();
    return activities.length;
};

/**
 * Update a single activity
 */
export const updateActivity = async (userId, activityId, updates) => {
    const user = activitiesDb.data.users[userId];
    if (!user || !user.activities) return null;

    const index = user.activities.findIndex(a => a.id.toString() === activityId.toString());
    if (index === -1) return null;

    user.activities[index] = { ...user.activities[index], ...updates };
    await activitiesDb.write();

    return user.activities[index];
};

/* ========================================================================== */
/*                              USER OPERATIONS                               */
/* ========================================================================== */

/**
 * Get user data (for authentication/profile)
 */
export const getUser = (userId) => {
    return activitiesDb.data.users[userId];
};

/**
 * Save/update user data
 */
export const saveUser = async (user) => {
    activitiesDb.data.users[user.stravaId] = user;
    await activitiesDb.write();
};

/* ========================================================================== */
/*                          AI SUMMARIES OPERATIONS                           */
/* ========================================================================== */

/**
 * Get cached AI summary for an activity (with all versions)
 */
export const getSummary = (activityId) => {
    return summariesDb.data.summaries.find(s => s.activityId === activityId.toString());
};

/**
 * Save AI summary for an activity (adds as new version)
 */
export const saveSummary = async (activityId, summaryData) => {
    const index = summariesDb.data.summaries.findIndex(s => s.activityId === activityId.toString());

    if (index > -1) {
        // Existing summary - add new version
        const existing = summariesDb.data.summaries[index];

        // Initialize versions array if old format
        if (!existing.versions) {
            existing.versions = [{
                versionNumber: 1,
                text: existing.text,
                generatedAt: existing.generatedAt,
                model: existing.model,
                status: existing.status
            }];
            existing.regenerationCount = 1;
            existing.selectedVersion = null;
        }

        // Add new version (max 3)
        if (existing.versions.length < 3) {
            const newVersion = {
                versionNumber: existing.versions.length + 1,
                ...summaryData,
                cachedAt: new Date().toISOString()
            };
            existing.versions.push(newVersion);
            existing.regenerationCount = existing.versions.length;
        }

        summariesDb.data.summaries[index] = existing;
    } else {
        // New summary - create with first version
        const summary = {
            activityId: activityId.toString(),
            versions: [{
                versionNumber: 1,
                ...summaryData,
                cachedAt: new Date().toISOString()
            }],
            selectedVersion: null,
            regenerationCount: 1
        };
        summariesDb.data.summaries.push(summary);
    }

    await summariesDb.write();
    return summariesDb.data.summaries.find(s => s.activityId === activityId.toString());
};

/**
 * Select a version and delete others
 */
export const selectSummaryVersion = async (activityId, versionNumber) => {
    const index = summariesDb.data.summaries.findIndex(s => s.activityId === activityId.toString());

    if (index === -1) return null;

    const summary = summariesDb.data.summaries[index];
    const selectedVersion = summary.versions.find(v => v.versionNumber === versionNumber);

    if (!selectedVersion) return null;

    // Keep only selected version
    summary.versions = [selectedVersion];
    summary.selectedVersion = versionNumber;

    await summariesDb.write();
    return summary;
};

/**
 * Delete AI summary for an activity
 */
export const deleteSummary = async (activityId) => {
    const index = summariesDb.data.summaries.findIndex(s => s.activityId === activityId.toString());

    if (index === -1) return false;

    summariesDb.data.summaries.splice(index, 1);
    await summariesDb.write();
    return true;
};

/* ========================================================================== */
/*                         EMBEDDING OPERATIONS (STUB)                        */
/* ========================================================================== */

/**
 * Save embedding for an activity (not supported in JSON adapter)
 */
export const saveEmbedding = async (activityId, embedding, model) => {
    console.warn('Embeddings not supported in JSON adapter');
    return null;
};

/**
 * Search similar activities by embedding (not supported in JSON adapter)
 */
export const searchSimilarActivities = async (userId, embedding, limit = 10) => {
    console.warn('Embedding search not supported in JSON adapter');
    return [];
};

// Export database instances for backward compatibility
export const db = activitiesDb;
export const summaryDb = summariesDb;
