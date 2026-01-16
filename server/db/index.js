/**
 * Unified Database Abstraction Layer
 * 
 * This module dynamically loads the appropriate database adapter based on
 * the DATABASE_TYPE environment variable. Supports 'json' (default) and 'postgres'.
 * 
 * All consumers should import from this file, not directly from adapters.
 */

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'json';

console.log(`📦 Database adapter: ${DATABASE_TYPE}`);

// Dynamically import the appropriate adapter
let adapter;

if (DATABASE_TYPE === 'postgres') {
    adapter = await import('./postgres.js');
} else {
    adapter = await import('./json.js');
}

/* ========================================================================== */
/*                           ACTIVITIES OPERATIONS                            */
/* ========================================================================== */

/**
 * Get a single activity by ID
 * @param {string} userId - Strava user ID
 * @param {string} activityId - Activity ID
 * @returns {Object|null} Activity object or null if not found
 */
export const getActivity = adapter.getActivity;

/**
 * List all activities for a user
 * @param {string} userId - Strava user ID
 * @returns {Array} Array of activities
 */
export const listActivities = adapter.listActivities;

/**
 * Save/update activities for a user (bulk operation for Strava sync)
 * @param {string} userId - Strava user ID
 * @param {Array} activities - Array of activity objects from Strava
 * @returns {Promise<number>} Number of activities saved
 */
export const saveActivities = adapter.saveActivities;

/**
 * Update a single activity
 * @param {string} userId - Strava user ID
 * @param {string} activityId - Activity ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated activity or null if not found
 */
export const updateActivity = adapter.updateActivity;

/* ========================================================================== */
/*                              USER OPERATIONS                               */
/* ========================================================================== */

/**
 * Get user data (for authentication/profile)
 * @param {string} userId - Strava user ID
 * @returns {Object|null} User object or null
 */
export const getUser = adapter.getUser;

/**
 * Save/update user data
 * @param {Object} user - User object with stravaId
 * @returns {Promise<void>}
 */
export const saveUser = adapter.saveUser;

/* ========================================================================== */
/*                          AI SUMMARIES OPERATIONS                           */
/* ========================================================================== */

/**
 * Get cached AI summary for an activity (with all versions)
 * @param {string} activityId - Activity ID
 * @returns {Object|null} Summary object with versions array or null if not found
 */
export const getSummary = adapter.getSummary;

/**
 * Save AI summary for an activity (adds as new version)
 * @param {string} activityId - Activity ID
 * @param {Object} summaryData - Summary data from Python AI service
 * @returns {Promise<Object>} Saved summary object with all versions
 */
export const saveSummary = adapter.saveSummary;

/**
 * Select a version and delete others
 * @param {string} activityId - Activity ID
 * @param {number} versionNumber - Version number to keep
 * @returns {Promise<Object|null>} Updated summary with only selected version
 */
export const selectSummaryVersion = adapter.selectSummaryVersion;

/**
 * Delete AI summary for an activity
 * @param {string} activityId - Activity ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export const deleteSummary = adapter.deleteSummary;

/* ========================================================================== */
/*                          EMBEDDING OPERATIONS                              */
/* ========================================================================== */

/**
 * Save embedding for an activity
 * @param {string} activityId - Activity ID
 * @param {Array<number>} embedding - Vector embedding
 * @param {string} model - Embedding model used
 * @returns {Promise<Object>} Saved embedding metadata
 */
export const saveEmbedding = adapter.saveEmbedding;

/**
 * Search similar activities by embedding
 * @param {string} userId - User ID
 * @param {Array<number>} embedding - Query embedding
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Activities sorted by similarity
 */
export const searchSimilarActivities = adapter.searchSimilarActivities;

/* ========================================================================== */
/*                         UTILITY EXPORTS                                    */
/* ========================================================================== */

/**
 * Get database type from environment
 * @returns {string} 'json' or 'postgres'
 */
export const getDatabaseType = () => DATABASE_TYPE;

// Export database instances for backward compatibility (JSON adapter only)
export const db = adapter.db;
export const summaryDb = adapter.summaryDb;
