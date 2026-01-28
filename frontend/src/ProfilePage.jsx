import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config/api';
import { Target, Edit3, Zap, TrendingUp, Heart, Clock, ChevronRight } from 'lucide-react';
import GoalEditorModal from './GoalEditorModal';
import PlanCreatingLoader from './components/PlanCreatingLoader';

const ProfilePage = ({ user, activities }) => {
    const [showGoalEditor, setShowGoalEditor] = useState(false);
    const [currentGoal, setCurrentGoal] = useState(null);
    const [savingGoal, setSavingGoal] = useState(false);
    const [creatingPlan, setCreatingPlan] = useState(false);

    // Load goal from server on mount
    useEffect(() => {
        const fetchGoal = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/goals`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasGoal && data.goal) {
                        setCurrentGoal(data.goal);
                    }
                }
            } catch (err) {
                console.error('Failed to load goal:', err);
                // Fallback to localStorage
                const savedGoal = localStorage.getItem('trainingGoal');
                if (savedGoal) {
                    setCurrentGoal(JSON.parse(savedGoal));
                }
            }
        };
        fetchGoal();
    }, []);

    // Calculate weekly km from Sunday to Saturday
    const getWeeklyKm = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

        // Get start of week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        // Get end of week (Saturday)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Filter activities within this week and sum distance
        const weeklyDistance = (activities || []).reduce((total, activity) => {
            const activityDate = new Date(activity.start_date || activity.date);
            if (activityDate >= startOfWeek && activityDate <= endOfWeek) {
                return total + (activity.distance || 0);
            }
            return total;
        }, 0);

        return weeklyDistance / 1000; // Convert to km
    };

    const weeklyKm = getWeeklyKm();
    const weeklyGoalKm = currentGoal?.weeklyTarget || 40;
    const goalPercentage = Math.min(100, Math.round((weeklyKm / weeklyGoalKm) * 100));
    const remainingKm = Math.max(0, weeklyGoalKm - weeklyKm);

    // Stats for visualization
    const stats = {
        fitness: 78,
        fitnessTrend: 2.4,
        fatigue: 62
    };

    const handleSaveGoal = async (goalData) => {
        setSavingGoal(true);
        setCreatingPlan(true); // Show the loader immediately

        try {
            const goalPayload = {
                goalType: goalData.goalType,
                targetDate: goalData.targetDate || null,
                weeklyTarget: goalData.weeklyTarget,
                preferredDays: goalData.preferredDays
            };

            // Check if we have an existing goal to update or create new
            const method = currentGoal?.id ? 'PUT' : 'POST';
            const url = currentGoal?.id ? `${API_BASE_URL}/api/goals/${currentGoal.id}` : `${API_BASE_URL}/api/goals`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(goalPayload)
            });

            if (res.ok) {
                const data = await res.json();
                setCurrentGoal(data.goal);
                localStorage.setItem('trainingGoal', JSON.stringify(data.goal));

                // Now trigger the orchestrator to generate the plan with forceRegenerate
                try {
                    console.log('Triggering plan regeneration...');
                    const regenerateRes = await fetch(`${API_BASE_URL}/api/coach/regenerate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });

                    if (regenerateRes.ok) {
                        const result = await regenerateRes.json();
                        console.log('Plan generated successfully!', result);
                    } else {
                        console.warn('Plan regeneration failed, plan will generate on next view');
                    }
                } catch (regenerateErr) {
                    console.warn('Could not trigger plan regeneration:', regenerateErr);
                    // Plan will still generate when user views daily plan
                }
            } else {
                console.error('Failed to save goal to server');
                const goal = {
                    type: goalData.goalType,
                    targetDate: goalData.targetDate,
                    weeklyTarget: goalData.weeklyTarget,
                    preferredDays: goalData.preferredDays
                };
                setCurrentGoal(goal);
                localStorage.setItem('trainingGoal', JSON.stringify(goal));
            }
        } catch (err) {
            console.error('Error saving goal:', err);
            const goal = {
                type: goalData.goalType,
                targetDate: goalData.targetDate,
                weeklyTarget: goalData.weeklyTarget,
                preferredDays: goalData.preferredDays
            };
            setCurrentGoal(goal);
            localStorage.setItem('trainingGoal', JSON.stringify(goal));
        } finally {
            setSavingGoal(false);
            setCreatingPlan(false);
        }
    };

    // Get 3 most recent activities
    const recentActivities = (activities || []).slice(0, 3);

    const formatDaysUntil = (dateStr) => {
        if (!dateStr) return null;
        const targetDate = new Date(dateStr);
        const now = new Date();
        const diffTime = targetDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Past';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day';
        if (diffDays < 7) return `${diffDays} days`;
        return `${Math.ceil(diffDays / 7)} weeks`;
    };

    return (
        <div className="w-full min-h-screen bg-background-dark text-white flex flex-col pb-24">
            <main className="flex-1 p-5 pt-8 space-y-6">

                {/* Greeting */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-white">
                        Hello, <span className="text-primary">{user?.name?.split(' ')[0] || 'Athlete'}!</span>
                    </h1>
                </div>

                {/* Goal Section */}
                <section className="glass-card p-6 rounded-2xl">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Target className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Current Goal</h2>
                                <p className="text-xs text-white/40">
                                    {currentGoal ? currentGoal.type : 'No goal set'}
                                    {currentGoal?.targetDate && (
                                        <span className="ml-2 text-primary">• {formatDaysUntil(currentGoal.targetDate)} left</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGoalEditor(true)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <Edit3 className="w-4 h-4 text-white/60" />
                        </button>
                    </div>

                    {/* Weekly Progress */}
                    <div className="flex items-center gap-6">
                        <div className="relative w-20 h-20 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="3"
                                />
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="#f97415"
                                    strokeWidth="3"
                                    strokeDasharray={`${goalPercentage}, 100`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                {goalPercentage}%
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Weekly Progress</p>
                            <h3 className="text-3xl font-bold text-white tracking-tight">
                                {weeklyKm.toFixed(1)} <span className="text-base font-normal text-white/40">/ {weeklyGoalKm} km</span>
                            </h3>
                            <p className="text-primary text-xs font-semibold mt-1">
                                {remainingKm > 0 ? `${remainingKm.toFixed(1)} km to go` : '🎉 Goal reached!'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card p-5 rounded-xl border-l-4 border-l-primary">
                        <div className="flex justify-between items-start">
                            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Fitness Score</p>
                            <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-3xl font-bold text-white mt-2 tracking-tight">{stats.fitness}</p>
                        <p className="text-emerald-400 text-xs font-medium mt-1">+{stats.fitnessTrend} pts this week</p>
                    </div>
                    <div className="glass-card p-5 rounded-xl border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-start">
                            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Fatigue Level</p>
                            <Heart className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-3xl font-bold text-white mt-2 tracking-tight">{stats.fatigue}</p>
                        <p className="text-white/40 text-xs font-medium mt-1">Optimal Recovery Zone</p>
                    </div>
                </div>

                {/* Recent Activities Header */}
                <div className="flex items-center justify-between pt-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">Recent Activities</h2>
                    <span className="text-xs text-white/30">{recentActivities.length} shown</span>
                </div>

                {/* Activity Cards */}
                <div className="space-y-3">
                    {recentActivities.length > 0 ? recentActivities.map(activity => {
                        const dateStr = activity.start_date || activity.date;
                        const displayDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric'
                        }) : 'Unknown';
                        const distanceKm = activity.distance ? (activity.distance / 1000).toFixed(2) : '--';
                        const avgSpeed = activity.average_speed || 0;
                        const avgPace = avgSpeed > 0 ? `${Math.floor(16.6667 / avgSpeed)}:${Math.round((16.6667 / avgSpeed % 1) * 60).toString().padStart(2, '0')}` : '--';
                        const movingTime = activity.moving_time || 0;
                        const duration = movingTime > 0 ? `${Math.floor(movingTime / 60)}:${(movingTime % 60).toString().padStart(2, '0')}` : '--';
                        const avgHr = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;

                        return (
                            <div
                                key={activity.id}
                                className="glass-card rounded-xl overflow-hidden hover:border-primary/30 transition-all group cursor-pointer"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                <Zap className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                                                    {activity.name}
                                                </h4>
                                                <p className="text-xs text-white/40">{displayDate}</p>
                                            </div>
                                        </div>

                                        {/* Effort Badge */}
                                        {activity.relativeEffort && (
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase flex-shrink-0 ${activity.relativeEffort.toLowerCase() === 'low' ? 'bg-emerald-500/20 text-emerald-400' :
                                                activity.relativeEffort.toLowerCase() === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {activity.relativeEffort}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/5">
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase font-medium">Distance</p>
                                            <p className="text-sm font-bold text-white">{distanceKm}<span className="text-xs text-white/40 ml-0.5">km</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase font-medium">Time</p>
                                            <p className="text-sm font-bold text-white">{duration}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase font-medium">Pace</p>
                                            <p className="text-sm font-bold text-primary">{avgPace}<span className="text-xs text-white/40 ml-0.5">/km</span></p>
                                        </div>
                                        {avgHr && (
                                            <div>
                                                <p className="text-[10px] text-white/40 uppercase font-medium">Avg HR</p>
                                                <p className="text-sm font-bold text-rose-400">{avgHr}<span className="text-xs text-white/40 ml-0.5">bpm</span></p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="glass-card rounded-xl p-8 text-center">
                            <Zap className="w-8 h-8 text-white/20 mx-auto mb-3" />
                            <p className="text-white/40 text-sm">No recent activities found</p>
                            <p className="text-white/20 text-xs mt-1">Sync with Strava to see your workouts</p>
                        </div>
                    )}
                </div>

            </main>

            {/* Goal Editor Modal */}
            <GoalEditorModal
                isOpen={showGoalEditor}
                onClose={() => setShowGoalEditor(false)}
                existingGoal={currentGoal}
                onSave={handleSaveGoal}
            />

            {/* Plan Creating Loader */}
            <PlanCreatingLoader
                isVisible={creatingPlan}
                message="Your plan is now being created"
            />
        </div>
    );
};

export default ProfilePage;
