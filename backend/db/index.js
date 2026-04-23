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
/*                             GOAL OPERATIONS                                */
/* ========================================================================== */

/**
 * Get active goal for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Goal object or null
 */
export const getActiveGoal = adapter.getActiveGoal;

/**
 * Get goal by ID
 * @param {string} goalId - Goal ID
 * @returns {Promise<Object|null>} Goal object or null
 */
export const getGoalById = adapter.getGoalById;

/**
 * Create a new goal
 * @param {string} userId - User ID
 * @param {Object} goalData - Goal data
 * @returns {Promise<Object>} Created goal
 */
export const createGoal = adapter.createGoal;

/**
 * Update an existing goal
 * @param {string} goalId - Goal ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated goal or null
 */
export const updateGoal = adapter.updateGoal;

/**
 * Deactivate all goals for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const deactivateUserGoals = adapter.deactivateUserGoals;

/**
 * Delete a goal
 * @param {string} goalId - Goal ID
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteGoal = adapter.deleteGoal;

/**
 * Mark goal as completed
 * @param {string} goalId - Goal ID
 * @returns {Promise<Object>} Completed goal
 */
export const completeGoal = adapter.completeGoal;

/**
 * Get goal history
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of completed goals
 */
export const getGoalHistory = adapter.getGoalHistory;

/**
 * Get master plan for a goal
 * @param {string} goalId - Goal ID
 * @returns {Promise<Object|null>} Master plan or null
 */
export const getMasterPlan = adapter.getMasterPlan;

/**
 * Save master plan for a goal
 * @param {string} goalId - Goal ID
 * @param {Object} planData - Plan data from AI
 * @returns {Promise<Object>} Saved plan
 */
export const saveMasterPlan = adapter.saveMasterPlan;

/**
 * Get activity summary for AI context
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Activity summary
 */
export const getActivitySummary = adapter.getActivitySummary;

/**
 * Clear user caches
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export const clearUserCaches = adapter.clearUserCaches;


/* ========================================================================== */
/*                        COACH & PLAN OPERATIONS                             */
/* ========================================================================== */

// Plan Caching
export const getDailyPlanCache = adapter.getDailyPlanCache;
export const saveDailyPlanCache = adapter.saveDailyPlanCache;
export const cacheDailyPlan = adapter.saveDailyPlanCache; // Alias for coach.js compatibility
export const invalidateDailyPlanCache = adapter.invalidateDailyPlanCache;

export const getWeeklyPlanCache = adapter.getWeeklyPlanCache;
export const saveWeeklyPlanCache = adapter.saveWeeklyPlanCache;
export const cacheWeeklyPlan = adapter.saveWeeklyPlanCache; // Alias for coach.js compatibility

// Analytics & Context
export const getRecentActivities = adapter.getRecentActivities;
export const getWeeklyPoints = adapter.getWeeklyPoints;
export const getFitnessProfile = adapter.getFitnessProfile;
export const calculateStreak = adapter.calculateStreak;

/**
 * Compute personalized pace targets (easy / tempo / long-run) from activity history.
 * Only available in the PostgreSQL adapter; falls back to returning nulls in JSON mode.
 * @param {string} userId
 * @param {number} [weeksCompleted=0]
 * @returns {Promise<{easyPace: string|null, tempoPace: string|null, longRunPace: string|null}>}
 */
export const computePersonalizedPaces = adapter.computePersonalizedPaces
    || (async () => ({ easyPace: null, tempoPace: null, longRunPace: null }));

// Coach Chat
export const getCoachHistory = adapter.getCoachHistory;
export const saveCoachMessage = adapter.saveCoachMessage;


/**
 * Get database type from environment
 * @returns {string} 'json' or 'postgres'
 */
export const getDatabaseType = () => DATABASE_TYPE;

// Export database instances for backward compatibility (JSON adapter only)
export const db = adapter.db;
export const summaryDb = adapter.summaryDb;

