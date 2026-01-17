/**
 * DailyPlanTab - Main AI Coach Dashboard
 * 
 * Displays:
 * - Greeting with mood selector
 * - Recommended workout (hero card)
 * - Alternative workouts (2 options)
 * - Coach chat section
 * - Weekly progress tracker
 * - Upcoming days preview
 */
import React, { useState, useEffect, useRef } from 'react';
import { Flame, Target, Sparkles, ChevronRight, Send, Calendar, BarChart3, Smile, Meh, Frown, RefreshCw, CheckCircle, Trophy, ExternalLink, Clock, Activity, Zap, PlayCircle } from 'lucide-react';

const SparklesLoader = () => (
    <div className="flex flex-col items-center justify-center py-4 space-y-4">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-[#818CF8]/30 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#f97415] animate-spin-slow" />
            </div>
        </div>
    </div>
);

/**
 * DailyPlanTab - Main AI Coach Dashboard
 */
export default function DailyPlanTab({ user, onNavigateToCalendar }) {
    const [dailyPlan, setDailyPlan] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const [streak, setStreak] = useState(0);
    const [goal, setGoal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMood, setSelectedMood] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const [syncing, setSyncing] = useState(false);
    const [completedWorkout, setCompletedWorkout] = useState(null);
    const [selectedOption, setSelectedOption] = useState('recommended'); // 'recommended', 'option_2', 'option_3'

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const firstName = user?.name?.split(' ')[0] || 'Athlete';

    const dummyDailyPlan = dailyPlan || {
        recommended: {
            title: "Threshold Intervals",
            type: "Tempo Run",
            intensity: 3,
            intensityLabel: "Hard",
            description: "2x20 mins at threshold effort with recovery",
            targetPace: "4:45 /km",
            estimatedDistance: 12,
            estimatedDuration: 75,
            coachTip: "Focus on consistent pacing.",
            intervals: { count: 2, work_pace: "4:45", active_recovery_pace: "6:00" }
        },
        option_2: {
            title: "Recovery Spin",
            type: "Cross Training",
            intensity: 1,
            intensityLabel: "Easy",
            description: "45 mins low impact cardio on bike",
            targetPace: "N/A",
            estimatedDistance: 0,
            estimatedDuration: 45
        },
        option_3: {
            title: "Rest Day",
            type: "Rest",
            intensity: 0,
            intensityLabel: "Rest",
            description: "Total rest to recover",
            targetPace: "N/A",
            estimatedDistance: 0,
            estimatedDuration: 0
        },
        weeklyPoints: { earned: 42, goal: 60 }
    };

    // Helper to get active option data w/ fallback
    const activeOption = (dummyDailyPlan && dummyDailyPlan[selectedOption])
        ? dummyDailyPlan[selectedOption]
        : (dummyDailyPlan?.recommended || { title: "Loading...", type: "Please wait", intensityLabel: "Rest", description: "Fetching your plan...", estimatedDuration: 0 });

    // Fetch data on mount
    useEffect(() => {
        let isMounted = true;
        let pollTimeout = null;

        const fetchData = async () => {
            if (isMounted && !syncing) setLoading(true);
            try {
                const [dailyRes, weeklyRes, streakRes, goalRes] = await Promise.all([
                    fetch('/api/coach/daily-plan', { credentials: 'include' }),
                    fetch('/api/coach/weekly-plan', { credentials: 'include' }),
                    fetch('/api/coach/streak', { credentials: 'include' }),
                    fetch('/api/goals', { credentials: 'include' })
                ]);

                if (!isMounted) return;

                // Handle Goals
                if (goalRes.ok) {
                    const g = await goalRes.json();
                    // Handle both structures (direct object or {hasGoal, goal})
                    setGoal(g.goal || g);
                }

                // Handle Streak
                if (streakRes.ok) {
                    const s = await streakRes.json();
                    setStreak(s.streakDays || 0);
                }

                // Handle Daily Plan with Polling
                if (dailyRes.ok) {
                    const data = await dailyRes.json();

                    if (data.status === 'generating' || data.status === 'syncing') {
                        console.log('Plan generating... polling in 3s');
                        setSyncing(true);
                        setLoading(false);
                        pollTimeout = setTimeout(fetchData, 3000);
                        return;
                    }

                    setDailyPlan(data.dailyPlan || data);
                }

                // Handle Weekly Plan
                if (weeklyRes.ok) {
                    const data = await weeklyRes.json();
                    if (data.status !== 'generating') {
                        setWeeklyPlan(data.weeklyPlan || data);
                    }
                }

                setSyncing(false);
                setLoading(false);

            } catch (err) {
                console.error("Failed to load coach data", err);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            if (pollTimeout) clearTimeout(pollTimeout);
        };
    }, []);

    const handleFinishedWorkout = async () => {
        setSyncing(true);
        // Simulate sync logic...
        setTimeout(() => setSyncing(false), 2000);
        // In real app, call /sync endpoint
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;
        setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
        setChatInput('');
        setChatLoading(true);
        try {
            const res = await fetch('/api/coach/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: chatInput,
                    currentPlan: dailyPlan // Pass context
                })
            });
            if (res.ok) {
                const data = await res.json();
                setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            }
        } catch (e) { console.error(e) }
        setChatLoading(false);
    };

    const getIntensityColor = (label) => {
        const labelLower = (label || '').toLowerCase();
        if (labelLower.includes('long run')) return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
        if (labelLower.includes('moderate')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        if (labelLower.includes('intense')) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (labelLower.includes('workout')) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20'; // Default/Rest
    };

    if (loading || syncing) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <div className="scale-150 mb-8">
                    <SparklesLoader />
                </div>
                <p className="text-slate-400 animate-pulse text-lg font-medium">
                    {syncing ? "Syncing your training plan with AI..." : "Loading daily insights..."}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2">{getGreeting()}, {firstName}</h1>
                    <p className="text-slate-400">Let's crush today's training.</p>
                </div>
                <div className="flex gap-4">
                    {streak > 0 && (
                        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-full">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <span className="text-orange-500 font-bold">{streak} Day Streak</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Choose Your Workout Section */}
            <section>
                <div className="flex items-center gap-2 mb-6">
                    <Target className="w-6 h-6 text-[#f97415]" />
                    <h2 className="text-2xl font-bold text-white">Choose Your Workout</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['recommended', 'option_2', 'option_3'].map((optKey) => {
                        const option = dummyDailyPlan[optKey];
                        // Safety check: ensure option exists and has basic fields
                        if (!option || !option.title) return null;

                        const isSelected = selectedOption === optKey;
                        const isRec = optKey === 'recommended';

                        return (
                            <button
                                key={optKey}
                                onClick={() => setSelectedOption(optKey)}
                                className={`relative text-left p-6 rounded-3xl border-2 transition-all duration-300 group ${isSelected
                                    ? 'bg-[#f97415]/10 border-[#f97415] shadow-[0_0_30px_rgba(249,116,21,0.2)]'
                                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                                    }`}
                            >
                                {isRec && (
                                    <span className="absolute -top-3 left-6 px-3 py-1 bg-[#f97415] text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                                        Recommended
                                    </span>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getIntensityColor(option.intensityLabel)}`}>
                                        {option.intensityLabel}
                                    </div>
                                    {isSelected && <CheckCircle className="w-6 h-6 text-[#f97415]" />}
                                </div>

                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#f97415] transition-colors">
                                    {option.title}
                                </h3>
                                <p className="text-sm text-slate-400 mb-6">{option.type}</p>

                                <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-slate-500" />
                                        {option.estimatedDuration} min
                                    </div>
                                    {option.estimatedDistance > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Activity className="w-4 h-4 text-slate-500" />
                                            {option.estimatedDistance} km
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Active Workout Detail View */}
            <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-1 border border-white/10 shadow-2xl overflow-hidden">
                <div className="bg-[#0f172a]/50 p-8 rounded-[22px]">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 space-y-6">
                            <div>
                                <h3 className="text-3xl font-black text-white mb-2">{activeOption.title}</h3>
                                <p className="text-lg text-slate-300">{activeOption.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Target Pace</p>
                                    <p className="text-2xl font-bold text-white">{activeOption.targetPace}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Intensity</p>
                                    <div className="flex gap-1 mt-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={`h-2 flex-1 rounded-full ${i <= activeOption.intensity
                                                ? (activeOption.intensity === 3 ? 'bg-rose-500' : activeOption.intensity === 2 ? 'bg-orange-500' : 'bg-emerald-500')
                                                : 'bg-slate-700'
                                                }`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {activeOption.intervals && (
                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap className="w-5 h-5 text-indigo-400" />
                                        <h4 className="font-bold text-indigo-100">Interval Structure</h4>
                                    </div>
                                    <div className="space-y-2 text-sm text-indigo-200">
                                        <p>• {activeOption.intervals.count} x Efforts @ <span className="text-white font-bold">{activeOption.intervals.work_pace}</span></p>
                                        <p>• Recovery between reps @ <span className="text-white font-bold">{activeOption.intervals.active_recovery_pace || "Easy Jog"}</span></p>
                                    </div>
                                </div>
                            )}

                            {activeOption.coachTip && (
                                <div className="flex gap-3 text-sm text-slate-400 italic bg-white/5 p-4 rounded-xl">
                                    <Sparkles className="w-5 h-5 text-[#f97415] flex-shrink-0" />
                                    "{activeOption.coachTip}"
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col justify-end">
                            <button
                                onClick={handleFinishedWorkout}
                                disabled={syncing}
                                className="w-full md:w-auto bg-[#f97415] hover:bg-orange-600 text-white font-black text-lg py-5 px-10 rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {syncing ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Syncing Activity...
                                    </>
                                ) : (
                                    <>
                                        <PlayCircle className="w-6 h-6" />
                                        Start Workout
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
