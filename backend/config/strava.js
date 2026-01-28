import dotenv from 'dotenv';

dotenv.config();

// Strava OAuth Configuration
export const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
export const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
export const STRAVA_REDIRECT_URI = process.env.API_URL
    ? `${process.env.API_URL}/api/auth/strava/callback`
    : 'http://localhost:3000/api/auth/strava/callback';

// OAuth Scopes
export const STRAVA_SCOPES = 'read,activity:read_all,profile:read_all';

// Validate required config
if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('ERROR: Missing required Strava configuration in .env file');
    console.error('Required: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET');
    process.exit(1);
}

console.log('Strava Config Loaded:');
console.log('Client ID:', STRAVA_CLIENT_ID);
console.log('Redirect URI:', STRAVA_REDIRECT_URI);
console.log('Client Secret (masked):', STRAVA_CLIENT_SECRET ? `${STRAVA_CLIENT_SECRET.substring(0, 4)}...` : 'MISSING');
