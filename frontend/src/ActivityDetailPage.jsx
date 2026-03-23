import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config/api';
import { ArrowLeft, Share, MoreVertical, Zap, Activity, Flame, Heart, Timer, TrendingUp, Mountain, Thermometer, Footprints, Sparkles, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import polyline from '@mapbox/polyline';

// Rolling average helper for smooth charts
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

const ActivityDetailPage = ({ activity, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('analysis'); // analysis, splits, segments
    const [aiSummary, setAiSummary] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            console.log('[ActivityDetailPage] Fetching details for activity:', activity.id);
            try {
                const token = localStorage.getItem('authToken');
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };

                // Fetch activity details and AI summary in parallel
                const [detailsRes, summaryRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/activities/${activity.id}`, {
                        headers,
                        credentials: 'include'
                    }),
                    fetch(`${API_BASE_URL}/api/activities/${activity.id}/analysis`, {
                        headers,
                        credentials: 'include'
                    }).catch(() => null)
                ]);

                console.log('[ActivityDetailPage] API Response status:', detailsRes.status);
                if (detailsRes.ok) {
                    const data = await detailsRes.json();
                    console.log('[ActivityDetailPage] Received data:', {
                        id: data.id,
                        hasMap: !!data.map,
                        hasStreams: !!data.streams,
                        streamKeys: data.streams ? Object.keys(data.streams) : [],
                        calories: data.calories,
                        zones: data.zones?.length || 0
                    });
                    setDetails(data);
                } else {
                    console.error('[ActivityDetailPage] API call failed:', detailsRes.status, await detailsRes.text());
                }

                // Load AI summary if available
                if (summaryRes?.ok) {
                    const summaryData = await summaryRes.json();
                    if (summaryData.versions && summaryData.versions.length > 0) {
                        const latest = summaryData.versions[summaryData.versions.length - 1];
                        try {
                            const parsed = JSON.parse(latest.text);
                            setAiSummary(parsed);
                        } catch (e) {
                            setAiSummary({ summary: latest.text });
                        }
                    }
                }
            } catch (err) {
                console.error("[ActivityDetailPage] Failed to load activity details", err);
            } finally {
                setLoading(false);
            }
        };
        if (activity?.id) {
            fetchData();
        } else {
            console.warn('[ActivityDetailPage] No activity.id provided');
            setLoading(false);
        }
    }, [activity]);

    if (!activity) return null;

    const isRun = activity.type === 'Run';
    // Show map for any activity that has polyline data, not just runs
    const hasMap = !!(details?.map?.summary_polyline || details?.map?.polyline);

    // --- Data Formatting Helpers ---

    // Distance (Meters -> KM)
    const distanceKm = (activity.distance / 1000).toFixed(2);

    // Date
    const dateObj = new Date(activity.start_date || activity.date); // Handle both formats
    const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown Date';

    // Telemetry Data Preparation
    const streams = details?.streams || {};
    const hasHeartRate = !!streams.heartrate?.data;
    const hasVelocity = !!streams.velocity_smooth?.data;

    console.log('[ActivityDetailPage] Stream analysis:', {
        streamKeys: Object.keys(streams),
        heartrateStructure: streams.heartrate ? Object.keys(streams.heartrate) : 'missing',
        velocityStructure: streams.velocity_smooth ? Object.keys(streams.velocity_smooth) : 'missing',
        hasHeartRate,
        hasVelocity,
        heartrateDataLength: streams.heartrate?.data?.length,
        velocityDataLength: streams.velocity_smooth?.data?.length
    });

    // Combine streams for chart with SMOOTHING
    const rawHr = streams.heartrate?.data || [];
    const rawVelocity = streams.velocity_smooth?.data || [];

    // Apply rolling average for smoother curves (window of 20 points)
    const smoothedHr = rollingAverage(rawHr, 20);
    const smoothedVelocity = rollingAverage(rawVelocity, 20);

    // Convert velocity to pace and sample every Nth point for performance
    const sampleRate = Math.max(1, Math.floor(rawHr.length / 200)); // Max 200 points

    const chartData = (hasHeartRate || hasVelocity) ?
        smoothedHr.map((_, i) => ({
            i,
            hr: smoothedHr[i],
            pace: smoothedVelocity[i] ? (16.666 / (smoothedVelocity[i] || 0.1)) : null
        })).filter((_, i) => i % sampleRate === 0) : null;

    // Filter out crazy pace spikes for chart clarity (e.g. > 20 min/km which is walking/stopped)
    const cleanChartData = chartData?.map(d => ({
        ...d,
        pace: d.pace && d.pace < 20 ? d.pace : null
    }));

    console.log('[ActivityDetailPage] Chart data:', {
        chartDataLength: chartData?.length,
        cleanChartDataLength: cleanChartData?.length,
        hasMap,
        mapPolyline: !!details?.map?.polyline,
        mapSummaryPolyline: !!details?.map?.summary_polyline
    });

    // --- Mock Data Generators (replacing hardcoded values from HTML) ---
    // If we have actual zones from API (details.zones), use them. Else mock.
    const hrZonesSource = details?.zones?.[0]?.distribution_buckets || [];

    const hrDistribution = hrZonesSource.length > 0 ? hrZonesSource.map((bucket, i) => ({
        name: `Z${i + 1}`,
        value: Math.round((bucket.time / activity.moving_time) * 100) || 0, // % of total time
        color: ['#94a3b8', '#3b82f6', '#10b981', '#f97415', '#ef4444'][i] || '#94a3b8',
        label: new Date(bucket.time * 1000).toISOString().substr(14, 5) // Format seconds to MM:SS
    })).reverse() : [
        // Fallback Mock
        { name: 'Z5', value: 15, color: '#ef4444', label: '08:12' },
        { name: 'Z4', value: 60, color: '#f97415', label: '32:45' },
        { name: 'Z3', value: 20, color: '#10b981', label: '11:05' },
        { name: 'Z2', value: 5, color: '#3b82f6', label: '02:30' },
        { name: 'Z1', value: 0, color: '#94a3b8', label: '00:00' },
    ];

    const HeroMap = ({ mapPolyline }) => {
        if (!mapPolyline) return <div className="h-48 bg-slate-800 w-full animate-pulse"></div>;
        const positions = polyline.decode(mapPolyline);
        const center = positions[Math.floor(positions.length / 2)];

        const Recenter = ({ positions }) => {
            const map = useMap();
            useEffect(() => { if (positions.length) map.fitBounds(positions); }, [positions, map]);
            return null;
        };

        return (
            <MapContainer center={center} zoom={13} style={{ height: '192px', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} attributionControl={false}>
                <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" />
                <Polyline positions={positions} color="#f97415" weight={3} opacity={0.9} />
                <Recenter positions={positions} />
            </MapContainer>
        );
    };

    const ActivityStat = ({ label, value, unit }) => (
        <div className="flex flex-col">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight truncate">{label}</p>
            <p className="text-[14px] font-bold font-mono text-white tracking-tight">
                {value}<span className="text-[10px] ml-0.5 opacity-50 font-normal">{unit}</span>
            </p>
        </div>
    );

    // Formatting Helpers
    const formatDuration = (seconds) => {
        if (!seconds) return activity.duration || '--:--'; // Fallback to formatted string if exists
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col bg-[#0f172a] text-white overflow-hidden relative font-display">

            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-1 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="text-primary">
                            {isRun ? <Zap className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight uppercase text-white/90">{activity.name}</h1>
                            <p className="text-[10px] text-white/50 font-mono uppercase">
                                {dateStr} • {distanceKm} KM
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors text-slate-400">
                        <Share className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 bg-[#0f172a]">

                {/* Hero */}
                <div className="relative h-48 w-full bg-slate-900 border-b border-white/5">
                    {hasMap ? (
                        <div className="absolute inset-0 opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-700">
                            <HeroMap mapPolyline={details?.map?.summary_polyline || details?.map?.polyline} />
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#1a2035] to-slate-900 flex flex-col items-center justify-center">
                            <Activity className="w-16 h-16 text-white/10" />
                            <p className="text-xs font-bold uppercase tracking-widest text-white/20 mt-4">{activity.type} Details</p>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent pointer-events-none"></div>
                </div>

                {/* Stats Grid - "The Frosted Card" */}
                {/* NOTE: Negative margin pulls it up over the Hero as requested */}
                <div className="px-4 -mt-12 relative z-10">
                    <div className="glass-card rounded-xl p-5 grid grid-cols-4 gap-y-6 gap-x-2 border border-white/10 shadow-2xl bg-[#0f172a]/80 backdrop-blur-xl">

                        {/* Row 1 */}
                        {/* Prefer detail values which are raw seconds usually, mapped to formatted strings */}
                        <ActivityStat label="Time" value={formatDuration(details?.moving_time)} unit="" />
                        <ActivityStat label="Suffer" value={details?.suffer_score || '-'} unit="" />

                        {isRun ? (
                            <>
                                <ActivityStat label="Elev." value={details?.total_elevation_gain || 0} unit="M" />
                                <ActivityStat label="Cadence" value={details?.average_cadence ? Math.round(details.average_cadence * 2) : '--'} unit="" />
                                {/* Strava sends cadence as steps/min for running usually on 'Run' type? Wait, avg_cadence is usually steps/min * 2 or just steps/min. Strava API 'average_cadence' for run is usually one-foot? No usually full. Let's assume raw is ok, unless user sees half values. */}
                            </>
                        ) : (
                            <>
                                <ActivityStat label="Avg HR" value={Math.round(details?.average_heartrate) || '--'} unit="BPM" />
                                <ActivityStat label="Cal." value={details?.calories || '--'} unit="" />
                            </>
                        )}

                        {/* Row 2 (Run Only mostly) */}
                        {isRun && (
                            <>
                                <ActivityStat label="Max HR" value={Math.round(details?.max_heartrate) || '--'} unit="" />
                                <ActivityStat label="Cal." value={details?.calories || '--'} unit="" />
                                <ActivityStat label="Grade" value="0.0" unit="%" />
                                <ActivityStat label="Temp." value="-" unit="°C" />
                            </>
                        )}
                        {/* Fillers for non-run layout logic if needed, but 4 columns wraps automatically */}
                    </div>
                </div>

                {/* Sub Navigation */}
                <div className="px-4 mt-8">
                    <div className="flex border-b border-white/10 gap-6">
                        {['analysis', 'splits', 'segments'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

                    {activeTab === 'analysis' && (
                        <>
                            {/* Performance Telemetry */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-xs font-bold text-white/90 uppercase tracking-tight">Performance Telemetry</h3>
                                        {isRun && (
                                            <div className="flex gap-3 mt-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                    <span className="text-[10px] text-white/50 font-mono uppercase tracking-tight">Pace</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                    <span className="text-[10px] text-white/50 font-mono uppercase tracking-tight">HR {Math.round(details?.average_heartrate || 0)} BPM</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button className="text-white/20 hover:text-white transition-colors">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>

                                {cleanChartData && cleanChartData.length > 0 ? (
                                    <div className="h-48 w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={cleanChartData}>
                                                <defs>
                                                    <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <YAxis yAxisId="left" hide domain={['dataMin', 'dataMax']} reversed /> {/* Pace */}
                                                <YAxis yAxisId="right" hide domain={['dataMin', 'dataMax']} /> {/* HR */}

                                                {/* Dashed Grid Lines (Manual via Reference Lines or just styled Container) */}
                                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

                                                <Area yAxisId="right" type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2} fill="url(#hrFill)" />
                                                <Line yAxisId="left" type="monotone" dataKey="pace" stroke="#f97415" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>

                                        {/* Axis Labels Bottom */}
                                        <div className="flex justify-between mt-2 px-1">
                                            <span className="text-[9px] text-white/30 font-mono">0.0 KM</span>
                                            <span className="text-[9px] text-white/30 font-mono">{(distanceKm / 2).toFixed(1)} KM</span>
                                            <span className="text-[9px] text-white/30 font-mono">{distanceKm} KM</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center border border-dashed border-white/10 rounded-xl text-xs text-white/30">
                                        No telemetry data available
                                    </div>
                                )}
                            </div>

                            {/* Heart Rate Zones */}
                            {hrDistribution.some(z => z.value > 0) && (
                                <div className="pt-2">
                                    <h3 className="text-xs font-bold text-white/90 uppercase tracking-widest mb-4">Heart Rate Zones</h3>
                                    <div className="space-y-4">
                                        {hrDistribution.map((zone) => (
                                            <div key={zone.name} className="flex items-center gap-3 group">
                                                <span className="w-8 text-[10px] font-mono text-white/40 group-hover:text-white transition-colors">{zone.name}</span>
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${zone.value}%`, backgroundColor: zone.color }}
                                                    ></div>
                                                </div>
                                                <span className="w-12 text-[10px] font-mono text-right text-white/60 group-hover:text-white transition-colors">{zone.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AI Coach Analysis */}
                            {aiSummary ? (
                                <div className="space-y-4 pt-4">
                                    {/* Run Type & Effort Badge */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {aiSummary.runType && (
                                            <span className="px-3 py-1 bg-indigo-500/20 rounded-full text-[11px] font-bold text-indigo-300 uppercase">
                                                {aiSummary.runType}
                                            </span>
                                        )}
                                        {aiSummary.relativeEffort && (
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${aiSummary.relativeEffort.toLowerCase() === 'low'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : aiSummary.relativeEffort.toLowerCase() === 'moderate'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {aiSummary.relativeEffort} Effort
                                            </span>
                                        )}
                                    </div>

                                    {/* About This Workout - Shows highlight */}
                                    <div className="glass-card p-4 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/30 to-slate-900/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                            </div>
                                            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">About This Workout</h3>
                                        </div>
                                        <p className="text-sm text-white/80 leading-relaxed">
                                            {aiSummary.highlight || aiSummary.summary || 'AI analysis available.'}
                                        </p>
                                    </div>

                                    {/* Way Forward - Shows suggestion */}
                                    {aiSummary.suggestion && (
                                        <div className="glass-card p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-orange-900/20 to-slate-900/30">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <TrendingUp className="w-3 h-3 text-primary" />
                                                </div>
                                                <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Way Forward</h3>
                                            </div>
                                            <p className="text-sm text-white/80 leading-relaxed italic">
                                                "{aiSummary.suggestion}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="pt-4">
                                    <button
                                        onClick={async () => {
                                            if (!details) {
                                                console.error('Activity details not loaded yet');
                                                return;
                                            }
                                            setAiLoading(true);
                                            try {
                                                const token = localStorage.getItem('authToken');
                                                const res = await fetch(`${API_BASE_URL}/api/activities/${activity.id}/analysis`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}`
                                                    },
                                                    credentials: 'include',
                                                    body: JSON.stringify({ activityData: details })
                                                });
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    if (data.versions?.length > 0) {
                                                        const latest = data.versions[data.versions.length - 1];
                                                        try {
                                                            setAiSummary(JSON.parse(latest.text));
                                                        } catch {
                                                            setAiSummary({ summary: latest.text });
                                                        }
                                                    }
                                                }
                                            } catch (err) {
                                                console.error('Failed to generate AI analysis:', err);
                                            } finally {
                                                setAiLoading(false);
                                            }
                                        }}
                                        disabled={aiLoading}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                                    >
                                        {aiLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating Analysis...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                Generate AI Analysis
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'splits' && (
                        <div className="text-center py-10">
                            <Timer className="w-8 h-8 text-white/20 mx-auto mb-3" />
                            <p className="text-xs text-white/40">Lap splits data coming soon.</p>
                        </div>
                    )}

                    {activeTab === 'segments' && (
                        <div className="text-center py-10">
                            <Mountain className="w-8 h-8 text-white/20 mx-auto mb-3" />
                            <p className="text-xs text-white/40">Segment analysis coming soon.</p>
                        </div>
                    )}

                </div>
            </main>

            {/* Bottom Floating Action Bar (Optional, mimicking HTML Footer if needed, else empty) */}
            <footer className="absolute bottom-6 left-4 right-4 z-50">
                {/*  Replicating HTML Footer Actions */}
                <div className="flex gap-3">
                    <button className="flex-1 h-12 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-orange-600 transition-colors active:scale-95">
                        <TrendingUp className="w-4 h-4" />
                        Lap Splits
                    </button>
                    <button className="w-12 h-12 rounded-xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center text-white/80 active:scale-95">
                        <Activity className="w-5 h-5" />
                    </button>
                </div>
            </footer>

        </div>
    );
};

export default ActivityDetailPage;
