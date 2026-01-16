import React, { useState, useEffect, useRef } from 'react';
import { Flame, Target, Sparkles, ChevronRight, Send, Calendar, BarChart3, Smile, Meh, Frown, RefreshCw, CheckCircle, Trophy, ExternalLink } from 'lucide-react';

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
    const [completedWorkout, setCompletedWorkout] = useState(null); // Matched activity after sync
    const [pointsEarned, setPointsEarned] = useState(0);

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    // Fetch data on mount
    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [dailyRes, weeklyRes, streakRes, goalRes] = await Promise.all([
                fetch('/api/coach/daily-plan', { credentials: 'include' }),
                fetch('/api/coach/weekly-plan', { credentials: 'include' }),
                fetch('/api/coach/streak', { credentials: 'include' }),
                fetch('/api/goals', { credentials: 'include' })
            ]);

            if (dailyRes.ok) setDailyPlan(await dailyRes.json());
            if (weeklyRes.ok) setWeeklyPlan(await weeklyRes.json());
            if (streakRes.ok) {
                const data = await streakRes.json();
                setStreak(data.streakDays || 0);
            }
            if (goalRes.ok) setGoal(await goalRes.json());
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        }
        setLoading(false);
    };

    // Sync activities and check if workout completed
    const handleFinishedWorkout = async () => {
        setSyncing(true);
        try {
            // Trigger activity sync
            const syncRes = await fetch('/api/activities/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fullSync: false })
            });

            if (syncRes.ok) {
                // Fetch latest activities to check for match
                const activitiesRes = await fetch('/api/activities?limit=5', { credentials: 'include' });
                if (activitiesRes.ok) {
                    const activities = await activitiesRes.json();

                    // Check if any recent activity matches recommended workout
                    const today = new Date().toISOString().split('T')[0];
                    const todayActivity = activities.find(a => {
                        const actDate = new Date(a.start_date).toISOString().split('T')[0];
                        return actDate === today;
                    });

                    if (todayActivity) {
                        // Calculate points (simple: 10 base + distance bonus)
                        const distance = todayActivity.distance / 1000;
                        const points = Math.round(10 + distance * 2);
                        setPointsEarned(points);
                        setCompletedWorkout(todayActivity);
                    }
                }
                // Refresh dashboard data
                await fetchDashboardData();
            }
        } catch (err) {
            console.error('Sync failed:', err);
        }
        setSyncing(false);
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const res = await fetch('/api/coach/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: userMessage })
            });

            if (res.ok) {
                const data = await res.json();
                setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

                // If plan was updated, refresh
                if (data.planUpdate) {
                    fetchDashboardData();
                }
            }
        } catch (err) {
            console.error('Chat failed:', err);
        }
        setChatLoading(false);
    };

    // Only scroll chat when user sends a message (not on page load)
    useEffect(() => {
        if (chatMessages.length > 0) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [chatMessages]);

    const firstName = user?.name?.split(' ')[0] || 'Athlete';

    // Dummy data for initial display
    const dummyDailyPlan = dailyPlan || {
        recommended: {
            type: 'Moderate Steady Run',
            intensity: 2,
            intensityLabel: 'Aerobic Base',
            description: 'Focus on consistent breathing and a stable heart rate. This session builds the foundation for your next race.',
            targetPace: '5:15 - 5:30 /km',
            estimatedDistance: 8.5,
            estimatedDuration: 45,
            coachTip: "Your last hard session was 3 days ago - you're well rested for this."
        },
        alternatives: [
            { type: 'Active Recovery', intensity: 1, estimatedDuration: 25, targetPace: 'Easy' },
            { type: 'Threshold Intervals', intensity: 3, estimatedDuration: 60, targetPace: '4:20 /km' }
        ],
        weeklyPoints: { earned: 42, goal: 60 }
    };

    const dummyWeeklyPlan = weeklyPlan || {
        days: [
            { dayName: 'Mon', workout: 'Easy Run', intensity: 1, distance: 6 },
            { dayName: 'Tue', workout: 'Tempo', intensity: 3, distance: 8 },
            { dayName: 'Wed', workout: 'Recovery', intensity: 1, distance: 4 },
            { dayName: 'Thu', workout: 'Hills', intensity: 3, distance: 7 },
            { dayName: 'Fri', workout: 'Rest', intensity: 0, distance: 0 },
            { dayName: 'Sat', workout: 'Long Run', intensity: 2, distance: 15 },
            { dayName: 'Sun', workout: 'Recovery', intensity: 1, distance: 3 }
        ]
    };

    const dummyGoal = goal?.hasGoal ? goal.goal : { type: 'Half Marathon', targetDate: '2026-03-15' };

    const getIntensityColor = (intensity) => {
        if (intensity === 0) return 'text-slate-500';
        if (intensity === 1) return 'text-emerald-500';
        if (intensity === 2) return 'text-orange-500';
        return 'text-rose-500';
    };

    const getIntensityBg = (intensity) => {
        if (intensity === 0) return 'bg-slate-500/20';
        if (intensity === 1) return 'bg-emerald-500/20';
        if (intensity === 2) return 'bg-orange-500/20';
        return 'bg-rose-500/20';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
            {/* Header with Streak and Goal */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    {streak > 0 && (
                        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-full">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <span className="text-sm font-bold text-orange-500">{streak} DAY STREAK</span>
                        </div>
                    )}
                    {dummyGoal && (
                        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full cursor-pointer hover:bg-indigo-500/20">
                            <Target className="w-5 h-5 text-indigo-400" />
                            <span className="text-sm font-bold text-indigo-400">
                                {dummyGoal.type} {dummyGoal.targetDate ? `• ${new Date(dummyGoal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Greeting Section */}
            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                            {getGreeting()}, <span className="text-[#f97415]">{firstName}!</span>
                        </h2>
                        <p className="text-lg font-medium text-slate-400 mt-2">
                            Ready to crush it? Let's see how we're fueling the engine today.
                        </p>
                    </div>

                    {/* Mood Selector */}
                    <div className="glass-card bg-white/5 p-4 rounded-2xl min-w-[300px]">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                            How are you feeling today?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedMood('energized')}
                                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${selectedMood === 'energized'
                                    ? 'bg-emerald-500/30 border-2 border-emerald-500'
                                    : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                                    }`}
                            >
                                <Smile className="w-6 h-6 text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-500 uppercase">Energized</span>
                            </button>
                            <button
                                onClick={() => setSelectedMood('okay')}
                                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${selectedMood === 'okay'
                                    ? 'bg-orange-500/30 border-2 border-orange-500'
                                    : 'bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20'
                                    }`}
                            >
                                <Meh className="w-6 h-6 text-orange-500" />
                                <span className="text-[10px] font-bold text-orange-500 uppercase">Okay</span>
                            </button>
                            <button
                                onClick={() => setSelectedMood('tired')}
                                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${selectedMood === 'tired'
                                    ? 'bg-rose-500/30 border-2 border-rose-500'
                                    : 'bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20'
                                    }`}
                            >
                                <Frown className="w-6 h-6 text-rose-500" />
                                <span className="text-[10px] font-bold text-rose-500 uppercase">Tired</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recommended Workout Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-[#f97415]" />
                    <h3 className="text-2xl font-bold text-white">Today's Recommended Workout</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Hero Card */}
                    <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 shadow-xl">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                        <div className="relative p-8 min-h-[380px] flex flex-col justify-end">
                            <div className="absolute top-6 left-6">
                                <span className="bg-[#f97415] text-white text-xs font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                                    <Sparkles className="w-4 h-4" />
                                    COACH RECOMMENDED
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <span className="text-[#f97415] font-bold tracking-widest uppercase text-sm">
                                        Intensity {dummyDailyPlan.recommended.intensity} • {dummyDailyPlan.recommended.intensityLabel}
                                    </span>
                                    <h4 className="text-4xl font-black text-white mt-2">{dummyDailyPlan.recommended.type}</h4>
                                    <p className="text-lg text-slate-200 mt-3 opacity-90">{dummyDailyPlan.recommended.description}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4 border-y border-white/10 py-5">
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Target Pace</span>
                                        <span className="block text-2xl font-bold text-white">{dummyDailyPlan.recommended.targetPace}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Distance</span>
                                        <span className="block text-2xl font-bold text-white">{dummyDailyPlan.recommended.estimatedDistance} <span className="text-sm opacity-50">km</span></span>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Duration</span>
                                        <span className="block text-2xl font-bold text-white">{dummyDailyPlan.recommended.estimatedDuration} <span className="text-sm opacity-50">min</span></span>
                                    </div>
                                </div>

                                {/* Show completion card or action button */}
                                {completedWorkout ? (
                                    <div className="space-y-6">
                                        {/* Session Completed Banner */}
                                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/30">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-widest">Session Completed</span>
                                        </div>

                                        {/* Workout Complete Header */}
                                        <div className="space-y-2">
                                            <h3 className="text-4xl font-black text-white leading-tight">Workout Complete!</h3>
                                            <p className="text-lg text-slate-300 font-medium">
                                                Great effort today! You stayed consistent and showed discipline.
                                            </p>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-5 border-y border-white/10 font-mono">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Distance</p>
                                                <p className="text-3xl font-extrabold text-white">
                                                    {(completedWorkout.distance / 1000).toFixed(2)}
                                                    <span className="text-sm font-normal text-slate-400 ml-1">km</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Time</p>
                                                <p className="text-3xl font-extrabold text-white">
                                                    {Math.floor(completedWorkout.moving_time / 60)}:{String(completedWorkout.moving_time % 60).padStart(2, '0')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Avg Pace</p>
                                                <p className="text-3xl font-extrabold text-white">
                                                    {completedWorkout.distance > 0 ? (() => {
                                                        const paceSeconds = completedWorkout.moving_time / (completedWorkout.distance / 1000);
                                                        return `${Math.floor(paceSeconds / 60)}:${String(Math.floor(paceSeconds % 60)).padStart(2, '0')}`;
                                                    })() : 'N/A'}
                                                    <span className="text-sm font-normal text-slate-400 ml-1">/km</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-[#f97415] uppercase tracking-widest mb-1">Perf. Pts</p>
                                                <p className="text-3xl font-extrabold text-[#f97415]">+{pointsEarned}</p>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => window.dispatchEvent(new CustomEvent('viewActivity', { detail: completedWorkout }))}
                                                className="bg-white text-slate-900 hover:bg-slate-200 font-black py-4 px-8 rounded-2xl transition-all shadow-xl active:scale-95 text-base uppercase tracking-tight"
                                            >
                                                View Deep Analysis
                                            </button>
                                            <button
                                                onClick={handleFinishedWorkout}
                                                className="flex items-center gap-2 p-4 rounded-2xl border border-white/20 text-white hover:bg-white/10 transition-colors"
                                            >
                                                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                                                <span className="font-bold text-sm">Refresh</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleFinishedWorkout}
                                        disabled={syncing}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 text-lg flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {syncing ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                Syncing...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-5 h-5" />
                                                I've Finished My Workout
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Alternative Workouts */}
                    <div className="flex flex-col gap-4">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Alternative Intensities</p>

                        {dummyDailyPlan.alternatives.map((alt, idx) => (
                            <div
                                key={idx}
                                className="glass-card bg-white/5 p-5 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl ${getIntensityBg(alt.intensity)} flex items-center justify-center`}>
                                        <span className={`text-2xl font-bold ${getIntensityColor(alt.intensity)}`}>{alt.intensity}</span>
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-bold ${getIntensityColor(alt.intensity)} uppercase tracking-widest`}>
                                            Intensity {alt.intensity}
                                        </p>
                                        <h5 className="font-bold text-white">{alt.type}</h5>
                                        <p className="text-xs text-slate-400">{alt.estimatedDuration} min • {alt.targetPace}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                            </div>
                        ))}

                        {/* Coach Tip */}
                        <div className="mt-auto bg-indigo-950/50 p-5 rounded-2xl border border-indigo-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-300 uppercase">Coach's Tip</span>
                            </div>
                            <p className="text-xs text-indigo-100 leading-relaxed italic">
                                "{dummyDailyPlan.recommended.coachTip}"
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Coach Chat & Weekly Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Coach Chat */}
                <section className="lg:col-span-8 space-y-4">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-[#f97415]" />
                        <h3 className="text-2xl font-bold text-white">Coach Insight</h3>
                    </div>

                    <div className="glass-card bg-white/5 rounded-3xl p-6 border border-white/10 min-h-[300px] flex flex-col">
                        <div className="flex-1 space-y-4 mb-4 overflow-y-auto max-h-[250px]">
                            {chatMessages.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">
                                    Ask your coach anything about today's workout...
                                </p>
                            ) : (
                                chatMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-3'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-indigo-300" />
                                            </div>
                                        )}
                                        <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.role === 'user'
                                            ? 'bg-slate-700/50 text-slate-200 rounded-tr-none'
                                            : 'bg-indigo-900/50 text-indigo-100 rounded-tl-none'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {chatLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-indigo-900/50 text-indigo-300">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Ask your coach..."
                                className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#f97415]/50"
                            />
                            <button
                                onClick={sendChatMessage}
                                className="bg-[#f97415] hover:bg-orange-600 text-white p-3 rounded-xl transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Weekly Tracker */}
                <aside className="lg:col-span-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-[#f97415]" />
                        <h3 className="text-2xl font-bold text-white">Weekly Tracker</h3>
                    </div>

                    <div className="glass-card bg-white/5 rounded-3xl p-6 border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Weekly Goal</p>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-4xl font-black text-[#f97415]">{dummyDailyPlan.weeklyPoints.earned}</span>
                                    <span className="text-xl font-bold text-slate-500">/ {dummyDailyPlan.weeklyPoints.goal}</span>
                                    <span className="text-xs font-bold ml-1 text-slate-400">pts</span>
                                </div>
                            </div>
                            <div className="relative w-20 h-20">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                                    <circle
                                        cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6"
                                        className="text-[#f97415]"
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 35}
                                        strokeDashoffset={2 * Math.PI * 35 * (1 - dummyDailyPlan.weeklyPoints.earned / dummyDailyPlan.weeklyPoints.goal)}
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">
                                    {Math.round((dummyDailyPlan.weeklyPoints.earned / dummyDailyPlan.weeklyPoints.goal) * 100)}%
                                </span>
                            </div>
                        </div>

                        {/* Weekly Bar Chart */}
                        <div className="flex items-end justify-between gap-2 h-32 mb-4">
                            {dummyWeeklyPlan.days.map((day, idx) => {
                                const height = day.intensity === 0 ? 10 : (day.intensity * 30 + 10);
                                const isToday = idx === new Date().getDay() - 1;
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className={`w-full rounded-xl transition-all ${day.intensity === 0
                                                ? 'bg-white/5 border border-white/10 border-dashed'
                                                : 'bg-gradient-to-t from-orange-600 to-[#f97415]'
                                                }`}
                                            style={{ height: `${height}%` }}
                                        />
                                        <span className={`text-[10px] font-black uppercase ${isToday ? 'text-[#f97415]' : 'text-slate-500'}`}>
                                            {day.dayName.charAt(0)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Upcoming Week Preview */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-[#f97415]" />
                        <h3 className="text-2xl font-bold text-white">The Road Ahead</h3>
                    </div>
                    <button
                        onClick={onNavigateToCalendar}
                        className="text-sm font-bold text-[#f97415] hover:underline"
                    >
                        View Full Calendar
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {dummyWeeklyPlan.days.slice(1, 5).map((day, idx) => (
                        <div
                            key={idx}
                            className={`glass-card bg-white/5 p-5 rounded-2xl border-l-4 ${day.intensity === 0 ? 'border-slate-500' :
                                day.intensity === 1 ? 'border-emerald-500' :
                                    day.intensity === 2 ? 'border-orange-500' : 'border-rose-500'
                                }`}
                        >
                            <p className={`text-xs font-black uppercase tracking-widest ${idx === 0 ? 'text-[#f97415]' : 'text-slate-400'
                                }`}>
                                {idx === 0 ? 'Tomorrow' : day.dayName}
                            </p>
                            <h4 className="text-lg font-bold mt-2 text-white">{day.workout}</h4>
                            <p className="text-sm text-slate-400 mt-1">
                                {day.distance > 0 ? `${day.distance} km` : 'Rest & Recovery'}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
