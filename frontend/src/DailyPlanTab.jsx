import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config/api';

const DailyPlanTab = ({ user, onNavigateToCalendar }) => {
    const [selectedWorkout, setSelectedWorkout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [todayFocus, setTodayFocus] = useState([]);
    const hasTriggeredSync = useRef(false);

    useEffect(() => {
        let isMounted = true;
        let pollInterval;

        const startProcess = async () => {
            try {
                // Check if we already have the plan
                const token = localStorage.getItem('authToken');
                const headers = { 'Authorization': `Bearer ${token}` };

                const response = await fetch(`${API_BASE_URL}/api/coach/daily-plan`, { headers });
                const data = await response.json();

                if (data.status === 'generating' || data.status === 'syncing') {
                    // Plan missing or regenerating, trigger sync only once
                    if (!hasTriggeredSync.current) {
                        hasTriggeredSync.current = true;
                        console.log("Plan missing/generating, triggering sync...");
                        await fetch(`${API_BASE_URL}/api/coach/sync`, {
                            method: 'POST',
                            headers
                        });
                    }
                    // Start polling
                    pollData();
                } else {
                    // We have data! Process it immediately
                    if (isMounted) handlePlanData(data);
                }
            } catch (error) {
                console.error("Initial check failed:", error);
                // Fallback to polling/syncing just in case
                pollData();
            }
        };

        const handlePlanData = (data) => {
            // Transform API data to component format
            // API structure: { recommended: {...}, option_2: {...}, option_3: {...}, ... }
            let workouts = [];

            // Check for the new format with recommended/option_2/option_3
            if (data.recommended) {
                workouts = [
                    {
                        level: "Level 1",
                        levelColor: "text-emerald-400",
                        duration: data.option_2?.duration || data.option_3?.duration || "25m",
                        title: data.option_2?.title || data.option_3?.title || "Recovery",
                        description: data.option_2?.description || data.option_3?.description || "Light activity to promote recovery.",
                        targetPace: data.option_2?.targetPace || "Easy",
                        predictedTime: data.option_2?.duration || "25m",
                        recommended: false,
                        coachTip: data.option_2?.coachTip
                    },
                    {
                        level: "Level 2",
                        levelColor: "text-primary",
                        duration: data.recommended.duration || "45m",
                        title: data.recommended.title || data.recommended.type || "Training",
                        description: data.recommended.description || "Complete your planned workout.",
                        targetPace: data.recommended.targetPace || "Moderate",
                        predictedTime: data.recommended.duration,
                        recommended: true,
                        coachTip: data.recommended.coachTip,
                        distance: data.recommended.distance
                    },
                    {
                        level: "Level 3",
                        levelColor: "text-rose-500",
                        duration: data.option_3?.duration || "30m",
                        title: data.option_3?.title || "Cross Training",
                        description: data.option_3?.description || "Alternative training option.",
                        targetPace: data.option_3?.targetPace || "Varies",
                        predictedTime: data.option_3?.duration,
                        recommended: false,
                        coachTip: data.option_3?.coachTip
                    }
                ];
            } else if (data.dailyPlan) {
                // Legacy structured plan format (recovery/base/threshold)
                workouts = [
                    {
                        level: "Level 1",
                        levelColor: "text-emerald-400",
                        duration: data.dailyPlan.recovery?.duration || "25m",
                        title: data.dailyPlan.recovery?.type || "Recovery",
                        description: data.dailyPlan.recovery?.description || "Light activity to promote recovery.",
                        targetPace: "Easy",
                        predictedTime: data.dailyPlan.recovery?.duration,
                        recommended: false
                    },
                    {
                        level: "Level 2",
                        levelColor: "text-primary",
                        duration: data.dailyPlan.base?.duration || "45m",
                        title: data.dailyPlan.base?.type || "Aerobic Base",
                        description: data.dailyPlan.base?.description || "Steady effort to build endurance.",
                        targetPace: data.dailyPlan.base?.target_pace || "Moderate",
                        predictedTime: data.dailyPlan.base?.duration,
                        recommended: true
                    },
                    {
                        level: "Level 3",
                        levelColor: "text-rose-500",
                        duration: data.dailyPlan.threshold?.duration || "30m",
                        title: data.dailyPlan.threshold?.type || "Threshold",
                        description: data.dailyPlan.threshold?.description || "Hard effort to improve speed.",
                        targetPace: data.dailyPlan.threshold?.target_pace || "Hard",
                        predictedTime: data.dailyPlan.threshold?.duration,
                        recommended: false
                    }
                ];
            } else if (Array.isArray(data)) {
                // Legacy array fallback
                workouts = data;
            } else {
                // Fallback if data is completely missing/malformed
                console.warn("Unexpected data format, using fallback", data);
                setLoading(false);
                return;
            }

            setTodayFocus(workouts);
            setLoading(false);
        };

        const pollData = async () => {
            if (!isMounted) return;

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${API_BASE_URL}/api/coach/daily-plan`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();

                if (!isMounted) return;

                if (data.status === 'generating' || data.status === 'syncing') {
                    // Poll again in 2 seconds
                    pollInterval = setTimeout(pollData, 2000);
                    return;
                }

                handlePlanData(data);

            } catch (error) {
                console.error("Failed to fetch plan:", error);
                // Keep loading or show error? For now, keep loading state to avoid jarring error UI
            }
        };

        startProcess();

        return () => {
            isMounted = false;
            if (pollInterval) clearTimeout(pollInterval);
        };
    }, []);

    return (
        <div className="space-y-6 pb-24">

            {/* Header: No border, simplified to remove separation */}
            <header className="sticky top-0 z-50 border-none bg-gradient-to-b from-[#0f172a] via-[#0f172a]/80 to-transparent pb-4">
                <div className="max-w-md mx-auto px-5 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-white border border-primary/20 shadow-lg shadow-primary/10">
                            <span className="material-symbols-outlined text-2xl font-bold text-primary">shadow</span>
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-white">ECLIPSE <span className="text-primary">V2</span></h1>
                            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Adaptive Coach</p>
                        </div>
                    </div>

                    {/* Big Streak Bubble */}
                    <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-orange-600/20 px-3 py-1.5 rounded-full border border-orange-500/30">
                        <span className="material-symbols-outlined text-orange-500 text-base">local_fire_department</span>
                        <span className="text-xs font-bold text-orange-400 tracking-wide">12 Day Streak</span>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh] animate-pulse px-6 text-center">
                    <p className="text-sm font-medium text-slate-400 bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5">
                        Hold tight while we get your plans in order...
                    </p>
                </div>
            ) : (
                <main className="max-w-md mx-auto px-5 py-2 space-y-8">

                    {/* 1. Today's Focus Section */}
                    <section className="space-y-4">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400">Today's Focus</h2>
                            <span className="text-[10px] font-medium opacity-50 uppercase text-slate-500">Oct 24</span>
                        </div>

                        {/* Expandable Card Logic */}
                        {selectedWorkout ? (
                            /* Expanded View */
                            <div className="glass-card p-6 rounded-2xl border border-primary/30 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
                                {/* Back Button */}
                                <button
                                    onClick={() => setSelectedWorkout(null)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedWorkout.levelColor}`}>
                                                {selectedWorkout.level}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                                                {selectedWorkout.duration}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white leading-tight mb-2">{selectedWorkout.title}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed font-medium mb-3">
                                            {selectedWorkout.description}
                                        </p>

                                        {/* Simplified Stats */}
                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-primary text-base">speed</span>
                                                <span>{selectedWorkout.targetPace}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 ">
                                                <span className="material-symbols-outlined text-emerald-400 text-base">timer</span>
                                                <span>{selectedWorkout.predictedTime}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button className="w-full py-3 bg-primary rounded-xl font-bold text-white text-sm shadow-lg shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-orange-600">
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Mark as Completed
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* List View */
                            <div className="flex flex-col gap-3">
                                {todayFocus.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedWorkout(item)}
                                        className={`glass-card p-4 rounded-xl flex items-center gap-4 relative overflow-hidden group transition-all duration-300 active:scale-[0.98] cursor-pointer border ${item.recommended ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-primary/40 shadow-xl shadow-orange-900/10' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800'}`}
                                    >
                                        {item.recommended && (
                                            <div className="absolute top-0 right-0 px-2 py-1 bg-primary text-[8px] font-bold text-white uppercase rounded-bl-lg">
                                                Recommended
                                            </div>
                                        )}

                                        <div className="flex-1 relative z-10 pl-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${item.levelColor}`}>
                                                    {item.level}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                <span className={`text-[10px] font-medium ${item.recommended ? 'text-primary' : 'opacity-60 text-white'}`}>{item.duration}</span>
                                            </div>
                                            <h3 className="text-sm font-bold text-white leading-tight">{item.title}</h3>
                                        </div>

                                        <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 2. Week Progress (Moved Up) */}
                    <section className="glass-card bg-gradient-to-br from-indigo-900/20 to-slate-900/50 p-5 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <span className="material-symbols-outlined text-6xl text-white">flag</span>
                        </div>

                        <div className="flex items-center gap-6 relative z-10">
                            {/* Points Figure / Progress Circle */}
                            <div className="relative w-20 h-20 flex-none">
                                <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                                    <circle className="text-slate-800" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeWidth="8"></circle>
                                    <circle className="text-primary" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeDasharray="263.8" strokeDashoffset="79" strokeLinecap="round" strokeWidth="8"></circle>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold text-white leading-none tracking-tight">42</span>
                                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">/ 60</span>
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="space-y-1">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">Week Progress</h3>
                                <p className="text-xl font-bold text-white">Day 4 <span className="text-slate-500 text-base font-medium">/ 7</span></p>
                                <p className="text-xs text-indigo-200/60 leading-relaxed">You are crushing your weekly volume goals. Keep it up!</p>
                            </div>
                        </div>
                    </section>

                    {/* 3. The Road Ahead (Moved Down) */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400">The Road Ahead</h2>
                            <button className="text-[10px] font-medium text-primary hover:text-orange-300 transition-colors" onClick={onNavigateToCalendar}>Full Calendar</button>
                        </div>
                        <div className="flex overflow-x-auto gap-4 hide-scrollbar pb-4 -mx-5 px-5 snap-x">
                            {/* Mock Upcoming Days */}
                            <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-xl border-l-4 border-l-primary snap-center flex flex-col justify-between h-28">
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Fri</p>
                                    <h4 className="text-sm font-bold mt-1 text-white leading-tight">Speed Intervals</h4>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                    <span className="text-[10px] font-mono text-slate-400">12k • 5am</span>
                                    <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                                </div>
                            </div>
                            <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-xl border border-white/5 snap-center flex flex-col justify-between h-28 hover:bg-slate-800 transition-colors cursor-pointer">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sat</p>
                                    <h4 className="text-sm font-bold mt-1 text-white leading-tight">Long Run</h4>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                    <span className="text-[10px] font-mono text-slate-400">24k • 7am</span>
                                    <span className="material-symbols-outlined text-sm text-slate-500">timer</span>
                                </div>
                            </div>
                            <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-xl border border-white/5 snap-center flex flex-col justify-between h-28 hover:bg-slate-800 transition-colors cursor-pointer">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sun</p>
                                    <h4 className="text-sm font-bold mt-1 text-white leading-tight">Active Rest</h4>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                    <span className="text-[10px] font-mono text-slate-400">Yoga</span>
                                    <span className="material-symbols-outlined text-sm text-emerald-500">spa</span>
                                </div>
                            </div>
                        </div>
                    </section>

                </main>
            )}
        </div>
    );
};

export default DailyPlanTab;
