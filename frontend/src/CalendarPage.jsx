import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config/api';
import MonthView from './components/Calendar/MonthView';
import TrainingPhasesView from './components/Calendar/TrainingPhasesView';

/* -------------------------------------------------------------------------- */
/*                               Calendar Page                                */
/* -------------------------------------------------------------------------- */

const CalendarPage = () => {
    const [activeTab, setActiveTab] = useState('week'); // 'month', 'week', 'phases'
    const [masterPlan, setMasterPlan] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [loading, setLoading] = useState(true);

    // Key addition: Ref for scrolling
    const scrollContainerRef = useRef(null);
    const hasTriggeredSync = useRef(false);

    // Fetch Plans
    useEffect(() => {
        let isMounted = true;
        const fetchPlans = async (isPolling = false) => {
            try {
                if (isMounted && !weeklyPlan && !isPolling) setLoading(true);

                const token = localStorage.getItem('authToken');
                const headers = { 'Authorization': `Bearer ${token}` };

                const masterRes = await fetch(`${API_BASE_URL}/api/coach/master-plan`, { headers });
                const masterData = await masterRes.json();

                // Handle No Goal case
                if (masterData.error === "No active goal") {
                    if (isMounted) {
                        setMasterPlan({ error: "No active goal" }); // Set special state
                        setLoading(false);
                        return; // Stop here, no sync
                    }
                }

                if (isMounted && masterData && !masterData.error) setMasterPlan(masterData);

                const weeklyRes = await fetch(`${API_BASE_URL}/api/coach/weekly-plan`, { headers });
                const weeklyData = await weeklyRes.json();

                if (isMounted) {
                    if (weeklyData.status !== 'generating') {
                        setWeeklyPlan(weeklyData);
                        setLoading(false);
                    }
                }

                // If master plan is essentially empty (no weeks) but no error, we need to sync
                // OR if weekly plan is generating (missing)
                const masterMissing = !masterData.weeks || masterData.weeks.length === 0;
                const weeklyMissing = weeklyData.status === 'generating';
                const needsSync = masterMissing || weeklyMissing;

                // Only trigger sync if we are NOT polling
                if (needsSync && !isPolling) {
                    if (!hasTriggeredSync.current) {
                        console.log("Plans missing (Master: " + masterMissing + ", Weekly: " + weeklyMissing + "), triggering sync...");
                        hasTriggeredSync.current = true;
                        await fetch(`${API_BASE_URL}/api/coach/sync`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                        });
                    }
                }

                if (isMounted) {
                    // If generating, maybe poll?
                    const isGenerating = weeklyData.status === 'generating';

                    // Retry ONLY if it's still generating
                    if (isGenerating) {
                        setTimeout(() => {
                            if (isMounted) fetchPlans(true); // Pass true to avoid re-triggering sync
                        }, 3000);
                    }
                }
            } catch (err) {
                console.error("Error loading plans:", err);
                if (isMounted) setLoading(false);
            }
        };

        fetchPlans();
        return () => { isMounted = false; };
    }, []);

    // Auto-scroll effect
    useEffect(() => {
        if (activeTab === 'week' && weeklyPlan && scrollContainerRef.current) {
            // Give a slight delay for DOM to settle/render cards
            setTimeout(() => {
                const activeCard = scrollContainerRef.current?.querySelector('.active-day-glow');
                if (activeCard) {
                    activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }, 100);
        }
    }, [activeTab, weeklyPlan]);

    const getCurrentPhase = () => {
        if (!masterPlan || !masterPlan.weeks) return { name: "General Prep", description: "Building aerobic base" };
        const currentWeekData = masterPlan.weeks.find(w => w.week === masterPlan.currentWeek);
        return {
            name: currentWeekData?.phase || masterPlan.weeks[0]?.theme || "Training",
            description: currentWeekData?.focus || "Consistency is key."
        };
    };

    const getProgress = () => {
        if (!masterPlan || !masterPlan.startDate) return 0;
        const start = new Date(masterPlan.startDate);
        const now = new Date();
        const diffTime = Math.max(0, now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalDays = (masterPlan.total_weeks || 12) * 7;
        return Math.min(100, Math.round((diffDays / totalDays) * 100));
    };

    const currentPhase = getCurrentPhase();
    const progress = getProgress();
    const currentWeekNum = masterPlan?.currentWeek || 1;

    const getVolumeData = () => {
        if (!masterPlan || !masterPlan.weeks) return Array(6).fill(0.05);
        const offsets = [-3, -2, -1, 0, 1, 2];
        return offsets.map(offset => {
            const wNum = currentWeekNum + offset;
            if (wNum < 1) return 0; // No bar for pre-program

            const wData = masterPlan.weeks.find(w => w.week === wNum);
            if (!wData) return 0;

            const km = wData.targetKm || 0;
            let multiplier = 1.0;
            const theme = (wData.theme || "").toLowerCase();
            const focus = (wData.focus || "").toLowerCase();

            if (theme.includes('base')) multiplier = 1.0;
            if (theme.includes('build') || focus.includes('tempo')) multiplier = 1.2;
            if (theme.includes('peak') || theme.includes('race') || focus.includes('interval')) multiplier = 1.4;
            if (theme.includes('taper')) multiplier = 0.8;

            const score = km * multiplier;
            return Math.min(1.0, score / 200);
        });
    };

    const volumeBars = getVolumeData();
    const plannedDistance = weeklyPlan?.days?.reduce((acc, day) => acc + (day.distance || 0), 0) || 0;

    // Helper for rendering difficulty dots/badges
    const renderIntensity = (day) => {
        // 1=Easy (Green), 2=Moderate (Orange), 3=Intense (Red)
        // Check for numeric intensity first, then fallback to label
        let color = 'text-emerald-500';
        let label = 'Easy';

        const intensity = day.intensity;
        const labelStr = (day.intensityLabel || "").toLowerCase();

        if (intensity === 2 || labelStr === 'moderate') {
            color = 'text-ignite-orange';
            label = 'Moderate';
        } else if (intensity === 3 || labelStr === 'high' || labelStr === 'intense' || labelStr === 'hard') {
            color = 'text-rose-500';
            label = 'Intense';
        }

        return <span className={`text-[9px] font-bold uppercase mb-0.5 ${color}`}>{label}</span>;
    };

    // No Goal State
    if (masterPlan && masterPlan.error === "No active goal") {
        return (
            <div className="flex flex-col h-screen bg-deep-slate text-white items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-3xl text-slate-400">flag</span>
                </div>
                <h2 className="text-xl font-bold mb-2">No Active Goal</h2>
                <p className="text-slate-400 text-sm mb-8 max-w-xs leading-relaxed">
                    Set a training goal to generate your personalized master plan and schedule.
                </p>
                <a href="/profile" onClick={(e) => { e.preventDefault(); window.location.href = '/profile'; /* Or use router logic if available, but simplistic for now */ }} className="bg-primary text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-900/20 active:scale-95 transition-transform">
                    Set Goal
                </a>
            </div>
        );
    }


    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-deep-slate text-white pb-24 font-display">
            {/* Header (Simplified) */}
            <header className="sticky top-0 z-50 bg-gradient-to-b from-[#0f172a] via-[#0f172a]/80 to-transparent px-4 py-4 flex items-center justify-center">
                <h1 className="text-base font-bold tracking-tight uppercase">Calendar</h1>
            </header>

            <main className="flex-1">
                {/* Tabs */}
                <div className="px-4 mt-4 mb-6">
                    <div className="bg-slate-800/50 p-1 rounded-lg flex gap-1">
                        {['month', 'week', 'phases'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Week View (New Design) */}
                {activeTab === 'week' && (
                    <div className="flex flex-col gap-3">
                        {/* Past Weeks (Collapsed) */}
                        {currentWeekNum > 1 && (
                            <div className="px-4">
                                <div className="glass-panel h-10 rounded-lg flex items-center px-4 opacity-50 border border-white/5">
                                    <span className="text-[10px] font-mono text-slate-500 w-12">W{String(currentWeekNum - 1).padStart(2, '0')}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1 text-center">Previous Week Completed</span>
                                    <div className="w-12 text-right">
                                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Current Week Header */}
                        <div className="flex flex-col gap-2 mt-2">
                            <div className="px-4 flex justify-between items-center">
                                <span className="text-[10px] font-mono text-ignite-orange font-bold uppercase">Week {String(currentWeekNum).padStart(2, '0')} (Current)</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: 'numeric' })} • {plannedDistance.toFixed(1)} km
                                </span>
                            </div>

                            {/* Horizontal Scroll Cards (Added Ref) */}
                            <div ref={scrollContainerRef} className="flex overflow-x-auto snap-x hide-scrollbar gap-3 px-4 pb-4">
                                {weeklyPlan?.days?.map((day, index) => {
                                    const isToday = new Date(day.date).getDate() === new Date().getDate();
                                    const isCompleted = new Date(day.date) < new Date().setHours(0, 0, 0, 0);

                                    return (
                                        <div
                                            key={index}
                                            className={`min-w-[170px] snap-center glass-panel rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all ${isToday ? 'active-day-glow' : 'opacity-80'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className={`text-[10px] font-mono ${isToday ? 'text-ignite-orange font-bold' : 'text-slate-400'}`}>
                                                    {day.dayName.toUpperCase().slice(0, 3)} {new Date(day.date).getDate()}
                                                </span>
                                                {isToday && <span className="flex h-2 w-2 rounded-full bg-ignite-orange animate-pulse"></span>}
                                                {isCompleted && <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>}
                                            </div>

                                            <div>
                                                {day.workout_type === 'Rest' ? (
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Rest Day</p>
                                                ) : (
                                                    renderIntensity(day)
                                                )}
                                                <h4 className="font-bold text-xs leading-tight h-8 line-clamp-2 text-white">
                                                    {day.title || day.workout_type}
                                                </h4>
                                            </div>

                                            <div className="mt-auto">
                                                {day.workout_type === 'Rest' ? (
                                                    <div className="font-mono text-lg font-bold text-slate-600">--<span className="text-[10px] text-slate-700 ml-0.5">MIN</span></div>
                                                ) : (
                                                    <>
                                                        <div className="font-mono text-xl font-bold text-white">
                                                            {day.distance ? day.distance.toFixed(1) : '0.0'}
                                                            <span className="text-xs text-slate-500 ml-0.5">KM</span>
                                                        </div>
                                                        <div className={`font-mono text-[10px] uppercase mt-0.5 font-bold ${isToday ? 'text-ignite-orange' : 'text-slate-400'}`}>
                                                            {day.target_pace ? `Pace ${day.target_pace}` : 'Easy Pace'}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Fallback/Loading Cards if no plan */}
                                {!weeklyPlan && [1, 2, 3].map(i => (
                                    <div key={i} className="min-w-[160px] snap-center glass-panel rounded-xl p-4 flex flex-col gap-3 opacity-50">
                                        <div className="h-3 w-10 bg-slate-700 rounded animate-pulse"></div>
                                        <div className="space-y-1">
                                            <div className="h-2 w-16 bg-slate-700 rounded animate-pulse"></div>
                                            <div className="h-8 w-full bg-slate-700/50 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Future Weeks */}
                        <div className="px-4 flex flex-col gap-2 mt-2">
                            {[1, 2].map(offset => {
                                const targetWeekNum = currentWeekNum + offset;
                                if (masterPlan && targetWeekNum > (masterPlan.total_weeks || 52)) return null;

                                const targetWeekData = masterPlan?.weeks?.find(w => w.week === targetWeekNum);
                                const focus = targetWeekData?.focus || targetWeekData?.theme || "Upcoming Phase";

                                return (
                                    <div key={offset} className="glass-panel h-10 rounded-lg flex items-center px-4 bg-cosmic-indigo/10 border border-white/5">
                                        <span className="text-[10px] font-mono text-slate-500 w-12">W{String(targetWeekNum).padStart(2, '0')}</span>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex-1 text-center truncate px-2">
                                            {focus}
                                        </span>
                                        <div className="w-12 text-right">
                                            <span className="material-symbols-outlined text-slate-500 text-sm">unfold_more</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Stats Section */}
                        <div className="px-4 mt-6 flex flex-col gap-4">
                            {/* Plan Progress */}
                            <div className="glass-panel p-4 rounded-xl border border-white/5">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Plan Progress</h3>
                                    <span className="text-[10px] font-mono font-bold text-ignite-orange">{progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-ignite-orange" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>

                            {/* Weekly Volume */}
                            <div className="glass-panel p-4 rounded-xl border border-white/5">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Weekly Volume</h3>
                                <div className="h-20 flex items-end gap-2 px-1 border-b border-white/5 pb-1">
                                    {volumeBars.map((h, i) => (
                                        <div key={i} className={`flex-1 bg-slate-800/50 rounded-t-sm relative ${i > 3 ? 'opacity-30' : ''}`} style={{ height: `${h * 100}%` }}>
                                            {i <= 3 && (
                                                <div className={`absolute inset-x-0 bottom-0 rounded-t-sm ${i === 3 ? 'bg-ignite-orange h-[25%]' : 'bg-ignite-orange/30 h-[90%]'}`}></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between font-mono text-[8px] text-slate-500 mt-2 px-1">
                                    {[-3, -2, -1, 0, 1, 2].map((offset, i) => {
                                        const wNum = currentWeekNum + offset;
                                        return (
                                            <span key={i} className={offset === 0 ? "text-ignite-orange font-bold" : ""}>
                                                {wNum > 0 ? `W${wNum}` : ''}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>


                        </div>
                    </div>
                )}

                {/* Existing Views */}
                {activeTab === 'month' && <MonthView masterPlan={masterPlan} />}
                {activeTab === 'phases' && (
                    <div className="px-4">
                        <TrainingPhasesView masterPlan={masterPlan} />
                    </div>
                )}
            </main>
        </div>
    );
};

export default CalendarPage;
