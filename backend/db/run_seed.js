/**
 * Run the demo user seed script via Node.js
 * Usage: node backend/db/run_seed.js
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, 'seed_demo_user.sql'), 'utf8');
    try {
        await pool.query(sql);
        console.log('✅ Demo user seeded successfully!');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await pool.end();
    }
}

run();
