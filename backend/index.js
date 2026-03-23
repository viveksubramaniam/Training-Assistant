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
    console.log('Backend loaded (Auth Fix + Safety Net)');
});

console.log('------------------------------------------------');
console.log(`Starting Server... Time: ${new Date().toISOString()}`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Cookie Config: Secure=${process.env.NODE_ENV === 'production'}, SameSite=${process.env.NODE_ENV === 'production' ? 'none' : 'lax'}`);
console.log('------------------------------------------------');

// CORS configuration for web and mobile clients
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000', 'https://vivek-training-asst.vercel.app'];

app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.set('trust proxy', 1); // Trust first proxy (Railway load balancer)
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'secret_key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production', // Secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
}));

// Debug Middleware
app.use((req, res, next) => {
    next();
});

// Mount routes
app.use('/api/auth/strava', stravaRoutes);
app.use('/api', stravaRoutes); // For /api/user endpoint
app.use('/api/activities', activitiesRoutes);  // For /api/activities, /api/activities/:id, /api/activities/sync
app.use('/api/activities', analysisRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/goals', goalsRoutes);
