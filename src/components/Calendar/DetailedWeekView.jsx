import React from 'react';
import { CheckCircle, Circle, Clock, MapPin, Zap, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

const DetailedWeekView = ({ weeklyPlan }) => {
    if (!weeklyPlan) return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <p>Loading week details...</p>
        </div>
    );

    const days = weeklyPlan.days || [];
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-4 pb-20">
            {/* Weekly Summary Card */}
            <div className="glass-card p-4 rounded-xl flex justify-between items-center mb-6">
                <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Weekly Goal</p>
                    <p className="text-2xl font-black italic text-white">{weeklyPlan.totalDistance || 0}<span className="text-sm not-italic ml-1 text-slate-500 font-medium">km</span></p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Completed</p>
                    <p className="text-2xl font-black italic text-[#f97415]">{weeklyPlan.completedDistance || 0}<span className="text-sm not-italic ml-1 text-slate-500 font-medium">km</span></p>
                </div>
            </div>

            {/* Days List */}
            <div className="space-y-3">
                {days.map((day, idx) => {
                    const isToday = day.date === today;
                    const isCompleted = day.status === 'completed';
                    const isRest = day.type === 'Rest';

                    return (
                        <div
                            key={idx}
                            className={`relative overflow-hidden rounded-xl transition-all ${isToday ? 'bg-white/10 border border-[#f97415]/50 shadow-[0_0_15px_rgba(249,116,21,0.15)]' : 'bg-white/5 border border-white/5'
                                } ${isCompleted ? 'opacity-60' : 'opacity-100'}`}
                        >
                            {isToday && <div className="absolute top-0 left-0 w-1 h-full bg-[#f97415]"></div>}

                            <div className="p-4 flex gap-4">
                                {/* Date Column */}
                                <div className="flex flex-col items-center justify-center min-w-[50px] border-r border-white/5 pr-4">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    <span className={`text-xl font-black ${isToday ? 'text-[#f97415]' : 'text-white'}`}>
                                        {new Date(day.date).getDate()}
                                    </span>
                                </div>

                                {/* Content Column */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold ${isRest ? 'text-slate-500' : 'text-white'}`}>{day.title || day.type}</h4>
                                        {isCompleted ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        ) : isRest ? (
                                            <span className="text-[10px] font-bold uppercase bg-slate-800 text-slate-500 px-2 py-1 rounded">Rest</span>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-slate-700"></div>
                                        )}
                                    </div>

                                    {!isRest && (
                                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                            <div className="flex items-center gap-1">
                                                <Zap className="w-3 h-3 text-[#f97415]" />
                                                {day.distance}km
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {day.duration}min
                                            </div>
                                        </div>
                                    )}

                                    {day.description && !isRest && (
                                        <p className="text-xs text-slate-500 mt-2 bg-black/20 p-2 rounded line-clamp-2">
                                            {day.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DetailedWeekView;
