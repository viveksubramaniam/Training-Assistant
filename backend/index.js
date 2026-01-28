import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';

// Import configuration
import './config/strava.js'; // This validates config on startup

// Import routes
import stravaRoutes from './routes/strava.js';
import activitiesRoutes from './routes/activities.js';
import analysisRoutes from './routes/analysis.js';
import coachRoutes from './routes/coach.js';
import goalsRoutes from './routes/goals.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

console.log('------------------------------------------------');
console.log(`Starting Server... Time: ${new Date().toISOString()}`);
console.log('------------------------------------------------');

// CORS configuration for web and mobile clients
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000', 'https://vivek-training-asst.vercel.app'];

app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true
}));

app.use(express.json());

app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'secret_key'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Mount routes
app.use('/api/auth/strava', stravaRoutes);
app.use('/api', stravaRoutes); // For /api/user endpoint
app.use('/api/activities', activitiesRoutes);  // For /api/activities, /api/activities/:id, /api/activities/sync
app.use('/api/activities', analysisRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/goals', goalsRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
