import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Activity, Zap, Flame, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export default function WeeklyPlanTab() {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await fetch('/api/coach/weekly-plan', { credentials: 'include' });
                if (!res.ok) throw new Error('Failed to load plan');
                const data = await res.json();
                setPlan(data);
            } catch (err) {
                console.error(err);
                setError('Could not load weekly plan. Please try generating a new plan.');
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-[#f97415]" />
            <p>Loading your schedule...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
            <p>{error}</p>
        </div>
    );

    const dummyPlan = plan || {
        weekNumber: 1,
        weekTheme: "Base Building",
        weekFocus: "Aerobic Capacity",
        days: [],
        totalDistance: 0
    };

    const getIntensityColor = (level) => {
        switch (level) {
            case 0: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
            case 1: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 2: return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 3: return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 pb-24">
            <header className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-black text-white">Week {dummyPlan.weekNumber}</h2>
                    <p className="text-[#f97415] font-bold uppercase tracking-widest text-sm mt-1">{dummyPlan.weekTheme}</p>
                    <p className="text-slate-400 text-sm mt-2">{dummyPlan.weekFocus}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-widest">Total Volume</p>
                    <p className="text-2xl font-black text-white">{dummyPlan.totalDistance} km</p>
                </div>
            </header>

            <div className="space-y-4">
                {dummyPlan.days.map((day, idx) => {
                    const isRest = day.workout_type === 'Rest';
                    const isToday = new Date().toISOString().split('T')[0] === day.date; // Simple check

                    return (
                        <div
                            key={idx}
                            className={`glass-card p-6 rounded-2xl border transition-all hover:bg-white/5 ${isToday ? 'border-[#f97415] bg-[#f97415]/5' : 'border-white/5 bg-white/5'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {/* Date Column */}
                                <div className="min-w-[100px]">
                                    <p className={`text-sm font-bold uppercase tracking-widest ${isToday ? 'text-[#f97415]' : 'text-slate-500'}`}>
                                        {day.dayName}
                                    </p>
                                    <p className="text-xs text-slate-600 font-mono mt-1">{day.date}</p>
                                </div>

                                {/* Workout Details */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className={`text-lg font-bold ${isRest ? 'text-slate-500' : 'text-white'}`}>
                                            {day.title || day.workout_type}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getIntensityColor(day.intensity)}`}>
                                            {day.workout_type}
                                        </span>
                                    </div>

                                    {!isRest && (
                                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-4 h-4 text-slate-500" />
                                                <span className="text-slate-200 font-medium">{day.target_time}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Zap className="w-4 h-4 text-slate-500" />
                                                <span className="text-slate-200 font-medium">{day.target_pace}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Interval Details */}
                                    {day.intervals && (
                                        <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-white/5 inline-block">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Interval Set</p>
                                            <p className="text-sm text-indigo-300 font-mono">
                                                {day.intervals.count} x @ {day.intervals.work_pace}
                                                <span className="text-slate-500 mx-2">/</span>
                                                Rec: {day.intervals.active_recovery_pace}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side / Status */}
                                <div className="md:text-right">
                                    {/* Could add 'Mark Complete' button here in future */}
                                    {isToday && <span className="text-xs font-bold text-[#f97415] uppercase tracking-widest border border-[#f97415]/30 px-3 py-1 rounded-full">Today</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
