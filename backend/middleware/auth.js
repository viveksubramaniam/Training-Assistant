import axios from 'axios';
import * as db from '../db/index.js';
import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } from '../config/strava.js';

/**
 * Refresh Strava access token using refresh token
 */
export const refreshAccessToken = async (refreshToken) => {
    try {
        const params = new URLSearchParams();
        params.append('client_id', STRAVA_CLIENT_ID);
        params.append('client_secret', STRAVA_CLIENT_SECRET);
        // Prioritize user's refresh token if provided
        const tokenToUse = refreshToken;
        params.append('refresh_token', tokenToUse);
        params.append('grant_type', 'refresh_token');

        console.log(`Refreshing access token... (Using User Token)`);
        const response = await axios.post('https://www.strava.com/oauth/token', params);
        return response.data;
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Ensure user has a valid access token, refresh if needed
 * Checks expiration with 5-minute buffer and auto-refreshes
 */
export const ensureValidToken = async (user) => {
    // Check if token is expired (giving a 5 minute buffer)
    // Strava expires_at is in seconds since epoch
    const now = Date.now() / 1000;
    if (now > user.expiresAt - 300) {
        console.log(`Token expired (or close to expiring). ExpiresAt: ${user.expiresAt}, Now: ${now}. Refreshing...`);
        try {
            const refreshData = await refreshAccessToken(user.refreshToken);

            // Update user object with new tokens
            user.accessToken = refreshData.access_token;
            user.refreshToken = refreshData.refresh_token;
            user.expiresAt = refreshData.expires_at;

            // Save updated user to DB
            await db.saveUser(user);
            console.log('Token refreshed and saved successfully.');
        } catch (error) {
            console.error('Critical Error: Failed to refresh token in helper:', error.message);
            throw new Error('Failed to refresh authentication token');
        }
    }
    return user;
};

/**
 * Middleware: Require authenticated session
 */
export const requireAuth = (req, res, next) => {
    if (!req.session.stravaId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

/**
 * Middleware: Get authenticated user from database
 */
export const getAuthenticatedUser = async (req, res, next) => {
    if (!req.session.stravaId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = db.getUser(req.session.stravaId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = user;
    next();
};
