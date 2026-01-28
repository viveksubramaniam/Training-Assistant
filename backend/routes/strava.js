import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as db from '../db/index.js';
import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI, STRAVA_SCOPES } from '../config/strava.js';

const router = express.Router();

/**
 * GET /api/auth/strava/login
 * Initiate Strava OAuth flow
 */
router.get('/login', (req, res) => {
    console.log('[GET] /api/auth/strava/login - Initiating Strava Login');
    const redirectUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${STRAVA_REDIRECT_URI}&approval_prompt=auto&scope=${STRAVA_SCOPES}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
});

/**
 * GET /api/auth/strava/callback
 * Handle Strava OAuth callback
 */
router.get('/callback', async (req, res) => {
    console.log('[GET] /api/auth/strava/callback - Received callback');
    const { code } = req.query;
    if (!code) {
        console.error('Error: No code provided');
        return res.status(400).send('Code missing');
    }

    try {
        console.log('Exchanging code for token...');
        const params = new URLSearchParams();
        params.append('client_id', STRAVA_CLIENT_ID);
        params.append('client_secret', STRAVA_CLIENT_SECRET);
        params.append('code', code);
        params.append('grant_type', 'authorization_code');

        const tokenResponse = await axios.post('https://www.strava.com/oauth/token', params);

        console.log('Token exchange successful');
        const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;
        console.log(`Athlete: ${athlete.firstname} ${athlete.lastname} (${athlete.id})`);

        // Save user to DB
        const existingUser = await db.getUser(athlete.id) || { activities: [] };
        const user = {
            ...existingUser,
            stravaId: athlete.id,
            name: `${athlete.firstname} ${athlete.lastname}`,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: expires_at,
            profile: athlete.profile,
        };

        await db.saveUser(user);

        // Generate JWT

        const token = jwt.sign(
            { stravaId: athlete.id, name: user.name },
            process.env.SESSION_SECRET || 'secret_key',
            { expiresIn: '24h' }
        );

        console.log('JWT Generated for:', athlete.id);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}?token=${token}`);
    } catch (error) {
        console.error('Error in callback:', error.response?.data || error.message);
        console.error('Full Error Object:', JSON.stringify(error, null, 2));
        res.status(500).send('Authentication failed');
    }
});

/**
 * GET /api/user
 * Get current authenticated user info
 */
router.get('/user', async (req, res) => {
    console.log('[GET] /api/user - Verifying Token');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token provided');
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.split(' ')[1];

    try {

        const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'secret_key');

        const user = await db.getUser(decoded.stravaId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('User authenticated:', user.name);
        res.json({ name: user.name, profile: user.profile, lastSyncTime: user.lastSyncTime });

    } catch (err) {
        console.error('Invalid Token:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

/**
 * POST /api/logout
 * Clear session and log out
 */
router.post('/logout', (req, res) => {
    req.session = null; // Clear cookie-session
    res.json({ success: true });
});

export default router;
