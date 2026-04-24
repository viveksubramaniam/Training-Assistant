import React, { useState, useEffect } from 'react';
import DailyPlanTab from './DailyPlanTab';
import CalendarPage from './CalendarPage';
import ProfilePage from './ProfilePage';
import ActivityDetailPage from './ActivityDetailPage';
import AlternateWorkoutModal from './components/AlternateWorkoutModal';
import ChatWidget from './components/ChatWidget';
import NutritionPage from './NutritionPage';
import { API_BASE_URL } from './config/api';

import StravaLoginButton from './components/LoginButton';

/* -------------------------------------------------------------------------- */
/*  Hash-based routing                                                        */
/*  #/home  #/plan  #/activity  #/activity/:id  #/coach  #/fuel  #/profile  #/login   */
/* -------------------------------------------------------------------------- */

const parseHash = () => {
    const h = window.location.hash || '#/home';
    const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
    const top = parts[0] || 'home';
    const sub = parts[1] || null;
    return { top, sub };
};

const go = (path) => { window.location.hash = path; };

const useRoute = () => {
    const [route, setRoute] = useState(parseHash());
    useEffect(() => {
        const sync = () => setRoute(parseHash());
        window.addEventListener('hashchange', sync);
        if (!window.location.hash) window.location.hash = '#/home';
        return () => window.removeEventListener('hashchange', sync);
    }, []);
    return route;
};

/* -------------------------------------------------------------------------- */
/*  Shared icons                                                              */
/* -------------------------------------------------------------------------- */

const I = {
    home:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>,
    plan:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
    stats:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20v-6M9 20V9M15 20v-3M21 20V4"/></svg>,
    profile: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>,
    coach:   (p, col = 'currentColor') => <svg {...p} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3.5-7.1M21 4v5h-5"/></svg>,
    run:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="17" cy="4" r="2"/><path d="M13 8l-2 4 3 2v6m-5-9l-2-1v-3l4-2 3 2 2 3 3 1"/></svg>,
    ride:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l3-7h6l3 7M13 5h3"/></svg>,
    lift:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6v12M18 6v12M6 12h12M3 9v6M21 9v6"/></svg>,
    search:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>,
    chevronR:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
    sync:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
};

/* -------------------------------------------------------------------------- */
/*  Editorial Login Screen                                                    */
/* -------------------------------------------------------------------------- */

const LoginScreen = () => {
    const [demoLoading, setDemoLoading] = useState(false);

    const handleDemoLogin = async () => {
        setDemoLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/strava/demo-login`, { method: 'POST' });
            if (res.ok) {
                const { token } = await res.json();
                localStorage.setItem('authToken', token);
                window.location.reload();
            } else {
                setDemoLoading(false);
            }
        } catch {
            setDemoLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center font-display"
             style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>
            <div className="relative flex flex-col w-full max-w-[450px] h-screen overflow-hidden px-7 pt-16 pb-8">
                {/* Ambient glow: ignite top-left, crimson bottom-right */}
                <div className="absolute pointer-events-none rounded-full" style={{
                    top: -80, left: -80, width: 280, height: 280,
                    background: 'var(--color-ignite)', opacity: 0.10, filter: 'blur(50px)',
                }}/>
                <div className="absolute pointer-events-none rounded-full" style={{
                    bottom: 120, right: -80, width: 220, height: 220,
                    background: 'var(--color-crimson)', opacity: 0.08, filter: 'blur(50px)',
                }}/>

                {/* Striive mark */}
                <div className="relative">
                    <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="14" stroke="var(--color-fg)" strokeWidth="1.2"/>
                        <circle cx="11" cy="21" r="4" fill="var(--color-ignite)"/>
                    </svg>
                </div>

                {/* Headline */}
                <div className="relative mt-28">
                    <h1 className="font-display font-semibold text-[44px] leading-none tracking-[-0.04em]">
                        Train with<br/>intent.
                    </h1>
                    <p className="mt-4 text-[14px] leading-[1.5] max-w-[280px]"
                       style={{ color: 'var(--color-fg-muted)' }}>
                        An adaptive coach that rewrites your week around how you actually feel.
                    </p>
                </div>

                <div className="flex-1"/>

                {/* Auth actions */}
                <div className="relative flex flex-col gap-3 items-stretch">
                    <div className="flex justify-center">
                        <StravaLoginButton onLogin={() => window.location.href = `${API_BASE_URL}/api/auth/strava/login`} />
                    </div>

                    <button
                        onClick={handleDemoLogin}
                        disabled={demoLoading}
                        className="h-12 rounded-[14px] text-[13px] font-medium font-display transition disabled:opacity-50"
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--color-line)',
                            color: 'var(--color-fg-muted)',
                        }}
                    >
                        {demoLoading ? 'Loading demo…' : 'Try demo account'}
                    </button>

                    <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em]"
                         style={{ color: 'var(--color-fg-faint)' }}>
                        Version 2.0.1
                    </div>
                </div>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*  Bottom Nav                                                                */
/* -------------------------------------------------------------------------- */

const BottomNav = ({ active }) => {
    const items = [
        { id: 'home',    to: '#/home',     label: 'Today',    icon: I.home },
        { id: 'stats',   to: '#/activity', label: 'Activity', icon: I.stats },
        { id: 'coach',   to: '#/coach',    label: 'Coach',    icon: I.coach, center: true },
        { id: 'fuel',    to: '#/fuel',     label: 'Fuel',     icon: I.plan },
        { id: 'profile', to: '#/profile',  label: 'You',      icon: I.profile },
    ];

    return (
        <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[450px] z-40"
            style={{
                paddingBottom: 18,
                background: `linear-gradient(180deg, transparent 0%, var(--color-bg) 45%)`,
            }}
        >
            <div
                className="mx-4 h-16 grid grid-cols-5 items-center"
                style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 20,
                }}
            >
                {items.map(it => {
                    const isAct = active === it.id;
                    const col = isAct ? 'var(--color-ignite)' : 'var(--color-fg-dim)';

                    if (it.center) {
                        return (
                            <div key={it.id} className="flex justify-center">
                                <button
                                    onClick={() => go(it.to)}
                                    className="flex items-center justify-center transition-transform active:scale-95"
                                    style={{
                                        width: 40, height: 40, borderRadius: 20,
                                        background: isAct ? 'var(--color-ignite)' : 'var(--color-surface-2)',
                                        border: isAct ? 'none' : '1px solid var(--color-line)',
                                        boxShadow: isAct ? '0 8px 20px -4px rgba(240,120,30,0.25)' : 'none',
                                        transform: 'translateY(-10px)',
                                        color: isAct ? '#fff' : 'var(--color-fg)',
                                    }}
                                    title="Ask coach"
                                >
                                    {I.coach({ width: 18, height: 18 }, 'currentColor')}
                                </button>
                            </div>
                        );
                    }

                    return (
                        <button
                            key={it.id}
                            onClick={() => go(it.to)}
                            className="flex flex-col items-center gap-[3px] font-display"
                            style={{
                                color: col,
                                fontSize: 10,
                                fontWeight: 500,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {it.icon({ width: 20, height: 20 })}
                            <span>{it.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*  Activity list page                                                        */
/* -------------------------------------------------------------------------- */

const ActivityTypeIcon = ({ type }) => {
    const t = (type || '').toLowerCase();
    const isRun = t.includes('run');
    const isRide = t.includes('ride') || t.includes('bike') || t.includes('cycl');
    const isLift = t.includes('weight') || t.includes('strength') || t.includes('lift');

    const col = isRun ? 'var(--color-ignite)'
        : isRide ? 'var(--color-sky)'
        : isLift ? 'var(--color-gold)'
        : 'var(--color-fg-muted)';
    const bg = isRun ? 'color-mix(in oklch, var(--color-ignite) 14%, transparent)'
        : isRide ? 'color-mix(in oklch, var(--color-sky) 14%, transparent)'
        : isLift ? 'color-mix(in oklch, var(--color-gold) 14%, transparent)'
        : 'var(--color-surface-2)';

    const Icon = isRide ? I.ride : isLift ? I.lift : I.run;

    return (
        <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: 10, background: bg, color: col }}
        >
            {Icon({ width: 16, height: 16 })}
        </div>
    );
};

const ActivityListPage = ({ activities, isDemo, onSync, syncing, onOpen }) => {
    const types = ['All', ...Array.from(new Set(activities.map(a => a.type).filter(Boolean)))];
    const [filter, setFilter] = useState('All');
    const list = filter === 'All' ? activities : activities.filter(a => a.type === filter);

    // Aggregate stats for the summary card
    const totalKm = (list.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000).toFixed(1);
    const totalSeconds = list.reduce((sum, a) => sum + (a.moving_time || a.elapsed_time || 0), 0);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const totalTime = `${h}:${m}`;

    // 30-day sparkline bars — bucket activities into last 30 days by distance
    const today = new Date();
    const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
    });
    const byDay = {};
    activities.forEach(a => {
        const d = (a.start_date || a.date || '').slice(0, 10);
        if (d) byDay[d] = (byDay[d] || 0) + (a.distance || 0) / 1000;
    });
    const maxBar = Math.max(1, ...days.map(d => byDay[d] || 0));

    return (
        <div className="relative h-full flex flex-col pb-28 page-rise">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6">
                <div>
                    <div className="text-[22px] font-semibold tracking-[-0.02em]">Activity</div>
                    <div className="mono-data text-[11px] mt-[2px]" style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.05em' }}>
                        LAST 30 DAYS
                    </div>
                </div>
                {!isDemo && (
                    <button
                        onClick={onSync}
                        disabled={syncing}
                        className="flex items-center justify-center transition"
                        style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            color: 'var(--color-fg-muted)',
                        }}
                        title="Sync"
                    >
                        {I.sync({ width: 14, height: 14, className: syncing ? 'animate-spin-slow' : '' })}
                    </button>
                )}
            </div>

            {/* Summary + 30-day bars */}
            <div
                className="mx-5 mt-4 p-4"
                style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 16,
                }}
            >
                <div className="flex gap-4">
                    {[
                        { l: 'Distance', v: totalKm, u: 'km' },
                        { l: 'Time', v: totalTime, u: 'h' },
                        { l: 'Sessions', v: String(list.length), u: '' },
                    ].map((s, i) => (
                        <div key={s.l} className="flex-1"
                             style={{
                                 borderLeft: i > 0 ? '1px solid var(--color-line)' : 'none',
                                 paddingLeft: i > 0 ? 14 : 0,
                             }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                                 style={{ color: 'var(--color-fg-dim)' }}>
                                {s.l}
                            </div>
                            <div className="mono-data text-[20px] font-medium mt-1 tracking-[-0.03em]">
                                {s.v}
                                <span className="text-[10px] ml-1" style={{ color: 'var(--color-fg-dim)' }}>{s.u}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex items-end gap-[2px] h-10">
                    {days.map((d, i) => {
                        const v = byDay[d] || 0;
                        const h = v === 0 ? 4 : Math.max(8, (v / maxBar) * 40);
                        const col = v === 0
                            ? 'var(--color-fg-faint)'
                            : v > maxBar * 0.7 ? 'var(--color-ignite)' : 'var(--color-mint)';
                        return (
                            <div key={i} className="flex-1"
                                 style={{
                                     height: `${h}px`,
                                     background: col,
                                     opacity: v === 0 ? 0.25 : 0.85,
                                     borderRadius: 1,
                                 }}/>
                        );
                    })}
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-[6px] px-5 pt-4 overflow-x-auto hide-scrollbar">
                {types.map(t => {
                    const active = filter === t;
                    return (
                        <button key={t} onClick={() => setFilter(t)}
                                className="px-3 py-[6px] whitespace-nowrap text-[12px] font-medium"
                                style={{
                                    borderRadius: 16,
                                    background: active ? 'var(--color-fg)' : 'var(--color-surface)',
                                    color: active ? 'var(--color-bg)' : 'var(--color-fg-muted)',
                                    border: active ? 'none' : '1px solid var(--color-line)',
                                }}>
                            {t}
                        </button>
                    );
                })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pt-3">
                {list.length === 0 && (
                    <div className="text-center py-10 text-[12px]" style={{ color: 'var(--color-fg-dim)' }}>
                        No activities yet. {isDemo ? '' : 'Hit sync to pull from Strava.'}
                    </div>
                )}
                {list.map((a, i) => {
                    const dateStr = a.start_date || a.date;
                    const displayDate = dateStr
                        ? new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                        : '—';
                    const km = a.distance ? (a.distance / 1000).toFixed(1) : '—';
                    const avgSpeed = a.average_speed || 0;
                    const pace = avgSpeed > 0
                        ? `${Math.floor(16.6667 / avgSpeed)}:${Math.round((16.6667 / avgSpeed % 1) * 60).toString().padStart(2, '0')}`
                        : '—';
                    const hr = a.average_heartrate ? Math.round(a.average_heartrate) : null;
                    const hrHigh = hr && hr > 160;

                    return (
                        <div key={a.id} onClick={() => onOpen(a)}
                             className="flex items-center gap-3 py-[14px] cursor-pointer"
                             style={{ borderBottom: i < list.length - 1 ? '1px solid var(--color-line)' : 'none' }}>
                            <ActivityTypeIcon type={a.type}/>
                            <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-semibold tracking-[-0.01em] truncate">{a.name}</div>
                                <div className="mono-data text-[11px] mt-[3px] flex gap-2"
                                     style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.03em' }}>
                                    <span>{displayDate}</span><span>·</span>
                                    <span>{km} km</span><span>·</span>
                                    <span>{pace !== '—' ? `${pace}/km` : pace}</span>
                                </div>
                            </div>
                            {hr && (
                                <div className="text-right">
                                    <div className="mono-data text-[13px]"
                                         style={{ color: hrHigh ? 'var(--color-crimson)' : 'var(--color-fg-muted)' }}>
                                        {hr}
                                    </div>
                                    <div className="text-[9px] tracking-[0.06em]" style={{ color: 'var(--color-fg-dim)' }}>bpm</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*  Main App                                                                  */
/* -------------------------------------------------------------------------- */

const App = () => {
    const { top: routeTop, sub: routeSub } = useRoute();

    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedAlternate, setSelectedAlternate] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [planVersion, setPlanVersion] = useState(0);

    /* Fetch initial data */
    useEffect(() => {
        const fetchInitialData = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const tokenFromUrl = urlParams.get('token');

            if (tokenFromUrl) {
                localStorage.setItem('authToken', tokenFromUrl);
                window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
            }

            const token = localStorage.getItem('authToken');
            if (!token) { setLoading(false); return; }

            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [userRes, activitiesRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/user`, { headers }),
                    fetch(`${API_BASE_URL}/api/activities`, { headers }),
                ]);

                if (userRes.ok) {
                    setUser(await userRes.json());
                } else {
                    localStorage.removeItem('authToken');
                    setUser(null);
                }
                if (activitiesRes.ok) setActivities(await activitiesRes.json());
            } catch (err) {
                console.error('Failed to load initial data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    /* Sync currently-selected activity with hash (e.g. #/activity/123) */
    useEffect(() => {
        if (routeTop === 'activity' && routeSub) {
            const match = activities.find(a => String(a.id) === String(routeSub));
            if (match) setSelectedActivity(match);
        } else if (selectedActivity && !(routeTop === 'activity' && routeSub)) {
            setSelectedActivity(null);
        }
    }, [routeTop, routeSub, activities, selectedActivity]);

    const isDemo = user?.isDemo || false;

    const handleSync = async () => {
        if (isDemo) return;
        setSyncing(true);
        const token = localStorage.getItem('authToken');
        if (!token) { setSyncing(false); return; }

        try {
            const res = await fetch(`${API_BASE_URL}/api/activities/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ fullSync: false }),
            });
            if (res.ok) {
                const [actRes, userRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/activities`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } }),
                ]);
                if (actRes.ok) setActivities(await actRes.json());
                if (userRes.ok) setUser(await userRes.json());
            } else if (res.status === 401) {
                localStorage.removeItem('authToken');
                setUser(null);
            }
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setSyncing(false);
        }
    };

    /* ----------- States ----------- */

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center"
                 style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="pulse-ring w-10 h-10 rounded-full"
                         style={{ border: '2px solid var(--color-ignite)' }}/>
                    <p className="text-[11px] uppercase tracking-[0.2em] mono-data"
                       style={{ color: 'var(--color-fg-dim)' }}>
                        Initializing coach
                    </p>
                </div>
            </div>
        );
    }

    if (!user || user.name === 'Guest') return <LoginScreen/>;

    /* ----------- Determine active nav tab from route ----------- */
    const activeTab =
        routeTop === 'home' ? 'home'
        : routeTop === 'activity' ? 'stats'
        : routeTop === 'coach' ? 'coach'
        : routeTop === 'fuel' ? 'fuel'
        : routeTop === 'profile' ? 'profile'
        : 'home';

    /* ----------- Which page to render ----------- */
    let pageKey, pageNode;
    if (routeTop === 'home') {
        pageKey = 'home';
        pageNode = (
            <DailyPlanTab
                key={planVersion}
                user={user}
                activities={activities}
                onNavigateToCalendar={() => go('#/plan')}
                onOpenCoach={() => go('#/coach')}
                onSelectAlternate={(alternate) => setSelectedAlternate(alternate)}
                onStartWorkout={() => {/* hook into logging later */}}
            />
        );
    } else if (routeTop === 'plan') {
        pageKey = 'plan';
        pageNode = <CalendarPage user={user} onOpenActivity={(id) => go('#/activity/' + id)}/>;
    } else if (routeTop === 'profile') {
        pageKey = 'profile';
        pageNode = <ProfilePage user={user} activities={activities} onSignOut={() => {
            localStorage.removeItem('authToken');
            setUser(null);
            go('#/login');
        }}/>;
    } else if (routeTop === 'coach') {
        pageKey = 'coach';
        pageNode = (
            <ChatWidget
                isOpen={true}
                onClose={() => go('#/home')}
                onPlanUpdate={() => {
                    setPlanVersion(v => v + 1);
                    const token = localStorage.getItem('authToken');
                    if (token) {
                        fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } })
                            .then(r => r.ok ? r.json() : null)
                            .then(data => { if (data) setUser(data); });
                    }
                }}
                onGoalChanged={() => {
                    setPlanVersion(v => v + 1);
                    const token = localStorage.getItem('authToken');
                    if (token) {
                        Promise.all([
                            fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } }),
                            fetch(`${API_BASE_URL}/api/activities`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        ]).then(async ([uRes, aRes]) => {
                            if (uRes.ok) setUser(await uRes.json());
                            if (aRes.ok) setActivities(await aRes.json());
                        });
                    }
                }}
            />
        );
    } else if (routeTop === 'fuel') {
        pageKey = 'fuel';
        pageNode = <NutritionPage user={user} />;
    } else {
        pageKey = 'activity';
        pageNode = (
            <ActivityListPage
                activities={activities}
                isDemo={isDemo}
                onSync={handleSync}
                syncing={syncing}
                onOpen={(a) => go('#/activity/' + a.id)}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen w-full max-w-[450px] mx-auto relative overflow-hidden font-display"
             style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>

            {/* Main content */}
            <div key={pageKey} className="flex-1 overflow-hidden relative page-rise">
                <div className="h-full overflow-y-auto hide-scrollbar">
                    {pageNode}
                </div>
            </div>

            {/* Activity detail overlay */}
            {selectedActivity && (
                <div className="absolute inset-0 z-50 page-rise"
                     style={{ background: 'var(--color-bg)' }}>
                    <ActivityDetailPage
                        activity={selectedActivity}
                        onClose={() => {
                            setSelectedActivity(null);
                            if (window.history.length > 1) window.history.back();
                            else go('#/activity');
                        }}
                        onAskCoach={() => go('#/coach')}
                    />
                </div>
            )}

            {/* Alternate workout overlay */}
            {selectedAlternate && (
                <div className="absolute inset-0 z-50 page-rise"
                     style={{ background: 'var(--color-bg)' }}>
                    <AlternateWorkoutModal
                        workout={selectedAlternate}
                        onClose={() => setSelectedAlternate(null)}
                        onSwap={async () => {
                            try {
                                const token = localStorage.getItem('authToken');
                                if (!token) {
                                    console.error('No auth token found');
                                    return;
                                }

                                const workoutTitle = selectedAlternate.title || selectedAlternate.type || 'alternate workout';

                                // Call the dedicated swap-workout endpoint
                                const response = await fetch(`${API_BASE_URL}/api/coach/swap-workout`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        alternateTitle: workoutTitle
                                    })
                                });

                                if (response.ok) {
                                    const data = await response.json();
                                    console.log('Swap successful:', data);

                                    // Close modal and refresh plans
                                    setSelectedAlternate(null);

                                    // Refresh the plan version to trigger re-render
                                    setPlanVersion(v => v + 1);

                                    // Fetch updated user data
                                    const userRes = await fetch(`${API_BASE_URL}/api/user`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (userRes.ok) {
                                        setUser(await userRes.json());
                                    }
                                } else {
                                    const error = await response.json();
                                    console.error('Swap failed:', error);
                                    alert('Failed to swap workout. Please try again.');
                                }
                            } catch (error) {
                                console.error('Swap error:', error);
                                alert('Error swapping workout. Please try again.');
                            }
                        }}
                    />
                </div>
            )}

            {/* Bottom nav */}
            <BottomNav active={activeTab} />
        </div>
    );
};

export default App;
export { go, useRoute };
