import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config/api';
import GoalEditorModal from './GoalEditorModal';
import ConfirmationModal from './components/ConfirmationModal';
import PlanCreatingLoader from './components/PlanCreatingLoader';

const ChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const PHASES = ['Base', 'Build', 'Peak', 'Taper', 'Race'];

const ProfilePage = ({ user, activities }) => {
    const [showGoalEditor, setShowGoalEditor] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [currentGoal, setCurrentGoal] = useState(null);
    const [savingGoal, setSavingGoal] = useState(false);
    const [creatingPlan, setCreatingPlan] = useState(false);

    // Load goal from server on mount
    useEffect(() => {
        const fetchGoal = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const res = await fetch(`${API_BASE_URL}/api/goals`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasGoal && data.goal) {
                        setCurrentGoal(data.goal);
                    } else {
                        setCurrentGoal(null);
                    }
                }
            } catch (err) {
                console.error('Failed to load goal:', err);
                const savedGoal = localStorage.getItem('trainingGoal');
                if (savedGoal) {
                    setCurrentGoal(JSON.parse(savedGoal));
                }
            }
        };
        fetchGoal();
    }, []);

    // Calculate weekly km from Sunday to Saturday
    const getWeeklyKm = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

        // Get start of week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        // Get end of week (Saturday)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Filter activities within this week and sum distance
        const weeklyDistance = (activities || []).reduce((total, activity) => {
            const activityDate = new Date(activity.start_date || activity.date);
            if (activityDate >= startOfWeek && activityDate <= endOfWeek) {
                return total + (activity.distance || 0);
            }
            return total;
        }, 0);

        return weeklyDistance / 1000; // Convert to km
    };

    const weeklyKm = getWeeklyKm();
    const weeklyGoalKm = currentGoal?.weeklyTarget || 40;
    const goalPercentage = Math.min(100, Math.round((weeklyKm / weeklyGoalKm) * 100));
    const remainingKm = Math.max(0, weeklyGoalKm - weeklyKm);

    const handleSaveGoal = async (goalData) => {
        setSavingGoal(true);
        setCreatingPlan(true); // Show the loader immediately

        try {
            const goalPayload = {
                goalType: goalData.goalType,
                targetDate: goalData.targetDate || null,
                weeklyTarget: goalData.weeklyTarget,
                preferredDays: goalData.preferredDays
            };

            // Always create a new goal so previous ones are archived/history is kept
            const method = 'POST';
            const url = `${API_BASE_URL}/api/goals`;
            const token = localStorage.getItem('authToken');

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(goalPayload)
            });

            if (res.ok) {
                const data = await res.json();
                setCurrentGoal(data.goal);
                localStorage.setItem('trainingGoal', JSON.stringify(data.goal));

                // Now trigger the orchestrator to generate the plan with forceRegenerate
                try {
                    console.log('Triggering plan regeneration...');
                    const regenerateRes = await fetch(`${API_BASE_URL}/api/coach/regenerate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (regenerateRes.ok) {
                        const result = await regenerateRes.json();
                        console.log('Plan generated successfully!', result);
                    } else {
                        console.warn('Plan regeneration failed, plan will generate on next view');
                    }
                } catch (regenerateErr) {
                    console.warn('Could not trigger plan regeneration:', regenerateErr);
                    // Plan will still generate when user views daily plan
                }
            } else {
                console.error('Failed to save goal to server');
            }
        } catch (err) {
            console.error('Error saving goal:', err);
        } finally {
            setSavingGoal(false);
            setCreatingPlan(false);
        }
    };

    const executeCompleteGoal = async () => {
        if (!currentGoal?.id) return;

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE_URL}/api/goals/${currentGoal.id}/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Goal completed, reset current state
                setCurrentGoal(null);
                localStorage.removeItem('trainingGoal');
            }
        } catch (err) {
            console.error('Failed to complete goal:', err);
        }
    };

    const formatDaysUntil = (dateStr) => {
        if (!dateStr) return null;
        const targetDate = new Date(dateStr);
        const now = new Date();
        const diffTime = targetDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Past';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day';
        if (diffDays < 7) return `${diffDays} days`;
        return `${Math.ceil(diffDays / 7)} weeks`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Unknown';
        return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ── Avg pace from last 3 activities ──
    const avgPaceStr = (() => {
        const recent = (activities || []).slice(0, 3).filter(a => (a.average_speed || 0) > 0);
        if (recent.length === 0) return '—';
        const avgSpeed = recent.reduce((sum, a) => sum + a.average_speed, 0) / recent.length;
        const paceMin = 16.6667 / avgSpeed;
        const mins = Math.floor(paceMin);
        const secs = Math.round((paceMin - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    })();

    // ── 5k PR from activities ──
    const fiveKPrStr = (() => {
        const fiveKs = (activities || []).filter(a => {
            const d = a.distance || 0;
            return d >= 4800 && d <= 5200 && (a.average_speed || 0) > 0;
        });
        if (fiveKs.length === 0) return '—';
        // Best pace = highest average_speed
        const best = fiveKs.reduce((b, a) => a.average_speed > b.average_speed ? a : b, fiveKs[0]);
        const paceMin = 16.6667 / best.average_speed;
        const mins = Math.floor(paceMin);
        const secs = Math.round((paceMin - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    })();

    // ── Phase progress bar ──
    const activePhase = currentGoal?.phase || 'Base';
    const activePhaseIdx = PHASES.indexOf(activePhase);

    return (
        <div
            className="w-full min-h-screen flex flex-col pb-24"
            style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}
        >
            <main className="flex-1 px-5 pt-8 pb-4 space-y-5">

                {/* ── 1. User row ── */}
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-ignite), var(--color-crimson))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            className="font-display font-bold text-xl"
                            style={{ color: 'var(--color-fg)' }}
                        >
                            {user?.name?.[0] || 'A'}
                        </span>
                    </div>
                    {/* Name + meta */}
                    <div>
                        <div
                            className="font-display font-semibold"
                            style={{ fontSize: 20, color: 'var(--color-fg)' }}
                        >
                            {user?.name || 'Athlete'}
                        </div>
                        <div
                            className="mono-data"
                            style={{ fontSize: 11, color: 'var(--color-fg-dim)', marginTop: 2 }}
                        >
                            Since Feb 2024 · Strava linked
                        </div>
                    </div>
                </div>

                {/* ── 2. Current goal hero card ── */}
                <div
                    style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        borderRadius: 20,
                        padding: 20,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Ambient glow */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: 'var(--color-ignite)',
                            opacity: 0.08,
                            filter: 'blur(40px)',
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Goal type badge + days remaining */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                            className="mono-data"
                            style={{
                                fontSize: 10,
                                color: 'var(--color-ignite)',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {currentGoal?.type?.toUpperCase() || 'NO GOAL'}
                        </span>
                        <span
                            className="mono-data"
                            style={{ fontSize: 11, color: 'var(--color-fg-dim)' }}
                        >
                            {formatDaysUntil(currentGoal?.targetDate) || '—'}
                        </span>
                    </div>

                    {/* Title */}
                    <div
                        className="font-display font-semibold"
                        style={{ fontSize: 22, color: 'var(--color-fg)', marginTop: 8 }}
                    >
                        {currentGoal?.type || 'Set a Goal'}
                    </div>

                    {/* Training phase progress bar */}
                    <div style={{ marginTop: 16 }}>
                        {/* Segmented bar */}
                        <div style={{ display: 'flex', gap: 2, position: 'relative', alignItems: 'center' }}>
                            {PHASES.map((phase, idx) => {
                                const isActive = idx === activePhaseIdx;
                                const isPast = idx < activePhaseIdx;
                                const segWidth = `calc(${100 / PHASES.length}% - 2px)`;
                                return (
                                    <div
                                        key={phase}
                                        style={{
                                            flex: 1,
                                            height: 4,
                                            borderRadius: 2,
                                            background: (isActive || isPast)
                                                ? 'var(--color-ignite)'
                                                : 'var(--color-surface-2)',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Dot marker on right edge of active segment */}
                                        {isActive && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    right: -4,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    background: 'var(--color-ignite)',
                                                    border: '2px solid var(--color-bg)',
                                                    zIndex: 2,
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Phase labels */}
                        <div style={{ display: 'flex', marginTop: 6 }}>
                            {PHASES.map((phase, idx) => (
                                <div
                                    key={phase}
                                    className="mono-data"
                                    style={{
                                        flex: 1,
                                        fontSize: 9,
                                        color: idx === activePhaseIdx
                                            ? 'var(--color-ignite)'
                                            : 'var(--color-fg-dim)',
                                        textAlign: idx === 0 ? 'left' : idx === PHASES.length - 1 ? 'right' : 'center',
                                    }}
                                >
                                    {phase}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3-stat grid */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: 12,
                            borderTop: '1px solid var(--color-line)',
                            paddingTop: 16,
                            marginTop: 16,
                        }}
                    >
                        {/* Weekly KM */}
                        <div>
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, color: 'var(--color-fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
                            >
                                WEEKLY KM
                            </div>
                            <div
                                className="mono-data"
                                style={{ fontSize: 18, color: 'var(--color-fg)' }}
                            >
                                {weeklyKm.toFixed(1)}
                            </div>
                        </div>
                        {/* Avg Pace */}
                        <div>
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, color: 'var(--color-fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
                            >
                                AVG PACE
                            </div>
                            <div
                                className="mono-data"
                                style={{ fontSize: 18, color: 'var(--color-fg)' }}
                            >
                                {avgPaceStr}
                            </div>
                        </div>
                        {/* On Track */}
                        <div>
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, color: 'var(--color-fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
                            >
                                ON TRACK
                            </div>
                            <div
                                className="mono-data font-bold"
                                style={{
                                    fontSize: 18,
                                    color: weeklyKm >= (currentGoal?.weeklyTarget || 40) * 0.7
                                        ? 'var(--color-mint)'
                                        : 'var(--color-crimson)',
                                }}
                            >
                                {weeklyKm >= (currentGoal?.weeklyTarget || 40) * 0.7 ? 'YES' : 'NO'}
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button
                            onClick={() => setShowGoalEditor(true)}
                            style={{
                                background: 'var(--color-surface-2)',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-fg-muted)',
                                borderRadius: 10,
                                padding: '8px 16px',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            {currentGoal ? 'Edit goal' : 'Set goal'}
                        </button>
                        {currentGoal && (
                            <button
                                onClick={() => setShowCompleteConfirm(true)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-line)',
                                    color: 'var(--color-crimson)',
                                    borderRadius: 10,
                                    padding: '8px 16px',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                Mark complete
                            </button>
                        )}
                    </div>
                </div>

                {/* ── 3. Fitness snapshot ── */}
                <div>
                    <div
                        className="mono-data"
                        style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 12,
                        }}
                    >
                        FITNESS SNAPSHOT
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                        {/* VO₂ Max */}
                        <div
                            style={{
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                borderRadius: 14,
                                padding: 16,
                            }}
                        >
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-fg-dim)', marginBottom: 6 }}
                            >
                                VO₂ Max
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                    className="mono-data"
                                    style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-fg)' }}
                                >
                                    ~48
                                </span>
                                <span
                                    className="mono-data font-bold"
                                    style={{
                                        fontSize: 10,
                                        borderRadius: 999,
                                        padding: '2px 8px',
                                        background: 'color-mix(in oklch, var(--color-mint) 15%, transparent)',
                                        color: 'var(--color-mint)',
                                    }}
                                >
                                    +1.2
                                </span>
                            </div>
                        </div>

                        {/* Resting HR */}
                        <div
                            style={{
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                borderRadius: 14,
                                padding: 16,
                            }}
                        >
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-fg-dim)', marginBottom: 6 }}
                            >
                                Resting HR
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                    className="mono-data"
                                    style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-fg)' }}
                                >
                                    58 bpm
                                </span>
                                <span
                                    className="mono-data font-bold"
                                    style={{
                                        fontSize: 10,
                                        borderRadius: 999,
                                        padding: '2px 8px',
                                        background: 'color-mix(in oklch, var(--color-mint) 15%, transparent)',
                                        color: 'var(--color-mint)',
                                    }}
                                >
                                    -2
                                </span>
                            </div>
                        </div>

                        {/* 5k PR */}
                        <div
                            style={{
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                borderRadius: 14,
                                padding: 16,
                            }}
                        >
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-fg-dim)', marginBottom: 6 }}
                            >
                                5k PR
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                    className="mono-data"
                                    style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-fg)' }}
                                >
                                    {fiveKPrStr}
                                </span>
                                {fiveKPrStr !== '—' && (
                                    <span
                                        className="mono-data font-bold"
                                        style={{
                                            fontSize: 10,
                                            borderRadius: 999,
                                            padding: '2px 8px',
                                            background: 'color-mix(in oklch, var(--color-gold) 15%, transparent)',
                                            color: 'var(--color-gold)',
                                        }}
                                    >
                                        /km
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Weekly load */}
                        <div
                            style={{
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                borderRadius: 14,
                                padding: 16,
                            }}
                        >
                            <div
                                className="mono-data"
                                style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-fg-dim)', marginBottom: 6 }}
                            >
                                Weekly load
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                    className="mono-data"
                                    style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-fg)' }}
                                >
                                    {weeklyKm.toFixed(0)} km
                                </span>
                                <span
                                    className="mono-data font-bold"
                                    style={{
                                        fontSize: 10,
                                        borderRadius: 999,
                                        padding: '2px 8px',
                                        background: 'color-mix(in oklch, var(--color-ignite) 15%, transparent)',
                                        color: 'var(--color-ignite)',
                                    }}
                                >
                                    {goalPercentage}%
                                </span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── 4. Settings list ── */}
                <div>
                    <div
                        className="mono-data"
                        style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 12,
                        }}
                    >
                        SETTINGS
                    </div>
                    <div
                        style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            borderRadius: 14,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Notifications */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--color-line)',
                            }}
                        >
                            <span style={{ fontSize: 14, color: 'var(--color-fg)' }}>Notifications</span>
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    color: 'var(--color-fg-dim)',
                                }}
                            >
                                Coming soon <ChevronRight />
                            </span>
                        </div>

                        {/* Units */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--color-line)',
                            }}
                        >
                            <span style={{ fontSize: 14, color: 'var(--color-fg)' }}>Units</span>
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    color: 'var(--color-fg-dim)',
                                }}
                            >
                                Metric <ChevronRight />
                            </span>
                        </div>

                        {/* Strava sync */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--color-line)',
                            }}
                        >
                            <span style={{ fontSize: 14, color: 'var(--color-fg)' }}>Strava sync</span>
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    color: 'var(--color-mint)',
                                }}
                            >
                                Connected <ChevronRight />
                            </span>
                        </div>

                        {/* Sign out */}
                        <button
                            onClick={() => {
                                localStorage.removeItem('authToken');
                                localStorage.removeItem('trainingGoal');
                                window.location.hash = '#/login';
                                window.location.reload();
                            }}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-crimson)',
                                fontSize: 14,
                                textAlign: 'left',
                            }}
                        >
                            Sign out
                        </button>
                    </div>
                </div>

            </main>

            {/* Goal Editor Modal */}
            <GoalEditorModal
                isOpen={showGoalEditor}
                onClose={() => setShowGoalEditor(false)}
                existingGoal={currentGoal}
                onSave={handleSaveGoal}
            />

            {/* Plan Creating Loader */}
            <PlanCreatingLoader
                isVisible={creatingPlan}
                message="Your plan is now being created"
            />

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showCompleteConfirm}
                onClose={() => setShowCompleteConfirm(false)}
                onConfirm={executeCompleteGoal}
                title="Complete Goal?"
                message="Are you sure you want to mark this goal as completed? This will save it to your history and clear your current training plan to make way for a new one."
                confirmText="Yes, Complete it"
                isDangerous={false}
            />
        </div>
    );
};

export default ProfilePage;
