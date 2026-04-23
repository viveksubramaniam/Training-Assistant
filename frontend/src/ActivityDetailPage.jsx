import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config/api';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import polyline from '@mapbox/polyline';

/* --------------------------------------------------------------
   Activity Detail · Striive v2
   Map hero · 6-stat grid · HR trace · Coach insight
   -------------------------------------------------------------- */

const rollingAverage = (data, windowSize = 15) => {
    if (!data || data.length === 0) return data;
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
        const window = data.slice(start, end).filter(v => v !== null && v !== undefined);
        result.push(window.length > 0 ? window.reduce((a, b) => a + b, 0) / window.length : null);
    }
    return result;
};

const Recenter = ({ positions }) => {
    const map = useMap();
    useEffect(() => { if (positions.length) map.fitBounds(positions, { padding: [18, 18] }); }, [positions, map]);
    return null;
};

const tagForType = (type, name = '') => {
    const t = `${type || ''} ${name || ''}`.toLowerCase();
    if (/threshold|tempo/.test(t)) return 'Threshold';
    if (/interval|vo2|sprint|hill/.test(t)) return 'Intervals';
    if (/long/.test(t)) return 'Long';
    if (/easy|recovery|shake/.test(t)) return 'Easy';
    if (/ride|cycle|bike/.test(t)) return 'Ride';
    if (/lift|strength|weight/.test(t)) return 'Strength';
    return (type || 'Session').toUpperCase();
};

const formatDuration = (seconds, fallback = '—') => {
    if (!seconds || seconds <= 0) return fallback;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const h = Math.floor(m / 60);
    const mm = (m % 60).toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const formatPaceFromSpeed = (speedMps) => {
    if (!speedMps || speedMps <= 0) return '—';
    const secPerKm = 1000 / speedMps;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

/* --------------------------------------------------------------
   HR Trace — inline SVG area chart
   -------------------------------------------------------------- */

const FALLBACK_HR_PATH = 'M0 45 L20 42 L40 30 L60 12 L80 30 L100 28 L115 10 L130 28 L145 26 L160 8 L175 26 L190 24 L205 6 L220 24 L240 34 L260 40 L280 42 L300 45';

const HRTrace = ({ data }) => {
    if (!data || data.length < 2) {
        return (
            <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none" style={{ marginTop: 8 }}>
                <path d={FALLBACK_HR_PATH} stroke="var(--color-crimson)" strokeWidth="1.5" fill="none"/>
                <path d={`${FALLBACK_HR_PATH} L300 60 L0 60 Z`} fill="var(--color-crimson)" opacity="0.15"/>
            </svg>
        );
    }

    const W = 300, H = 60;
    const clean = data.filter(v => v !== null && v !== undefined);
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = Math.max(1, max - min);

    const stepX = W / (data.length - 1);
    let d = '';
    data.forEach((v, i) => {
        const x = i * stepX;
        const y = v == null ? H : H - 4 - ((v - min) / span) * (H - 8);
        d += `${i === 0 ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
            <path d={d} stroke="var(--color-crimson)" strokeWidth="1.5" fill="none"/>
            <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="var(--color-crimson)" opacity="0.15"/>
        </svg>
    );
};

/* --------------------------------------------------------------
   Component
   -------------------------------------------------------------- */

const ActivityDetailPage = ({ activity, onClose, onAskCoach }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        if (!activity?.id) { setLoading(false); return; }
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
                const [detailsRes, summaryRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/activities/${activity.id}`, { headers, credentials: 'include' }),
                    fetch(`${API_BASE_URL}/api/activities/${activity.id}/analysis`, { headers, credentials: 'include' }).catch(() => null),
                ]);
                if (detailsRes.ok) setDetails(await detailsRes.json());
                if (summaryRes?.ok) {
                    const sData = await summaryRes.json();
                    if (sData.versions?.length > 0) {
                        const latest = sData.versions[sData.versions.length - 1];
                        try { setAiSummary(JSON.parse(latest.text)); }
                        catch { setAiSummary({ summary: latest.text }); }
                    }
                }
            } catch (err) {
                console.error('Activity detail load failed', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activity]);

    if (!activity) return null;

    /* ----- Derived values ----- */
    const hasPolyline = !!(details?.map?.summary_polyline || details?.map?.polyline);
    const polyEncoded = details?.map?.summary_polyline || details?.map?.polyline;
    const positions = hasPolyline ? polyline.decode(polyEncoded) : null;

    const distanceKm = activity.distance ? (activity.distance / 1000).toFixed(1) : '—';
    const movingStr = formatDuration(details?.moving_time || activity.moving_time);
    const avgPace = formatPaceFromSpeed(details?.average_speed || activity.average_speed);
    const avgHr = details?.average_heartrate || activity.average_heartrate;
    const maxHr = details?.max_heartrate;
    const elevation = details?.total_elevation_gain != null ? Math.round(details.total_elevation_gain) : '—';
    const calories = details?.calories || '—';

    const dateObj = new Date(activity.start_date || activity.date);
    const dateStr = !isNaN(dateObj)
        ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Unknown Date';

    const eyebrowLabel = tagForType(activity.type, activity.name);

    // HR trace sampled from streams
    const rawHr = details?.streams?.heartrate?.data || [];
    const smoothedHr = rollingAverage(rawHr, 20);
    const sampleRate = Math.max(1, Math.floor(smoothedHr.length / 120));
    const hrTrace = smoothedHr.filter((_, i) => i % sampleRate === 0);

    const coachHeadline = aiSummary?.highlight || aiSummary?.summary
        || "Review this session with your coach for insights on pacing and effort distribution.";

    const generateAnalysis = async () => {
        if (!details) return;
        setAiLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE_URL}/api/activities/${activity.id}/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ activityData: details }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.versions?.length > 0) {
                    const latest = data.versions[data.versions.length - 1];
                    try { setAiSummary(JSON.parse(latest.text)); }
                    catch { setAiSummary({ summary: latest.text }); }
                }
            }
        } catch (err) {
            console.error('AI analysis failed', err);
        } finally {
            setAiLoading(false);
        }
    };

    /* ----- Render ----- */

    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden font-display"
             style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-6">
                <button
                    onClick={onClose}
                    className="flex items-center justify-center"
                    style={{
                        width: 36, height: 36, borderRadius: 18,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        color: 'var(--color-fg-muted)',
                    }}
                    title="Back"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <div className="flex gap-2">
                    <button
                        className="flex items-center justify-center"
                        style={{
                            width: 36, height: 36, borderRadius: 18,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            color: 'var(--color-fg-muted)',
                        }}
                        title="Share"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v10M12 2l-4 4M12 2l4 4M4 14v6h16v-6"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Scroll body */}
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">
                {/* Eyebrow + title */}
                <div className="px-5 pt-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em]"
                         style={{ color: 'var(--color-ignite)' }}>
                        {eyebrowLabel} · {dateStr}
                    </div>
                    <div className="text-[22px] font-semibold tracking-[-0.02em] mt-1">{activity.name}</div>
                </div>

                {/* Map hero */}
                <div className="mx-5 mt-4 relative overflow-hidden"
                     style={{
                         height: 170,
                         borderRadius: 16,
                         border: '1px solid var(--color-line)',
                         background: 'radial-gradient(circle at 40% 30%, oklch(0.26 0.02 250) 0%, oklch(0.17 0.015 250) 70%)',
                     }}>
                    {hasPolyline && positions ? (
                        <MapContainer
                            center={positions[Math.floor(positions.length / 2)]}
                            zoom={13}
                            style={{ height: '100%', width: '100%', background: 'transparent' }}
                            zoomControl={false}
                            dragging={false}
                            scrollWheelZoom={false}
                            attributionControl={false}
                        >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"/>
                            <Polyline positions={positions} color="oklch(0.72 0.17 48)" weight={3} opacity={0.95}/>
                            <Polyline positions={positions} color="oklch(0.72 0.17 48)" weight={7} opacity={0.18}/>
                            <Recenter positions={positions}/>
                        </MapContainer>
                    ) : (
                        <svg width="100%" height="100%" viewBox="0 0 350 170" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
                            {[...Array(10)].map((_, i) => <line key={'h' + i} x1="0" y1={i * 20} x2="350" y2={i * 20} stroke="var(--color-line)"/>)}
                            {[...Array(18)].map((_, i) => <line key={'v' + i} x1={i * 20} y1="0" x2={i * 20} y2="170" stroke="var(--color-line)"/>)}
                            <path d="M30 130 Q 80 70 130 90 T 240 50 T 310 110 T 340 70" stroke="var(--color-ignite)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                            <path d="M30 130 Q 80 70 130 90 T 240 50 T 310 110 T 340 70" stroke="var(--color-ignite)" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.18"/>
                            <circle cx="30" cy="130" r="5" fill="var(--color-mint)" stroke="var(--color-bg)" strokeWidth="2"/>
                            <circle cx="340" cy="70" r="5" fill="var(--color-ignite)" stroke="var(--color-bg)" strokeWidth="2"/>
                        </svg>
                    )}
                    <div className="absolute bottom-[10px] left-3 mono-data text-[9px] uppercase pointer-events-none"
                         style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.05em' }}>
                        Route · {distanceKm} km
                    </div>
                </div>

                {/* 6 stat grid */}
                <div className="mx-5 mt-4 grid grid-cols-2 gap-2">
                    {[
                        { l: 'Distance',  v: distanceKm,  u: 'km' },
                        { l: 'Moving',    v: movingStr,   u: '' },
                        { l: 'Avg pace',  v: avgPace,     u: avgPace !== '—' ? '/km' : '' },
                        { l: 'Avg HR',    v: avgHr ? Math.round(avgHr) : '—', u: avgHr ? 'bpm' : '' },
                        { l: 'Elevation', v: elevation,   u: elevation !== '—' ? 'm' : '' },
                        { l: 'Calories',  v: calories,    u: calories !== '—' ? 'kcal' : '' },
                    ].map(s => (
                        <div key={s.l}
                             style={{
                                 padding: '12px 14px',
                                 background: 'var(--color-surface)',
                                 borderRadius: 12,
                                 border: '1px solid var(--color-line)',
                             }}>
                            <div className="text-[9px] font-semibold uppercase tracking-[0.08em]"
                                 style={{ color: 'var(--color-fg-dim)' }}>{s.l}</div>
                            <div className="mono-data text-[18px] font-medium mt-[3px] tracking-[-0.03em]">
                                {s.v}
                                {s.u && <span className="text-[10px] ml-1" style={{ color: 'var(--color-fg-dim)' }}>{s.u}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* HR card */}
                <div className="mx-5 mt-4 p-[14px]"
                     style={{
                         background: 'var(--color-surface)',
                         borderRadius: 12,
                         border: '1px solid var(--color-line)',
                     }}>
                    <div className="flex justify-between items-center">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                             style={{ color: 'var(--color-fg-dim)' }}>
                            Heart rate
                        </div>
                        {maxHr && (
                            <div className="mono-data text-[11px]" style={{ color: 'var(--color-crimson)' }}>
                                max {Math.round(maxHr)}
                            </div>
                        )}
                    </div>
                    <HRTrace data={hrTrace}/>
                </div>

                {/* Coach insight */}
                <div className="mx-5 mt-3 p-[14px]"
                     style={{
                         borderRadius: 12,
                         background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                         border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
                     }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em]"
                         style={{ color: 'var(--color-ignite)' }}>
                        Coach insight
                    </div>
                    <div className="mt-[6px] text-[13px] leading-[1.45]" style={{ color: 'var(--color-fg)' }}>
                        {aiSummary ? coachHeadline : (loading ? 'Analyzing this session…' : coachHeadline)}
                    </div>
                    {aiSummary?.suggestion && (
                        <div className="mt-[8px] text-[12px] italic leading-[1.45]"
                             style={{ color: 'var(--color-fg-muted)' }}>
                            "{aiSummary.suggestion}"
                        </div>
                    )}
                    <div className="flex gap-[8px] mt-[10px]">
                        <button
                            onClick={onAskCoach}
                            className="font-display font-semibold text-[12px]"
                            style={{
                                height: 32, padding: '0 12px', borderRadius: 8,
                                background: 'var(--color-ignite)',
                                color: '#fff', border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Ask coach →
                        </button>
                        {!aiSummary && !loading && (
                            <button
                                onClick={generateAnalysis}
                                disabled={aiLoading || !details}
                                className="font-display font-medium text-[12px] disabled:opacity-50"
                                style={{
                                    height: 32, padding: '0 12px', borderRadius: 8,
                                    background: 'transparent',
                                    border: '1px solid var(--color-line)',
                                    color: 'var(--color-fg-muted)',
                                }}
                            >
                                {aiLoading ? 'Analysing…' : 'Generate analysis'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityDetailPage;
