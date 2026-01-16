import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, TrendingUp, Activity, Flame, Target, Clock, Zap, Heart, Monitor, RotateCcw } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import polyline from '@mapbox/polyline';

const ActivityDetailPage = ({ activity, onBack, details, analyzing, loadingDetails, handleAnalyze, aiAnalysis }) => {

    // Check if activity has map data
    const hasMap = !!(details?.map?.summary_polyline || details?.map?.polyline);

    // --- Shared Components ---

    const HRZoneGradient = ({ avgHeartRate, maxHeartRate = 200 }) => {
        // Calculate position percentage (clamped 0-100)
        // Assuming rest HR ~40, Max ~200 for generic scaling if max not provided
        // Or strictly relative to typical zones: Z1(100)-Z5(180+)
        const minHR = 60;
        const maxHR = 200;
        const percentage = Math.min(100, Math.max(0, ((avgHeartRate - minHR) / (maxHR - minHR)) * 100));

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Heart Rate Intensity</p>
                    <p className="text-xs font-mono font-bold text-rose-400">{avgHeartRate} BPM Avg</p>
                </div>
                <div className="relative h-6 w-full rounded-full mt-2">
                    {/* Gradient Bar */}
                    <div className="absolute inset-0 rounded-full opacity-90"
                        style={{
                            background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 30%, #facc15 60%, #f97316 80%, #ef4444 100%)'
                        }}
                    ></div>

                    {/* Pointer */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 transition-all duration-1000"
                        style={{ left: `${percentage}%` }}
                    >
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
                    </div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                    <span>Easy</span>
                    <span>Mod</span>
                    <span>Hard</span>
                    <span>Max</span>
                </div>
            </div>
        );
    };

    const AIInsightsSection = () => (
        <div className="space-y-6">
            {aiAnalysis ? (
                <>
                    <div className={`glass-card rounded-xl p-6 border-l-4 border-l-[#f97415] mb-6 flex flex-col transition-all duration-300 ${analyzing ? 'opacity-60' : 'opacity-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-[#f97415]">
                                <Flame className={`w-6 h-6 ${analyzing ? 'animate-pulse' : ''}`} />
                                <h4 className="font-bold text-lg">{analyzing ? 'Regenerating Analysis...' : 'About this workout'}</h4>
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm('Regenerate AI summary?')) {
                                        try {
                                            await fetch(`/api/activities/${activity.id}/analysis`, {
                                                method: 'DELETE',
                                                credentials: 'include'
                                            });
                                            handleAnalyze();
                                        } catch (err) {
                                            console.error('Failed:', err);
                                        }
                                    }
                                }}
                                disabled={analyzing}
                                className="p-2 hover:bg-[#f97415]/20 rounded-lg transition-colors text-[#f97415] disabled:cursor-not-allowed"
                                title="Regenerate AI Summary"
                            >
                                <RotateCcw className={`w-5 h-5 ${analyzing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                {analyzing ? 'AI is analyzing your workout data using advanced metrics...' : (aiAnalysis.summary || 'Detailed performance analysis is available below.')}
                            </p>
                        </div>
                    </div>

                    {aiAnalysis.way_forward && (
                        <div className="glass-card rounded-xl p-6 border-l-4 border-l-emerald-500 flex flex-col">
                            <div className="flex items-center gap-2 text-emerald-500 mb-4">
                                <TrendingUp className="w-6 h-6" />
                                <h4 className="font-bold text-lg">Way Forward</h4>
                            </div>
                            <div className="flex-1">
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                    {aiAnalysis.way_forward}
                                </p>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="glass-card rounded-xl p-6 text-center">
                    <Flame className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400 mb-4">Get AI-powered coaching insights</p>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing || loadingDetails}
                        className="bg-[#f97415] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#ea580c] transition-colors disabled:opacity-50 relative z-10 cursor-pointer"
                    >
                        {analyzing ? 'Analyzing...' : loadingDetails ? 'Loading Data...' : 'Analyze Activity'}
                    </button>
                </div>
            )}
        </div>
    );

    // --- Non-Map Layout Components ---

    const NonMapStatsGrid = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-white/10 rounded-xl overflow-hidden bg-slate-800/40 mb-8">
            <div className="p-6 border-r border-b md:border-b-0 border-white/10 flex flex-col items-center text-center">
                <Clock className="text-[#f97415] mb-2 w-6 h-6" />
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Total Duration</p>
                <p className="text-3xl font-bold font-mono text-white">{activity.duration}</p>
            </div>
            <div className="p-6 border-r border-b md:border-b-0 border-white/10 flex flex-col items-center text-center">
                <Heart className="text-rose-500 mb-2 w-6 h-6 fill-current" />
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Average HR</p>
                <p className="text-3xl font-bold font-mono text-white">{activity.heartRate || '-'} <span className="text-sm font-normal text-slate-500">bpm</span></p>
            </div>
            <div className="p-6 border-r border-white/10 flex flex-col items-center text-center">
                <Flame className="text-emerald-500 mb-2 w-6 h-6" />
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Calories Burned</p>
                <p className="text-3xl font-bold font-mono text-white">
                    {details?.calories || activity.raw?.calories || (details?.kilojoules ? Math.round(details.kilojoules / 4.184) : '-')}
                    <span className="text-sm font-normal text-slate-500 ml-1">kcal</span>
                </p>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
                <Activity className="text-[#f97415] mb-2 w-6 h-6" />
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Training Load</p>
                <p className="text-3xl font-bold font-mono text-white">{activity.raw?.suffer_score || details?.suffer_score || '-'}</p>
            </div>
        </div>
    );

    const HeartRateTelemetry = () => {
        if (!details?.streams?.heartrate?.data) return null;

        const data = details.streams.heartrate.data.map((hr, i) => ({
            index: i,
            hr: hr
        }));

        return (
            <div className="glass-card rounded-xl p-6 border border-white/10 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-white font-bold text-lg">Heart Rate Analysis</h3>
                        <p className="text-xs text-slate-500">Highlighting intensity zones</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-xs text-slate-400 font-mono uppercase">Heart Rate</span>
                    </div>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                labelStyle={{ display: 'none' }}
                                formatter={(value) => [`${value} BPM`, 'Heart Rate']}
                            />
                            <Area type="monotone" dataKey="hr" stroke="#f43f5e" fillOpacity={1} fill="url(#colorHr)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    // --- Map Layout Components ---

    const HeroMap = ({ mapPolyline }) => {
        if (!mapPolyline) return (
            <div className="h-[400px] bg-slate-900 flex items-center justify-center">
                <p className="text-slate-500">No map data available</p>
            </div>
        );

        const positions = polyline.decode(mapPolyline);
        const center = positions[Math.floor(positions.length / 2)];

        const Recenter = ({ positions }) => {
            const map = useMap();
            useEffect(() => {
                if (positions.length > 0) {
                    map.fitBounds(positions);
                }
            }, [positions, map]);
            return null;
        };

        return (
            <div className="h-[400px] w-full relative bg-slate-900">
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                    <TileLayer
                        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://stadiamaps.com/">Stadia</a>'
                    />
                    <Polyline positions={positions} color="#f97415" weight={4} opacity={0.9} />
                    <Recenter positions={positions} />
                </MapContainer>

                {/* Floating Metric Bar */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-[1000]">
                    <div className="glass-metric rounded-xl p-6 flex flex-wrap items-center justify-around gap-8 backdrop-blur-md bg-black/40 border border-white/10">
                        <div className="flex flex-col items-center">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Distance</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-3xl font-bold font-mono">{activity.distance || 0}</span>
                                <span className="text-slate-400 text-sm font-mono">km</span>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-white/10 hidden md:block"></div>
                        <div className="flex flex-col items-center">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Avg Pace</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-3xl font-bold font-mono">{activity.pace || 'N/A'}</span>
                                <span className="text-slate-400 text-sm font-mono">/km</span>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-white/10 hidden md:block"></div>
                        <div className="flex flex-col items-center">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Elevation</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-3xl font-bold font-mono">{activity.elevation || 0}</span>
                                <span className="text-slate-400 text-sm font-mono">m</span>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-white/10 hidden md:block"></div>
                        <div className="flex flex-col items-center">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Avg Heart Rate</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[#f97415] text-3xl font-bold font-mono">{activity.heartRate || 'N/A'}</span>
                                <span className="text-slate-400 text-sm font-mono">bpm</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const CombinedChart = () => {
        if (!details?.streams) return null;

        const chartData = details.streams.distance?.data?.map((dist, idx) => ({
            distance: (dist / 1000).toFixed(1),
            pace: details.streams.velocity_smooth?.data?.[idx]
                ? (1000 / (details.streams.velocity_smooth.data[idx] * 60)).toFixed(2)
                : null,
            heartRate: details.streams.heartrate?.data?.[idx] || null,
        })) || [];

        return (
            <div className="glass-card rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-white font-bold text-lg">Performance Telemetry</h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs text-slate-400 font-mono">PACE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="text-xs text-slate-400 font-mono">HEART RATE</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="distance" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <YAxis yAxisId="left" stroke="#10b981" style={{ fontSize: '12px' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" style={{ fontSize: '12px' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="pace" stroke="#10b981" strokeWidth={2.5} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="heartRate" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const PerKmTable = () => {
        if (!details?.laps || details.laps.length === 0) return null;

        return (
            <div className="glass-card rounded-xl overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-white font-bold">Kilometer Breakdown</h3>
                    <span className="text-slate-400 text-sm">{details.laps.length} km</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-sm">
                        <thead className="bg-slate-800/50 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">KM</th>
                                <th className="px-6 py-3 font-medium">Time</th>
                                <th className="px-6 py-3 font-medium">Pace</th>
                                <th className="px-6 py-3 font-medium">Avg HR</th>
                                <th className="px-6 py-3 font-medium">Elev. Gain</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {details.laps.map((lap, idx) => {
                                const paceSeconds = lap.moving_time / (lap.distance / 1000);
                                const paceMin = Math.floor(paceSeconds / 60);
                                const paceSec = Math.floor(paceSeconds % 60);
                                const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

                                // Calculate pace for all laps to identify fastest
                                const allPaces = details.laps.map(l => l.moving_time / (l.distance / 1000));
                                const minPace = Math.min(...allPaces);
                                const isFastest = Math.abs(paceSeconds - minPace) < 0.1; // Float comparison toggle

                                return (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-slate-800/30 transition-colors ${isFastest ? 'bg-[#f97415]/5' : ''}`}
                                    >
                                        <td className="px-6 py-4 text-slate-300">
                                            {idx + 1}
                                            {isFastest && <span className="ml-2 text-[10px] text-[#f97415] uppercase font-bold">Fastest</span>}
                                        </td>
                                        <td className="px-6 py-4 text-white">{Math.floor(lap.moving_time / 60)}:{(lap.moving_time % 60).toString().padStart(2, '0')}</td>
                                        <td className={`px-6 py-4 ${isFastest ? 'text-[#f97415] font-bold' : 'text-white'}`}>{pace} /km</td>
                                        <td className="px-6 py-4 text-emerald-400">{lap.average_heartrate ? Math.round(lap.average_heartrate) : 'N/A'} bpm</td>
                                        <td className="px-6 py-4 text-slate-400">{Math.round(lap.total_elevation_gain || 0)}m</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100">
            {hasMap ? (
                // --- MAP VIEW ---
                <>
                    <HeroMap mapPolyline={details?.map?.summary_polyline || details?.map?.polyline} />

                    <main className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {/* Header */}
                            <div className="space-y-1">
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Activities</span>
                                </button>
                                <h1 className="text-4xl font-bold text-white flex items-center gap-3 flex-wrap">
                                    {activity.raw?.name || activity.type}
                                    {aiAnalysis?.intensity_label && (
                                        <span className={`text-xs px-2 py-1 rounded font-mono border ${['Intense', 'Max Effort', 'Long Run', 'High', 'Very', 'Anaerobic'].some(l => aiAnalysis.intensity_label.includes(l))
                                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                : ['Recovery', 'Easy'].some(l => aiAnalysis.intensity_label.includes(l))
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-[#f97415]/10 text-[#f97415] border-[#f97415]/20'
                                            }`}>
                                            {aiAnalysis.intensity_label}
                                        </span>
                                    )}
                                </h1>
                                <p className="text-slate-400 text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {activity.date}
                                </p>
                            </div>

                            <CombinedChart />

                            {/* Secondary Metrics Grid for Runs */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Distance</p>
                                    <p className="text-2xl font-bold font-mono text-white">{activity.distance} <span className="text-sm font-normal text-slate-500">km</span></p>
                                </div>
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Duration</p>
                                    <p className="text-2xl font-bold font-mono text-white">{activity.duration}</p>
                                </div>
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Avg Pace</p>
                                    <p className="text-2xl font-bold font-mono text-white">{activity.pace} <span className="text-sm font-normal text-slate-500">/km</span></p>
                                </div>
                            </div>

                            <PerKmTable />
                        </div>

                        {/* Right Sidebar */}
                        <div className="space-y-6">
                            <AIInsightsSection />

                            {/* HR Gradient for Map View */}
                            <div className="glass-card rounded-xl p-6">
                                <HRZoneGradient avgHeartRate={activity.heartRate} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="glass-card p-4 rounded-xl text-center">
                                    <Clock className="w-5 h-5 text-[#f97415] mx-auto mb-1" />
                                    <p className="text-slate-500 text-[10px] uppercase font-bold">Moving Time</p>
                                    <p className="text-lg font-bold font-mono text-white">{activity.duration}</p>
                                </div>
                                <div className="glass-card p-4 rounded-xl text-center">
                                    <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                                    <p className="text-slate-500 text-[10px] uppercase font-bold">Elevation</p>
                                    <p className="text-lg font-bold font-mono text-white">{activity.elevation}m</p>
                                </div>
                            </div>
                        </div>
                    </main>
                </>
            ) : (
                // --- NON-MAP VIEW (Universal Data Report) ---
                <div className="pt-8 w-full max-w-[1400px] mx-auto">
                    {/* Non-Map Header */}
                    <div className="px-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-2">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm font-medium">Back to Activities</span>
                            </button>
                            <div className="flex items-center gap-2 text-xs font-bold text-[#f97415] uppercase tracking-widest">
                                <Activity className="w-4 h-4" />
                                <span>{activity.type} Session</span>
                            </div>
                            <h1 className="text-white text-4xl font-bold leading-tight flex items-center gap-3 flex-wrap">
                                {activity.raw?.name || activity.type}
                                {aiAnalysis?.intensity_label && (
                                    <span className={`text-xs px-2 py-1 rounded font-mono border align-middle ${['Intense', 'Max Effort', 'Long Run', 'High', 'Very', 'Anaerobic'].some(l => aiAnalysis.intensity_label.includes(l))
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : ['Recovery', 'Easy'].some(l => aiAnalysis.intensity_label.includes(l))
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-[#f97415]/10 text-[#f97415] border-[#f97415]/20'
                                        }`}>
                                        {aiAnalysis.intensity_label}
                                    </span>
                                )}
                            </h1>
                            <p className="text-slate-400 text-sm font-normal flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {activity.date}
                            </p>
                        </div>
                    </div>

                    <div className="px-6">
                        <NonMapStatsGrid />
                    </div>

                    <main className="px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-3 space-y-8">
                            <HeartRateTelemetry />

                            {/* Detailed Activity Log (Placeholder table if no laps/sets data) */}
                            {details?.laps && details.laps.length > 0 && (
                                <div className="glass-card rounded-xl overflow-hidden">
                                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                                        <Monitor className="text-slate-400 w-5 h-5" />
                                        <h3 className="text-white font-bold">Detailed Activity Log</h3>
                                    </div>
                                    <table className="w-full text-left font-mono text-sm">
                                        <thead className="bg-slate-800/50 text-slate-500">
                                            <tr>
                                                <th className="px-6 py-3 font-medium uppercase text-[10px] tracking-wider">Interval</th>
                                                <th className="px-6 py-3 font-medium uppercase text-[10px] tracking-wider">Time</th>
                                                <th className="px-6 py-3 font-medium uppercase text-[10px] tracking-wider">Avg HR</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {details.laps.map((lap, i) => (
                                                <tr key={i} className="hover:bg-slate-800/30">
                                                    <td className="px-6 py-4 text-slate-300">Set/Lap {i + 1}</td>
                                                    <td className="px-6 py-4 text-white">{Math.floor(lap.moving_time / 60)}:{(lap.moving_time % 60).toString().padStart(2, '0')}</td>
                                                    <td className="px-6 py-4 text-rose-400">{Math.round(lap.average_heartrate || 0)} bpm</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar */}
                        <div className="space-y-6">
                            <div className="glass-card rounded-xl p-6">
                                <h3 className="text-white font-bold text-lg mb-6">Heart Rate Distribution</h3>
                                <HRZoneGradient avgHeartRate={activity.heartRate} />
                            </div>

                            <AIInsightsSection />


                        </div>
                    </main>
                </div>
            )}
        </div>
    );
};

export default ActivityDetailPage;
