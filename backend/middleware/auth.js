import axios from 'axios';
import jwt from 'jsonwebtoken';
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
            console.error('Token refresh failed for user:', user.stravaId, error.message);
            const err = new Error('Token refresh failed. Please re-authenticate with Strava.');
            err.code = 'REAUTH_REQUIRED';
            throw err;
        }
    }
    return user;
};

/**
 * Middleware: Require authenticated session
 */
export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'secret_key');
        req.session = req.session || {}; // Polyfill if needed
        req.session.stravaId = decoded.stravaId; // Backwards compatibility
        req.userId = decoded.stravaId; // New standard
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Middleware: Get authenticated user from database
 */
export const getAuthenticatedUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'secret_key');
        const user = db.getUser(decoded.stravaId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        req.user = user;
        req.session = req.session || {};
        req.session.stravaId = decoded.stravaId;
        req.userId = decoded.stravaId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
