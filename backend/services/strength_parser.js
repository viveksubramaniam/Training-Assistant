/**
 * Strength Parser Service
 *
 * Parses Hevy/Strava WeightTraining activity descriptions into structured sets.
 *
 * Export:
 *   parseStrengthDescription(description) → { sets, confidence, description_hash }
 *
 * Each set: { exercise_name, set_number, reps, weight_kg, weight_unit, muscle_groups }
 *
 * Parsing strategy:
 *   1. Regex path (primary)  — handles standard Hevy export formats
 *   2. LLM fallback          — claude-haiku-4-5-20251001 via Anthropic Messages API (axios)
 *   3. None                  — empty / unstructured descriptions
 *
 * No external database calls — pure computation.
 */

import crypto from 'crypto';
import { createRequire } from 'module';
import axios from 'axios';

// Load muscle_groups.json using createRequire (reliable JSON import in Node 18/20 ESM)
const require = createRequire(import.meta.url);
const muscleGroups = require('../data/muscle_groups.json');

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function sha256(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Look up muscle groups for a given exercise name.
 * Priority: exact lowercase match → exercise contains key → key contains exercise.
 */
function lookupMuscleGroups(exerciseName) {
    const normalised = exerciseName.toLowerCase().trim();

    if (muscleGroups[normalised]) return muscleGroups[normalised];

    for (const key of Object.keys(muscleGroups)) {
        if (normalised.includes(key)) return muscleGroups[key];
    }

    for (const key of Object.keys(muscleGroups)) {
        if (key.includes(normalised)) return muscleGroups[key];
    }

    return [];
}

/**
 * Parse a weight value and unit into a normalised pair.
 * Per spec: do NOT convert lbs → kg; pass raw numeric value through.
 */
function parseWeight(value, unit) {
    const numeric = parseFloat(value);
    if (isNaN(numeric) || value === null || value === undefined) {
        return { weight_kg: null, weight_unit: null };
    }
    const normUnit = (unit ?? 'kg').toLowerCase().trim();
    const resolvedUnit = (normUnit === 'lbs' || normUnit === 'lb') ? 'lbs' : 'kg';
    return { weight_kg: numeric, weight_unit: resolvedUnit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex patterns (Hevy/Strava formats)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pattern A — "Exercise Name: NxM @ Wkg" or "Exercise Name NxM Wkg"
 * Examples:
 *   "Bench Press: 3×10 @ 80kg"  → 3 sets, 10 reps, 80 kg
 *   "Squat 5x5 100kg"           → 5 sets, 5 reps, 100 kg
 *   "Deadlift 1×5 @ 185kg"      → 1 set, 5 reps, 185 kg
 *   "Curl (DB): 3×12 @ 35lbs"   → 3 sets, 12 reps, 35 lbs
 *
 * Capture groups: [1] exercise name, [2] sets, [3] reps, [4] weight value, [5] unit
 */
const PATTERN_A = /^([A-Za-z][A-Za-z0-9\s\-'(),./]+?)\s*:?\s*(\d+)\s*[xX×]\s*(\d+)\s*(?:@\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs?)\b/i;

/**
 * Pattern B — "N sets of M reps [@ W unit]"
 * Examples:
 *   "3 sets of 8 reps 75kg"
 *   "Squat – 4 sets of 6 reps @ 120kg"
 *
 * Capture groups: [1] optional exercise prefix, [2] sets, [3] reps, [4] weight value, [5] unit
 */
const PATTERN_B = /^([A-Za-z][A-Za-z0-9\s\-'(),./]*?)?\s*(\d+)\s+sets?\s+of\s+(\d+)\s+reps?\s*(?:@\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs?)\b/i;

/**
 * Pattern C — named set list: "Exercise: NxM, NxM, NxM [@ W unit]"
 * Example:
 *   "Pull-ups: 3x5, 3x5, 3x5"       → 3 separate sets, 5 reps each, bodyweight
 *   "Squat: 5x5, 5x5 @ 100kg"       → 2 sets, 5 reps, 100 kg
 *
 * This pattern is matched on the header; individual NxM tokens are extracted with a secondary regex.
 */
const PATTERN_C_HEADER = /^([A-Za-z][A-Za-z0-9\s\-'(),./]+?)\s*:\s*((?:\d+\s*[xX×]\s*\d+\s*,?\s*)+)\s*(?:@\s*(\d+(?:\.\d+)?)\s*(kg|lbs?))?/i;
const TOKEN_NxM = /(\d+)\s*[xX×]\s*(\d+)/g;

// ─────────────────────────────────────────────────────────────────────────────
// Per-line parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * False-positive guard: skip lines that are clearly not workout sets.
 */
function isLikelyFalsePositive(line) {
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) return true; // ISO date
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(line)) return true; // clock time
    if (/^(duration|time|date|notes?|workout|session|total):/i.test(line)) return true;
    return false;
}

/**
 * Parse one line of text into zero or more raw set objects.
 * Returns { exercise_name, reps, weight_kg, weight_unit } entries (no set_number yet).
 */
function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || isLikelyFalsePositive(trimmed)) return [];

    // ── Pattern C (set list — most specific, try first) ──
    const matchC = PATTERN_C_HEADER.exec(trimmed);
    if (matchC) {
        const exerciseName = matchC[1].trim();
        const setTokenStr = matchC[2];
        const weightVal = matchC[3] ?? null;
        const weightUnit = matchC[4] ?? null;
        const { weight_kg, weight_unit } = parseWeight(weightVal, weightUnit);

        const sets = [];
        TOKEN_NxM.lastIndex = 0;
        let tok;
        while ((tok = TOKEN_NxM.exec(setTokenStr)) !== null) {
            // In a set list like "3x5, 3x5", each token is one set group.
            // Per spec "Pull-ups: 3x5, 3x5, 3x5" → 3 separate set lines.
            // Each NxM token represents (sets_count x reps_per_set) — expand accordingly.
            const tokenSets = parseInt(tok[1], 10);
            const tokenReps = parseInt(tok[2], 10);
            for (let i = 0; i < tokenSets; i++) {
                sets.push({ exercise_name: exerciseName, reps: tokenReps, weight_kg, weight_unit });
            }
        }
        if (sets.length > 0) return sets;
    }

    // ── Pattern A (NxM @ Wkg) ──
    const matchA = PATTERN_A.exec(trimmed);
    if (matchA) {
        const exerciseName = matchA[1].trim();
        const setsCount = parseInt(matchA[2], 10);
        const reps = parseInt(matchA[3], 10);
        const { weight_kg, weight_unit } = parseWeight(matchA[4], matchA[5]);

        return Array.from({ length: setsCount }, () => ({
            exercise_name: exerciseName,
            reps,
            weight_kg,
            weight_unit
        }));
    }

    // ── Pattern B (N sets of M reps) ──
    const matchB = PATTERN_B.exec(trimmed);
    if (matchB) {
        const exerciseRaw = matchB[1] ? matchB[1].replace(/[-–—]+$/, '').trim() : null;
        const exerciseName = exerciseRaw || 'Unknown Exercise';
        const setsCount = parseInt(matchB[2], 10);
        const reps = parseInt(matchB[3], 10);
        const { weight_kg, weight_unit } = parseWeight(matchB[4], matchB[5]);

        return Array.from({ length: setsCount }, () => ({
            exercise_name: exerciseName,
            reps,
            weight_kg,
            weight_unit
        }));
    }

    return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex path — full description
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try parsing the full description with regex.
 * Returns a flat array of raw set objects if confidence threshold is met,
 * or null if fewer than 50% of non-empty lines produced sets.
 */
function tryRegexParse(description) {
    const lines = description.split(/\r?\n/);
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);

    if (nonEmptyLines.length === 0) return null;

    const parsedPerLine = nonEmptyLines.map(line => parseLine(line));
    const successCount = parsedPerLine.filter(sets => sets.length > 0).length;

    // Confidence threshold: ≥50% of non-empty lines must yield at least one set
    const threshold = Math.ceil(nonEmptyLines.length * 0.5);
    if (successCount < threshold) return null;

    const allSets = parsedPerLine.flat();
    return allSets.length > 0 ? allSets : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM fallback — Anthropic Messages API via axios
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_VERSION = '2023-06-01';

function buildLLMPrompt(description) {
    return `You are a strength training log parser. Parse the following workout description into structured JSON.

Return ONLY valid JSON — no explanation, no markdown, no code fences. The response must be parseable by JSON.parse().

Schema:
{
  "sets": [
    {
      "exercise_name": "string",
      "reps": number,
      "weight_kg": number | null,
      "weight_unit": "kg" | "lbs" | null
    }
  ]
}

Rules:
- Each physical set is a separate entry. If a log says "3x10 @ 80kg" that is 3 entries with reps=10 and weight_kg=80.
- If weight is in lbs, preserve the numeric value as-is and set weight_unit to "lbs". Do NOT convert to kg.
- If weight is absent (bodyweight exercise), set weight_kg to null and weight_unit to null.
- exercise_name must be the name as written in the log (preserve capitalisation).
- If the description contains no workout set data at all, return {"sets":[]}.

Workout description:
---
${description}
---

Return ONLY the JSON object. No explanation, no markdown.`;
}

/**
 * Call the Anthropic Messages API.
 * Throws on network/API errors (caller handles gracefully).
 * Returns [] if the model output cannot be parsed as valid JSON with a sets array.
 */
async function callLLM(description) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.warn('[StrengthParser] ANTHROPIC_API_KEY not configured — LLM fallback skipped');
        return [];
    }

    const response = await axios.post(
        ANTHROPIC_API_URL,
        {
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            messages: [{ role: 'user', content: buildLLMPrompt(description) }]
        },
        {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_API_VERSION,
                'content-type': 'application/json'
            },
            timeout: 30000
        }
    );

    const rawText = (response.data?.content?.[0]?.text ?? '').trim();

    // Strip any accidental markdown fences
    const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        console.error('[StrengthParser] LLM returned non-parseable output:', rawText.substring(0, 300));
        return [];
    }

    if (!Array.isArray(parsed?.sets)) {
        console.error('[StrengthParser] LLM JSON missing "sets" array');
        return [];
    }

    return parsed.sets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment — assign set_number + muscle_groups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finalise raw set objects:
 *   - assign sequential set_number per exercise
 *   - populate muscle_groups via lookup
 *   - coerce numeric fields
 */
function enrichSets(rawSets) {
    const counters = new Map();

    return rawSets.map(raw => {
        const name = (raw.exercise_name || 'Unknown Exercise').trim();
        const prev = counters.get(name) ?? 0;
        const setNum = prev + 1;
        counters.set(name, setNum);

        const reps = typeof raw.reps === 'number'
            ? raw.reps
            : (Number.isFinite(parseInt(raw.reps, 10)) ? parseInt(raw.reps, 10) : null);

        const rawWeight = raw.weight_kg;
        const weightKg = rawWeight !== null && rawWeight !== undefined
            ? (typeof rawWeight === 'number' ? rawWeight : parseFloat(rawWeight))
            : null;

        return {
            exercise_name: name,
            set_number: setNum,
            reps,
            weight_kg: (weightKg !== null && !isNaN(weightKg)) ? weightKg : null,
            weight_unit: raw.weight_unit ?? (weightKg !== null && !isNaN(weightKg) ? 'kg' : null),
            muscle_groups: lookupMuscleGroups(name)
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a Hevy/Strava WeightTraining activity description into structured sets.
 *
 * @param {string} description - Raw activity description text
 * @returns {Promise<{
 *   sets: Array<{exercise_name: string, set_number: number, reps: number|null, weight_kg: number|null, weight_unit: string|null, muscle_groups: string[]}>,
 *   confidence: 'regex' | 'llm' | 'none',
 *   description_hash: string
 * }>}
 */
export async function parseStrengthDescription(description) {
    // Edge case: empty / non-string input
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return {
            sets: [],
            confidence: 'none',
            description_hash: sha256(typeof description === 'string' ? description : '')
        };
    }

    const descriptionHash = sha256(description);

    // ── 1. Regex path ──
    const regexSets = tryRegexParse(description);
    if (regexSets !== null) {
        console.log(`[StrengthParser] Regex confidence: ${regexSets.length} raw sets`);
        return {
            sets: enrichSets(regexSets),
            confidence: 'regex',
            description_hash: descriptionHash
        };
    }

    // ── 2. LLM fallback ──
    try {
        console.log('[StrengthParser] Regex threshold not met — calling LLM fallback');
        const llmSets = await callLLM(description);

        if (!llmSets || llmSets.length === 0) {
            return { sets: [], confidence: 'none', description_hash: descriptionHash };
        }

        console.log(`[StrengthParser] LLM returned ${llmSets.length} raw sets`);
        return {
            sets: enrichSets(llmSets),
            confidence: 'llm',
            description_hash: descriptionHash
        };
    } catch (err) {
        console.error('[StrengthParser] LLM call failed:', err.message);
        return { sets: [], confidence: 'none', description_hash: descriptionHash };
    }
}