import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config/api';

/* --------------------------------------------------------------
   Home · Focus variant
   One hero: today's session. No stack of cards, no glass.
   -------------------------------------------------------------- */

const getTodayInfo = () => {
    const now = new Date();
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
        dayName: dayMap[now.getDay()],
        dayNumber: now.getDay() === 0 ? 7 : now.getDay(),
        date: now.getDate(),
        month: monthMap[now.getMonth()],
    };
};

const parseDurationMinutes = (d) => {
    if (!d) return null;
    if (typeof d === 'number') return d;
    const s = String(d).toLowerCase();
    const m = s.match(/(\d+)\s*m/);
    if (m) return parseInt(m[1], 10);
    const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
    if (h) return Math.round(parseFloat(h[1]) * 60);
    const pure = s.match(/^\s*(\d+)\s*$/);
    if (pure) return parseInt(pure[1], 10);
    return null;
};

/* Map workout titles to training zones for the effort profile bar */
const effortProfile = (title = '', targetPace = '') => {
    const t = (title + ' ' + targetPace).toLowerCase();
    if (t.includes('interval') || t.includes('threshold') || t.includes('tempo')) {
        // WU · Z3 · Z4 · Z5 · CD
        return [1.5, 3, 3, 0.8, 1.5];
    }
    if (t.includes('long')) return [1, 5, 2, 0, 1];
    if (t.includes('recovery') || t.includes('easy') || t.includes('shake')) return [1, 6, 0, 0, 1];
    if (t.includes('hill') || t.includes('sprint') || t.includes('vo2')) return [1, 2, 2, 3, 1];
    return [1, 4, 2, 0.5, 1];
};

const STEP_LABELS = ['WU', 'Z3', 'Z4', 'Z5', 'CD'];
const STEP_COLORS = [
    'var(--color-mint)',
    'var(--color-gold)',
    'var(--color-ignite)',
    'var(--color-crimson)',
    'var(--color-mint)',
];

/* --------------------------------------------------------------
   Component
   -------------------------------------------------------------- */

const DailyPlanTab = ({ user, activities = [], onNavigateToCalendar, onOpenCoach, onSelectAlternate }) => {
    const [loading, setLoading] = useState(true);
    const [recommended, setRecommended] = useState(null);
    const [alternates, setAlternates] = useState([]);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const hasTriggeredSync = useRef(false);

    const { dayName, dayNumber, date, month } = getTodayInfo();

    // Readiness / load / streak metrics (fall back gracefully when missing)
    const readiness = user?.readiness ?? user?.hrv_score ?? 82;
    const load = user?.load ?? user?.training_load ?? 6.4;
    const streak = user?.streak ?? 0;

    useEffect(() => {
        let mounted = true;
        let pollT;

        const handleData = (data) => {
            let rec = null, alts = [];

            if (data.recommended) {
                rec = data.recommended;
                alts = [data.option_2, data.option_3].filter(Boolean);
            } else if (data.dailyPlan) {
                const dp = data.dailyPlan;
                rec = dp.base || dp.threshold || dp.recovery;
                alts = [dp.recovery, dp.threshold].filter(x => x && x !== rec);
            } else if (Array.isArray(data)) {
                rec = data.find(x => x.recommended) || data[0];
                alts = data.filter(x => x !== rec).slice(0, 2);
            }

            setRecommended(rec);
            setAlternates(alts);
            setLoading(false);
        };

        const startProcess = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const headers = { Authorization: `Bearer ${token}` };

                const [dailyRes, weeklyRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/coach/daily-plan`, { headers }),
                    fetch(`${API_BASE_URL}/api/coach/weekly-plan`, { headers }),
                ]);
                const daily = await dailyRes.json();
                const weekly = await weeklyRes.json();

                if (daily.status === 'generating' || daily.status === 'syncing') {
                    if (!hasTriggeredSync.current) {
                        hasTriggeredSync.current = true;
                        await fetch(`${API_BASE_URL}/api/coach/sync`, { method: 'POST', headers });
                    }
                    pollData();
                } else {
                    if (!mounted) return;
                    handleData(daily);
                    if (weekly && !weekly.status) setWeeklyPlan(weekly);
                }
            } catch {
                pollData();
            }
        };

        const pollData = async () => {
            if (!mounted) return;
            try {
                const token = localStorage.getItem('authToken');
                const headers = { Authorization: `Bearer ${token}` };
                const [dailyRes, weeklyRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/coach/daily-plan`, { headers }),
                    fetch(`${API_BASE_URL}/api/coach/weekly-plan`, { headers }),
                ]);
                const daily = await dailyRes.json();
                const weekly = await weeklyRes.json();
                if (!mounted) return;
                if (daily.status === 'generating' || daily.status === 'syncing') {
                    pollT = setTimeout(pollData, 2000);
                    return;
                }
                handleData(daily);
                if (weekly && !weekly.status) setWeeklyPlan(weekly);
            } catch (e) {
                console.error('Poll failed', e);
            }
        };

        startProcess();
        return () => { mounted = false; if (pollT) clearTimeout(pollT); };
    }, []);

    const getUpcoming = () => {
        if (!weeklyPlan?.days) return [];
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        return weeklyPlan.days.filter(x => x.date > todayStr).slice(0, 4);
    };
    const upcoming = getUpcoming();

    /* ─────────── Render ─────────── */

    // Derived values for the hero card
    const title = recommended?.title || recommended?.type || (recommended?.activity_type) || 'Rest Day';
    const description = recommended?.description || 'Take the day. Low-stress recovery activity recommended.';
    const tag = recommended?.tag
        || (String(title).toLowerCase().includes('threshold') ? 'Threshold'
            : String(title).toLowerCase().includes('interval') ? 'Intervals'
            : String(title).toLowerCase().includes('tempo') ? 'Tempo'
            : String(title).toLowerCase().includes('long') ? 'Long'
            : String(title).toLowerCase().includes('recovery') ? 'Recovery'
            : 'Today');
    const distance = recommended?.distance || recommended?.distance_km || null;
    const durationMin = parseDurationMinutes(recommended?.duration);
    const avgPace = recommended?.targetPace || recommended?.target_pace || '—';
    const effort = effortProfile(title, avgPace);

    // Split the title for the dramatic 2-line hero typography
    const [titleLine1, titleLine2] = (() => {
        const words = String(title).split(' ');
        if (words.length <= 1) return [words[0] || title, ''];
        const mid = Math.ceil(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    })();

    return (
        <div className="relative flex flex-col min-h-full pb-28">
            {/* Header */}
            <div className="px-5 pt-7 flex items-center justify-between">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                         style={{ color: 'var(--color-fg-dim)' }}>
                        {dayName} · {month} {date}
                    </div>
                    <div className="text-[22px] font-semibold tracking-[-0.02em] mt-[2px]">
                        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},
                        {' '}
                        {user?.name?.split(' ')[0] || 'athlete'}
                    </div>
                </div>
                <button
                    className="flex items-center justify-center"
                    style={{
                        width: 36, height: 36, borderRadius: 18,
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-line)',
                        color: 'var(--color-fg-muted)',
                    }}
                    title="Notifications"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 17h5l-2-2V9a6 6 0 10-12 0v6l-2 2h5m6 0v1a3 3 0 01-6 0v-1"/>
                    </svg>
                </button>
            </div>

            {/* Readiness / Load / Streak strip */}
            <div className="mx-5 mt-5 grid grid-cols-3 gap-2">
                {[
                    { l: 'Readiness', v: String(readiness), u: '%', c: 'var(--color-mint)' },
                    { l: 'Load',      v: String(load),      u: '',  c: 'var(--color-ignite)' },
                    { l: 'Streak',    v: String(streak),    u: 'd', c: 'var(--color-fg)' },
                ].map(m => (
                    <div key={m.l}
                         style={{
                             background: 'var(--color-surface)',
                             border: '1px solid var(--color-line)',
                             borderRadius: 12,
                             padding: '10px 12px',
                         }}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                             style={{ color: 'var(--color-fg-dim)' }}>{m.l}</div>
                        <div className="mono-data flex items-baseline gap-[2px] mt-1">
                            <span className="text-[22px] font-semibold tracking-[-0.03em]"
                                  style={{ color: m.c }}>{m.v}</span>
                            <span className="text-[11px]" style={{ color: 'var(--color-fg-dim)' }}>{m.u}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hero session card */}
            {loading ? (
                <div
                    className="mx-5 mt-4 flex items-center justify-center"
                    style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        borderRadius: 22,
                        minHeight: 420,
                    }}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="pulse-ring w-8 h-8 rounded-full"
                             style={{ border: '2px solid var(--color-ignite)' }}/>
                        <p className="mono-data text-[11px] uppercase tracking-[0.18em]"
                           style={{ color: 'var(--color-fg-dim)' }}>
                            Building your plan
                        </p>
                    </div>
                </div>
            ) : (
                <div
                    className="mx-5 mt-4 relative overflow-hidden grain"
                    style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        borderRadius: 22,
                        padding: 24,
                    }}
                >
                    {/* corner glow */}
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute', top: -60, right: -60,
                            width: 200, height: 200, borderRadius: 100,
                            background: 'var(--color-ignite)',
                            opacity: 0.12, filter: 'blur(40px)',
                        }}
                    />

                    <div className="relative flex items-start justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em]"
                             style={{ color: 'var(--color-ignite)' }}>
                            Today's Session
                        </div>
                        <div
                            className="text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px]"
                            style={{
                                borderRadius: 4,
                                background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                                color: 'var(--color-ignite)',
                            }}
                        >
                            {tag}
                        </div>
                    </div>

                    <div className="relative mt-4 font-semibold tracking-[-0.04em] leading-[1.05] text-[34px]">
                        {titleLine1}{titleLine2 && <><br/>{titleLine2}</>}
                    </div>
                    <p className="relative mt-2 text-[14px] leading-[1.45] max-w-[280px]"
                       style={{ color: 'var(--color-fg-muted)' }}>
                        {description}
                    </p>

                    {/* Stats row */}
                    <div className="relative mt-5 pt-4 grid grid-cols-3"
                         style={{ borderTop: '1px solid var(--color-line)' }}>
                        {[
                            { l: 'Distance', v: distance ? String(distance) : '—', u: 'km' },
                            { l: 'Duration', v: durationMin ? String(durationMin) : '—', u: 'min' },
                            { l: 'Avg pace', v: avgPace, u: '/km' },
                        ].map((s, i) => (
                            <div key={s.l}
                                 style={{
                                     borderLeft: i > 0 ? '1px solid var(--color-line)' : 'none',
                                     paddingLeft: i > 0 ? 14 : 0,
                                 }}>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                                     style={{ color: 'var(--color-fg-dim)' }}>{s.l}</div>
                                <div className="mono-data text-[20px] font-medium mt-1 tracking-[-0.03em]">
                                    {s.v}
                                    <span className="text-[11px] ml-1" style={{ color: 'var(--color-fg-dim)' }}>{s.u}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Effort profile */}
                    <div className="relative mt-5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2"
                             style={{ color: 'var(--color-fg-dim)' }}>
                            Effort profile
                        </div>
                        <div className="flex gap-[2px] h-2 rounded overflow-hidden">
                            {effort.map((w, i) => w > 0 ? (
                                <div key={i} style={{ flex: w, background: STEP_COLORS[i] }}/>
                            ) : null)}
                        </div>
                        <div className="flex justify-between mt-[6px] mono-data text-[9px]"
                             style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.06em' }}>
                            {STEP_LABELS.map((s, i) => effort[i] > 0 ? <span key={i}>{s}</span> : <span key={i} style={{ opacity: 0 }}>{s}</span>)}
                        </div>
                    </div>

                    {/* Primary action */}
                    <button
                        onClick={onOpenCoach}
                        className="relative mt-6 w-full h-[54px] flex items-center justify-center gap-2 font-display text-[16px] font-semibold active:scale-[0.985] transition"
                        style={{
                            borderRadius: 14,
                            background: 'var(--color-ignite)',
                            color: '#fff',
                            border: 'none',
                            letterSpacing: '0.01em',
                            boxShadow: '0 14px 30px -10px color-mix(in oklch, var(--color-ignite) 60%, transparent)',
                        }}
                    >
                        Start workout
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 5l7 7-7 7"/>
                        </svg>
                    </button>

                    <div className="relative mt-[10px] flex gap-[10px]">
                        <button
                            className="flex-1 h-[42px] text-[13px] font-medium font-display transition"
                            style={{
                                borderRadius: 12,
                                background: 'transparent',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-fg-muted)',
                            }}
                        >
                            Mark as rest
                        </button>
                    </div>
                </div>
            )}

            {/* Alternate workouts (compact chips, not stacked cards) */}
            {alternates.length > 0 && (
                <div className="mx-5 mt-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-2"
                         style={{ color: 'var(--color-fg-dim)' }}>
                        Alternates
                    </div>
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                        {alternates.map((a, i) => (
                            <button
                                key={i}
                                onClick={() => onSelectAlternate && onSelectAlternate(a)}
                                className="shrink-0 text-left px-3 py-[10px] min-w-[180px] transition hover:border-[var(--color-ignite)]"
                                style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-line)',
                                    borderRadius: 12,
                                }}
                            >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                                     style={{ color: 'var(--color-fg-dim)' }}>
                                    {a.tag || a.type || 'Alt'}
                                </div>
                                <div className="text-[13px] font-semibold mt-1 leading-tight">
                                    {a.title || a.type || 'Workout'}
                                </div>
                                <div className="mono-data text-[11px] mt-[2px]"
                                     style={{ color: 'var(--color-fg-muted)' }}>
                                    {a.duration || '—'} · {a.targetPace || a.target_pace || a.intensity || ''}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Road ahead */}
            <div className="mx-5 mt-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                         style={{ color: 'var(--color-fg-dim)' }}>
                        Road ahead
                    </div>
                    <button onClick={onNavigateToCalendar}
                            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{ color: 'var(--color-ignite)' }}>
                        Full plan →
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 snap-x">
                    {upcoming.length === 0 ? (
                        <div className="w-full text-[11px] py-3 text-center"
                             style={{ color: 'var(--color-fg-dim)' }}>
                            No upcoming sessions this week
                        </div>
                    ) : upcoming.map((day, i) => (
                        <button
                            key={i}
                            onClick={onNavigateToCalendar}
                            className="shrink-0 snap-center text-left transition hover:border-[var(--color-ignite)] active:scale-[0.98]"
                            style={{
                                width: 148,
                                padding: 12,
                                borderRadius: 14,
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                borderLeft: `3px solid var(--color-ignite)`,
                            }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                                 style={{ color: 'var(--color-ignite)' }}>
                                {day.dayName || day.day_name || ''}
                            </div>
                            <div className="text-[13px] font-semibold mt-[6px] leading-tight line-clamp-2">
                                {day.title || day.activity_type || 'Rest'}
                            </div>
                            <div className="mono-data text-[10px] mt-[10px] pt-[8px]"
                                 style={{
                                     color: 'var(--color-fg-dim)',
                                     borderTop: '1px solid var(--color-line)',
                                 }}>
                                {day.distance ? `${day.distance} km` : 'Recovery'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DailyPlanTab;
