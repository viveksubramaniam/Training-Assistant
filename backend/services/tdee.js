function computeAge(dob) {
    if (!dob) return 30;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(16, Math.min(age, 90));
}

function mifflinBMR(weight_kg, height_cm, age, gender) {
    const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
    if (gender === 'male') return base + 5;
    if (gender === 'female') return base - 161;
    return base - 78;
}

function activityMultiplier(totalMovingSeconds) {
    const hours = totalMovingSeconds / 3600;
    if (hours < 1) return { multiplier: 1.2, level: 'sedentary' };
    if (hours < 3) return { multiplier: 1.375, level: 'lightly_active' };
    if (hours < 6) return { multiplier: 1.55, level: 'moderately_active' };
    return { multiplier: 1.725, level: 'very_active' };
}

function workoutBonus(activities) {
    if (!activities || activities.length === 0) return 0;
    const hasHard = activities.some(
        a => (a.suffer_score && a.suffer_score > 50) || (a.moving_time_seconds && a.moving_time_seconds > 3600)
    );
    if (!hasHard) return 0;
    const hasVeryHard = activities.some(
        a => (a.suffer_score && a.suffer_score > 100) || (a.moving_time_seconds && a.moving_time_seconds > 5400)
    );
    return hasVeryHard ? 400 : 200;
}

function macroGoals(kcal, proteinPct, carbsPct, fatPct) {
    return {
        kcal: Math.round(kcal),
        protein_g: Math.round((kcal * proteinPct) / 4),
        carbs_g: Math.round((kcal * carbsPct) / 4),
        fat_g: Math.round((kcal * fatPct) / 9)
    };
}

export function calculateTDEE({
    height_cm,
    weight_kg,
    date_of_birth,
    gender = 'other',
    activities_last_7_days = [],
    macro_protein_pct = 0.30,
    macro_carb_pct = 0.45,
    macro_fat_pct = 0.25
}) {
    const h = height_cm || 170;
    const w = weight_kg || 70;
    const age = computeAge(date_of_birth);

    const bmr = Math.round(mifflinBMR(w, h, age, gender));

    const totalMovingSeconds = activities_last_7_days.reduce(
        (sum, a) => sum + (a.moving_time_seconds || a.moving_time || 0), 0
    );

    const { multiplier, level } = activityMultiplier(totalMovingSeconds);
    const bonus = workoutBonus(activities_last_7_days);
    const tdee = Math.round(bmr * multiplier + bonus);

    const total = macro_protein_pct + macro_carb_pct + macro_fat_pct;
    const pPct = total > 0 ? macro_protein_pct / total : 0.30;
    const cPct = total > 0 ? macro_carb_pct / total : 0.45;
    const fPct = total > 0 ? macro_fat_pct / total : 0.25;

    return {
        bmr,
        tdee,
        activity_level: level,
        macro_goals: macroGoals(tdee, pPct, cPct, fPct)
    };
}