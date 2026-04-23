import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config/api';

/* --------------------------------------------------------------
   Plan · Grid variant
   Phase-colored month grid with session-type dots.
   One primary action: tap today to launch workout.
   -------------------------------------------------------------- */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* Session type → letter badge + color */
const categorize = (day) => {
    if (!day) return null;
    const txt = `${day.title || ''} ${day.activity_type || ''} ${day.type || ''} ${day.tag || ''}`.toLowerCase();
    const rest = /rest|off/.test(txt) || (!day.distance && day.distance !== 0);

    if (rest) return 'R';
    if (/interval|vo2|hill|sprint/.test(txt)) return 'I';
    if (/threshold|tempo/.test(txt))          return 'T';
    if (/long/.test(txt))                     return 'L';
    return 'E'; // default: easy
};

const LEGEND = [
    { k: 'E', label: 'Easy',      col: 'var(--color-mint)' },
    { k: 'T', label: 'Tempo',     col: 'var(--color-gold)' },
    { k: 'I', label: 'Intervals', col: 'var(--color-ignite)' },
    { k: 'L', label: 'Long',      col: 'var(--color-sky)' },
    { k: 'R', label: 'Rest',      col: 'var(--color-fg-faint)' },
];

const COL = Object.fromEntries(LEGEND.map(l => [l.k, l.col]));

/* -------------------------------------------------------------- */

const CalendarPage = ({ onOpenActivity }) => {
    const [masterPlan, setMasterPlan] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
    const hasTriggeredSync = useRef(false);

    useEffect(() => {
        let mounted = true;

        const fetchPlans = async (isPolling = false) => {
            try {
                const token = localStorage.getItem('authToken');
                const headers = { Authorization: `Bearer ${token}` };

                const masterRes = await fetch(`${API_BASE_URL}/api/coach/master-plan`, { headers });
                const masterData = await masterRes.json();

                if (masterData.error === 'No active goal') {
                    if (mounted) {
                        setMasterPlan({ error: 'No active goal' });
                        setLoading(false);
                    }
                    return;
                }
                if (mounted && masterData && !masterData.error) setMasterPlan(masterData);

                const weeklyRes = await fetch(`${API_BASE_URL}/api/coach/weekly-plan`, { headers });
                const weeklyData = await weeklyRes.json();

                if (!mounted) return;
                if (weeklyData.status !== 'generating') {
                    setWeeklyPlan(weeklyData);
                    setLoading(false);
                }

                const masterMissing = !masterData.weeks || masterData.weeks.length === 0;
                const weeklyMissing = weeklyData.status === 'generating';
                const needsSync = masterMissing || weeklyMissing;

                if (needsSync && !isPolling && !hasTriggeredSync.current) {
                    hasTriggeredSync.current = true;
                    await fetch(`${API_BASE_URL}/api/coach/sync`, { method: 'POST', headers });
                }
                if (weeklyMissing) setTimeout(() => mounted && fetchPlans(true), 3000);
            } catch (err) {
                console.error('Plan load failed', err);
                if (mounted) setLoading(false);
            }
        };

        fetchPlans();
        return () => { mounted = false; };
    }, []);

    /* ----- Build cells for the visible month ----- */
    const now = new Date();
    const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = viewDate.getDay(); // 0 = Sun

    // Map YYYY-MM-DD → day payload from weekly plan (only covers current week realistically)
    const dayMap = {};
    weeklyPlan?.days?.forEach(d => { if (d.date) dayMap[d.date.slice(0, 10)] = d; });

    // Rough master-plan weekly assignment so the whole month has hints
    const masterWeekFocus = {};
    if (masterPlan?.weeks) {
        masterPlan.weeks.forEach(w => {
            const focus = (w.focus || '').toLowerCase();
            const theme = (w.theme || '').toLowerCase();
            masterWeekFocus[w.week] = { focus, theme };
        });
    }

    const getCellLetter = (dateStr, date) => {
        const byMap = dayMap[dateStr];
        if (byMap) return categorize(byMap);

        // Weekly pattern hinted from master plan phase
        if (masterPlan?.weeks && masterPlan.startDate) {
            const start = new Date(masterPlan.startDate);
            const weekNum = Math.floor((date - start) / (7 * 864e5)) + 1;
            const info = masterWeekFocus[weekNum];
            if (info) {
                const dow = date.getDay(); // 0 Sun … 6 Sat
                // Default weekly pattern seeded by phase
                const pattern = info.theme.includes('taper')
                    ? ['R', 'E', 'T', 'E', 'R', 'E', 'L']
                    : info.theme.includes('peak') || info.focus.includes('interval')
                    ? ['R', 'E', 'I', 'E', 'R', 'T', 'L']
                    : info.theme.includes('build') || info.focus.includes('tempo')
                    ? ['R', 'E', 'T', 'E', 'R', 'E', 'L']
                    : ['R', 'E', 'E', 'T', 'R', 'E', 'L'];
                return pattern[dow];
            }
        }
        return null;
    };

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    /* ----- Phase & volume summary ----- */
    const currentWeekNum = masterPlan?.currentWeek || 1;
    const currentWeekData = masterPlan?.weeks?.find(w => w.week === currentWeekNum);
    const phase = currentWeekData?.phase || currentWeekData?.theme || 'Build Phase';

    const plannedDistance = weeklyPlan?.days?.reduce((acc, d) => acc + (d.distance || 0), 0) || 0;
    const doneDistance = weeklyPlan?.days?.reduce((acc, d) => acc + ((d.completed || d.status === 'done') ? (d.distance || 0) : 0), 0) || 0;
    const plannedSessions = weeklyPlan?.days?.filter(d => d.distance || d.activity_type).length || 0;
    const doneSessions = weeklyPlan?.days?.filter(d => d.completed || d.status === 'done').length || 0;

    /* ----- No-goal empty state ----- */
    if (masterPlan?.error === 'No active goal') {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 text-center page-rise">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                     style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-muted)" strokeWidth="1.8">
                        <path d="M4 22V4a2 2 0 012-2h12l-3 5 3 5H6" strokeLinejoin="round"/>
                    </svg>
                </div>
                <h2 className="text-[18px] font-semibold mb-2">No active goal</h2>
                <p className="text-[13px] leading-relaxed max-w-[260px] mb-8"
                   style={{ color: 'var(--color-fg-muted)' }}>
                    Set a training goal to generate your personalised plan.
                </p>
                <button
                    onClick={() => { window.location.hash = '#/profile'; }}
                    className="px-6 h-12 font-semibold text-[14px]"
                    style={{
                        borderRadius: 12,
                        background: 'var(--color-ignite)',
                        color: '#fff',
                        border: 'none',
                    }}
                >
                    Set goal
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="pulse-ring w-8 h-8 rounded-full"
                     style={{ border: '2px solid var(--color-ignite)' }}/>
            </div>
        );
    }

    /* ----- Highlighted next session card ----- */
    const todayStr = now.toISOString().slice(0, 10);
    const nextSession = weeklyPlan?.days?.find(d => d.date?.slice(0, 10) >= todayStr && (d.distance || d.activity_type));

    return (
        <div className="relative flex flex-col min-h-full pb-28 page-rise">
            {/* Header */}
            <div className="px-5 pt-7 flex justify-between items-baseline">
                <div>
                    <div className="text-[22px] font-semibold tracking-[-0.02em]">
                        {MONTHS[viewMonth]}
                    </div>
                    <div className="mono-data text-[11px] mt-[2px]"
                         style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.05em' }}>
                        {viewYear} · {phase.toUpperCase()}
                    </div>
                </div>
                <div className="flex gap-[6px]">
                    <button onClick={() => setMonthOffset(m => m - 1)}
                            className="flex items-center justify-center"
                            style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-fg-muted)',
                            }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button onClick={() => setMonthOffset(m => m + 1)}
                            className="flex items-center justify-center"
                            style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-fg-muted)',
                            }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Weekly stats strip */}
            <div className="mx-5 mt-4 px-4 py-3 flex gap-4"
                 style={{
                     background: 'var(--color-surface)',
                     border: '1px solid var(--color-line)',
                     borderRadius: 12,
                 }}>
                {[
                    { l: 'Planned', v: plannedDistance.toFixed(0), u: 'km', c: 'var(--color-fg)' },
                    { l: 'Done',    v: doneDistance.toFixed(0),    u: 'km', c: 'var(--color-ignite)' },
                    { l: 'Sessions', v: `${doneSessions}/${plannedSessions}`, u: '', c: 'var(--color-fg-muted)' },
                ].map((m, i) => (
                    <div key={m.l} className="flex-1"
                         style={{
                             borderLeft: i > 0 ? '1px solid var(--color-line)' : 'none',
                             paddingLeft: i > 0 ? 14 : 0,
                         }}>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.08em]"
                             style={{ color: 'var(--color-fg-dim)' }}>{m.l}</div>
                        <div className="mono-data text-[16px] font-medium mt-[2px]" style={{ color: m.c }}>
                            {m.v}<span className="text-[10px] ml-1" style={{ color: 'var(--color-fg-dim)' }}>{m.u}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Weekday headers */}
            <div className="mx-5 mt-5 grid grid-cols-7">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-semibold"
                         style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.08em' }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Month grid */}
            <div className="mx-5 mt-3 grid grid-cols-7 gap-[4px]">
                {cells.map((d, i) => {
                    if (d == null) return <div key={i}/>;

                    const cellDate = new Date(viewYear, viewMonth, d);
                    const dateStr = cellDate.toISOString().slice(0, 10);
                    const isToday = dateStr === todayStr;
                    const isPast = cellDate < now && !isToday;
                    const letter = getCellLetter(dateStr, cellDate);
                    const clickable = !!dayMap[dateStr];

                    return (
                        <div
                            key={i}
                            onClick={() => clickable && onOpenActivity && onOpenActivity(dayMap[dateStr].id || dateStr)}
                            className="relative flex flex-col justify-between"
                            style={{
                                aspectRatio: '1 / 1.1',
                                borderRadius: 8,
                                background: isToday ? 'var(--color-ignite)' : 'var(--color-surface)',
                                border: isToday ? 'none' : '1px solid var(--color-line)',
                                padding: 6,
                                cursor: clickable ? 'pointer' : 'default',
                            }}
                        >
                            <div className="mono-data text-[11px] font-medium"
                                 style={{
                                     color: isToday ? '#fff' : (isPast && !letter ? 'var(--color-fg-dim)' : 'var(--color-fg)'),
                                     opacity: isPast && !letter ? 0.5 : 1,
                                 }}>
                                {d}
                            </div>
                            {letter && (
                                <div
                                    className="self-start mono-data font-bold"
                                    style={{
                                        fontSize: 8,
                                        padding: '1px 4px',
                                        borderRadius: 3,
                                        background: isToday
                                            ? 'rgba(255,255,255,0.25)'
                                            : `color-mix(in oklch, ${COL[letter]} 18%, transparent)`,
                                        color: isToday ? '#fff' : COL[letter],
                                    }}
                                >
                                    {letter}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mx-5 mt-4 flex gap-3 flex-wrap">
                {LEGEND.map(l => (
                    <div key={l.k} className="flex items-center gap-[5px]">
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: l.col }}/>
                        <span className="text-[10px]" style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.02em' }}>
                            {l.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Next session pill */}
            {nextSession && (
                <div
                    onClick={() => onOpenActivity && onOpenActivity(nextSession.id || nextSession.date)}
                    className="mx-5 mt-5 p-[14px] relative cursor-pointer"
                    style={{
                        background: 'var(--color-surface)',
                        borderRadius: 12,
                        border: `1px solid var(--color-ignite)`,
                    }}
                >
                    <div
                        className="absolute top-0 left-0 bottom-0"
                        style={{
                            width: 3,
                            background: 'var(--color-ignite)',
                            borderRadius: '12px 0 0 12px',
                        }}
                    />
                    <div className="flex items-center justify-between pl-[6px]">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.1em]"
                                 style={{ color: 'var(--color-ignite)' }}>
                                {new Date(nextSession.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-[15px] font-semibold mt-[3px]">
                                {nextSession.title || nextSession.activity_type || 'Session'}
                                {nextSession.distance ? ` · ${nextSession.distance} km` : ''}
                            </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
