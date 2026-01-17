
import React from 'react';
import {
    CheckCircle,
    Zap,
    Clock,
    Activity,
    Flame
} from 'lucide-react';

const DetailedWeekView = ({ weeklyPlan }) => {
    if (!weeklyPlan || !weeklyPlan.days) return <div className="text-slate-400">Loading weekly plan...</div>;

    const getDayStatus = (dateStr) => {
        const today = new Date().toISOString().split('T')[0];
        if (dateStr < today) return 'past';
        if (dateStr === today) return 'current';
        return 'future';
    };

    const getTypeColor = (type) => {
        const t = (type || "").toLowerCase();
        if (t.includes('rest')) return 'text-slate-500';
        if (t.includes('recovery')) return 'text-emerald-400';
        if (t.includes('long')) return 'text-purple-400';
        if (t.includes('tempo') || t.includes('threshold')) return 'text-amber-400';
        if (t.includes('interval') || t.includes('speed') || t.includes('vo2')) return 'text-rose-400';
        return 'text-[#f97415]'; // Default primary
    };

    // Map intensity (0-3) to RPE (0-10)
    const getIntensityRPE = (intensity) => {
        switch (intensity) {
            case 0: return null; // Rest
            case 1: return 3;    // Easy
            case 2: return 6;    // Moderate/Long
            case 3: return 8;    // Hard
            default: return 5;
        }
    };

    return (
        <div className="grid grid-cols-7 gap-4 h-[420px] animate-in fade-in zoom-in-95 duration-500">
            {weeklyPlan.days.slice(0, 7).map((day) => {
                const status = getDayStatus(day.date);
                const dateObj = new Date(day.date);
                const dayNumber = dateObj.getDate();

                const isRest = (day.workout_type || '').toLowerCase().includes('rest');
                const isCurrent = status === 'current';
                const rpe = getIntensityRPE(day.intensity);

                return (
                    <div
                        key={day.date}
                        className={`
                            glass-panel rounded-xl p-4 flex flex-col gap-3 group transition-all relative overflow-hidden
                            ${isCurrent
                                ? 'active-day-glow bg-slate-800/80'
                                : isRest
                                    ? 'opacity-80 hover:opacity-100 hover:bg-slate-800/60'
                                    : 'hover:bg-slate-800/80'
                            }
                        `}
                    >
                        {/* Header: Day + Status */}
                        <div className="flex justify-between items-start">
                            <span className={`text-xs font-mono font-bold ${isCurrent ? 'text-[#f97415]' : 'text-slate-500'}`}>
                                {(day.dayName || '').substring(0, 3).toUpperCase()} {dayNumber}
                            </span>
                            {status === 'past' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {isCurrent && <span className="w-2 h-2 bg-[#f97415] rounded-full animate-pulse shadow-[0_0_8px_#f97415]"></span>}
                        </div>

                        {/* Workout Type Badge + Title */}
                        <div className="flex-1 flex flex-col">
                            <p className={`text-[10px] font-bold uppercase tracking-tight mb-1 ${getTypeColor(day.workout_type)}`}>
                                {day.workout_type || 'Workout'}
                            </p>
                            <h4 className={`font-bold text-sm leading-tight ${isRest ? 'text-slate-400' : 'text-white'}`}>
                                {day.title}
                            </h4>

                            {/* Distance - Bold and Prominent */}
                            <div className="mt-3">
                                {!isRest && day.distance > 0 ? (
                                    <div className="font-mono text-2xl font-black text-white tracking-tight">
                                        {day.distance}<span className="text-xs ml-1 text-slate-500 font-normal">KM</span>
                                    </div>
                                ) : (
                                    <div className="font-mono text-2xl font-black text-slate-600 tracking-tight">
                                        --<span className="text-xs ml-1 font-normal">KM</span>
                                    </div>
                                )}
                            </div>

                            {/* Pace - Full display */}
                            {!isRest && day.target_pace && (
                                <div className="mt-1.5 font-mono text-xs text-slate-300">
                                    Target: <span className="text-[#f97415] font-bold">{day.target_pace}</span>
                                </div>
                            )}

                            {/* Time */}
                            {!isRest && day.target_time && (
                                <div className="mt-1 font-mono text-[10px] text-slate-500">
                                    {day.target_time}
                                </div>
                            )}
                        </div>

                        {/* Footer: RPE / Interval Details / Description */}
                        {!isRest && (
                            <div className="pt-3 border-t border-white/5">
                                {day.intervals ? (
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="w-3 h-3 text-[#f97415]" />
                                        <span className="text-[10px] text-white font-medium">
                                            {day.intervals.count}x @ {day.intervals.work_pace}/km
                                        </span>
                                    </div>
                                ) : rpe !== null ? (
                                    <div className="flex items-center gap-1.5">
                                        <Flame className="w-3 h-3 text-orange-400" />
                                        <span className="text-[10px] text-slate-400">RPE: {rpe}/10</span>
                                    </div>
                                ) : day.description ? (
                                    <div className="flex items-center gap-1.5">
                                        <Activity className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] text-slate-400 line-clamp-2">
                                            {day.description}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* Rest Day Footer */}
                        {isRest && day.description && (
                            <div className="pt-2 text-[10px] text-slate-500 italic">
                                {day.description}
                            </div>
                        )}
                    </div>
                );
            })}

            <style jsx="true">{`
                .active-day-glow {
                    box-shadow: 0 0 15px rgba(249, 116, 21, 0.2);
                    border: 1px solid #f97415;
                }
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
};

export default DetailedWeekView;
