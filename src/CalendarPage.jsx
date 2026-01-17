
import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronRight,
    Settings,
    User,
    Search,
    Bell,
    Activity,
    Zap,
    Clock,
    TrendingUp,
    Sparkles
} from 'lucide-react';
import MonthView from './components/Calendar/MonthView';
import DetailedWeekView from './components/Calendar/DetailedWeekView';
import TrainingPhasesView from './components/Calendar/TrainingPhasesView';
import { Flame } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                               Calendar Page                                */
/* -------------------------------------------------------------------------- */

const CalendarPage = () => {
    const [activeTab, setActiveTab] = useState('detailed-week'); // 'month', 'detailed-week', 'phases'
    const [masterPlan, setMasterPlan] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Master Plan and current Weekly Plan
    useEffect(() => {
        let isMounted = true;
        let pollTimeout = null;

        const fetchPlans = async () => {
            try {
                if (isMounted && !weeklyPlan) setLoading(true);

                // 1. Fetch Master Plan
                const masterRes = await fetch('/api/coach/master-plan');
                if (!masterRes.ok) throw new Error('Failed to fetch master plan');
                const masterData = await masterRes.json();
                if (isMounted && masterData && !masterData.error) setMasterPlan(masterData);

                // 2. Fetch Weekly Plan (for detailed view)
                const weeklyRes = await fetch('/api/coach/weekly-plan');
                if (!weeklyRes.ok) throw new Error('Failed to fetch weekly plan');
                const weeklyData = await weeklyRes.json();

                if (isMounted) {
                    if (weeklyData.status === 'generating') {
                        console.log('Weekly plan generating... polling in 3s');
                        pollTimeout = setTimeout(fetchPlans, 3000);
                        return; // Keep loading true
                    }

                    setWeeklyPlan(weeklyData);
                    setLoading(false);
                }

            } catch (err) {
                console.error("Error loading plans:", err);
                if (isMounted) {
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        fetchPlans();

        return () => {
            isMounted = false;
            if (pollTimeout) clearTimeout(pollTimeout);
        };
    }, []);

    const getCurrentPhase = () => {
        if (!masterPlan || !masterPlan.weeks || !masterPlan.currentWeek) return { name: "Training", description: "General Phase" };
        // Find current week in master plan
        const currentWeekData = masterPlan.weeks.find(w => w.week === masterPlan.currentWeek);
        return {
            name: currentWeekData?.phase || masterPlan.weeks[Math.min(masterPlan.weeks.length - 1, (masterPlan.currentWeek || 1) - 1)]?.phase || "Training",
            description: currentWeekData?.phaseDescription || "In Progress"
        };
    };

    const getProgress = () => {
        if (!masterPlan) return 0;
        const current = masterPlan.currentWeek || 0;
        const total = masterPlan.total_weeks || masterPlan.totalWeeks || 12;
        return Math.round((current / total) * 100);
    };

    const currentPhase = getCurrentPhase();
    const progress = getProgress();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0F172A] text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#f97415]/30 border-t-[#f97415] rounded-full animate-spin"></div>
                    <p className="animate-pulse text-slate-400">Loading your personalized plan...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0F172A] text-white">
                <div className="text-center max-w-md p-8 glass-panel rounded-xl">
                    <p className="text-rose-500 mb-4">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#f97415] rounded hover:bg-orange-600 transition">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0F172A] font-sans text-slate-100 overflow-hidden">
            {/* Top Navigation - Replicated from Design but consistent with App.jsx header style logic */}
            {/* Assuming App.jsx handles the main header, but if this is a standalone route... 
          Since App.jsx seems to manage top level state but maybe not routing perfectly? 
          I'll assume this renders inside the Main Content area if I plug it into App.jsx properly.
          For now I'll create a full page container.
      */}

            <main className="flex flex-1 overflow-hidden relative">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto hide-scrollbar z-10">
                    {/* Breadcrumbs & Heading */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-widest">
                            <span>Training Block</span>
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-[#f97415]">{currentPhase.name}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight font-display">Immersive Training Calendar</h1>
                                <p className="text-slate-400 mt-1">
                                    {(masterPlan.total_weeks || masterPlan.totalWeeks)}-Week Goal Block • Week {masterPlan.currentWeek} of {(masterPlan.total_weeks || masterPlan.totalWeeks)}
                                </p>
                            </div>
                            {/* Buttons removed as requested */}
                        </div>
                    </div>

                    {/* Calendar View Tabs */}
                    <div className="flex border-b border-white/10 gap-8">
                        <button
                            onClick={() => setActiveTab('month')}
                            className={`text-sm font-bold pb-3 transition-colors ${activeTab === 'month' ? 'text-white border-b-2 border-[#f97415]' : 'text-slate-400 hover:text-white'}`}
                        >
                            Month View
                        </button>
                        <button
                            onClick={() => setActiveTab('detailed-week')}
                            className={`text-sm font-bold pb-3 transition-colors ${activeTab === 'detailed-week' ? 'text-white border-b-2 border-[#f97415]' : 'text-slate-400 hover:text-white'}`}
                        >
                            Detailed Week
                        </button>
                        <button
                            onClick={() => setActiveTab('phases')}
                            className={`text-sm font-bold pb-3 transition-colors ${activeTab === 'phases' ? 'text-white border-b-2 border-[#f97415]' : 'text-slate-400 hover:text-white'}`}
                        >
                            Training Phases
                        </button>
                    </div>

                    {/* View Content */}
                    <div className="flex-1 relative">
                        {activeTab === 'month' && <MonthView masterPlan={masterPlan} />}
                        {activeTab === 'detailed-week' && <DetailedWeekView weeklyPlan={weeklyPlan} />}
                        {activeTab === 'phases' && <TrainingPhasesView masterPlan={masterPlan} />}
                    </div>
                </div>

                {/* Right Sidebar */}
                <aside className="w-80 bg-[#1e293b]/50 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col gap-8 z-20">
                    {/* Progress Tracker */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Plan Progress</h3>
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-[#f97415] bg-[#f97415]/20">
                                        In Progress
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-mono font-bold inline-block text-[#f97415]">
                                        {progress}%
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-1.5 mb-4 text-xs flex rounded bg-slate-800">
                                <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#f97415]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Volume Chart (Aesthetic Mini Chart) */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Weekly Volume</h3>

                        {/* Custom CSS Bar Chart matching the HTML design */}
                        <div className="h-32 flex items-end gap-2 px-2 border-b border-white/10">
                            {/* Mock bars for context +/- 2 weeks? Or use masterPlan data if available? */}
                            {/* Let's try to map the last 5 weeks up to current + next week */}
                            {(() => {
                                const currentWk = masterPlan.currentWeek || 1;
                                const weeksToShow = [currentWk - 2, currentWk - 1, currentWk, currentWk + 1, currentWk + 2];
                                return weeksToShow.map((wkNum, idx) => {
                                    if (wkNum < 1 || wkNum > (masterPlan.total_weeks || masterPlan.totalWeeks)) return <div key={idx} className="flex-1 bg-transparent"></div>;

                                    const wkData = masterPlan.weeks?.find(w => w.week === wkNum);
                                    const volume = wkData?.targetKm || 0;
                                    const maxVol = masterPlan.weeks ? Math.max(...masterPlan.weeks.map(w => w.targetKm || 0), 60) : 60;
                                    const heightPercent = Math.min(100, (volume / maxVol) * 100);

                                    const isActive = wkNum === currentWk;

                                    return (
                                        <div key={idx} className="flex-1 flex flex-col justify-end h-full gap-1 group">
                                            <div className={`w-full rounded-t-sm relative transition-all duration-500 ${isActive ? 'bg-slate-700/80' : 'bg-slate-800/50'}`} style={{ height: `${heightPercent}%` }}>
                                                <div className={`absolute inset-x-0 bottom-0 rounded-t-sm transition-all duration-500 ${isActive ? 'bg-[#f97415]' : 'bg-[#f97415]/40 group-hover:bg-[#f97415]/60'}`} style={{ height: isActive ? '100%' : '100%' }}></div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        <div className="flex justify-between font-mono text-[10px] text-slate-500">
                            <span>W{Math.max(1, masterPlan.currentWeek - 2)}</span>
                            <span className="text-[#f97415] font-bold">W{masterPlan.currentWeek}</span>
                            <span>W{Math.min((masterPlan.total_weeks || masterPlan.totalWeeks), masterPlan.currentWeek + 2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase">Target</p>
                                <p className="font-mono text-lg font-bold">{weeklyPlan?.totalDistance || '--'}<span className="text-xs ml-1">km</span></p>
                            </div>
                            <div>
                                {/* Actual would come from recent activities or calculated streak logic, but keeping it simple for now or using placeholder */}
                                <p className="text-[10px] text-slate-500 uppercase">Actual</p>
                                <p className="font-mono text-lg font-bold text-[#f97415]">--<span className="text-xs ml-1">km</span></p>
                            </div>
                        </div>
                    </div>

                    {/* AI Coach's Note */}
                    <div className="mt-auto bg-[#f97415]/10 rounded-xl p-5 border border-[#f97415]/20 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-24 h-24 text-[#f97415]" />
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <Flame className="w-5 h-5 text-[#f97415]" />
                            <h4 className="text-sm font-bold text-white uppercase tracking-tight">Coach's Insight</h4>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                            "{currentPhase.description || "Focus on consistency this week."} Remember to keep your easy runs truly easy to recover for the key sessions."
                        </p>
                    </div>
                </aside>
            </main>

            {/* Background Telemetry SVG from HTML */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-visible opacity-20">
                <path className="telemetry-line" d="M 50 200 Q 300 150 600 250 T 1200 200" fill="none" stroke="#f97415" strokeDasharray="4" strokeWidth="1"></path>
            </svg>
            <style jsx="true" global="true">{`
        .glass-panel {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .font-display {
           font-family: 'Space Grotesk', sans-serif; /* Setup in App.jsx or Index.html if needed, otherwise fallback */
        }
      `}</style>
        </div>
    );
};

export default CalendarPage;
