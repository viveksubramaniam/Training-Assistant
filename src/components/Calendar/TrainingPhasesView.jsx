import React from 'react';

const TrainingPhasesView = ({ masterPlan }) => {
    if (!masterPlan || !masterPlan.weeks) return <p className="text-center text-slate-500 mt-10">No plan data available.</p>;

    const currentWeek = masterPlan.currentWeek || 1;

    return (
        <div className="space-y-4 pb-20 mt-4 font-display">
            {masterPlan.weeks.map((week, idx) => {
                const isActive = currentWeek === week.week;
                const isCompleted = currentWeek > week.week;

                return (
                    <div key={idx} className={`relative pl-5 border-l-2 ${isActive ? 'border-[#f97415]' : isCompleted ? 'border-emerald-500' : 'border-slate-700'}`}>
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[9px] top-6 w-4 h-4 rounded-full border-2 ${isActive ? 'bg-[#f97415] border-[#0f172a]' : isCompleted ? 'bg-emerald-500 border-[#0f172a]' : 'bg-slate-800 border-slate-600'
                            }`}></div>

                        <div className={`glass-card p-3 rounded-xl border ${isActive ? 'border-[#f97415]/30' : 'border-white/5'} ${isCompleted ? 'opacity-70' : ''}`}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className={`text-sm font-bold font-mono ${isCompleted ? 'text-emerald-500' : isActive ? 'text-[#f97415]' : 'text-white'}`}>
                                    Week {week.week}
                                </h3>
                                {(isActive || isCompleted) && (
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isActive ? 'bg-[#f97415]/20 text-[#f97415]' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                        {isActive ? 'Current' : 'Done'}
                                    </span>
                                )}
                            </div>

                            <div className="mb-2">
                                <h4 className="text-xs font-bold text-white mb-0.5">{week.focus || week.theme}</h4>
                                <p className="text-[10px] text-slate-400 leading-tight">{week.theme}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-1">
                                <div className="text-center p-1">
                                    <span className="material-symbols-outlined text-slate-400 text-[10px] block mb-0.5">sports_score</span>
                                    <span className="text-[10px] font-bold text-white">{week.targetKm}km</span>
                                </div>
                                <div className="text-center p-1">
                                    <span className="material-symbols-outlined text-slate-400 text-[10px] block mb-0.5">sprint</span>
                                    <span className="text-[10px] font-bold text-white">{week.numWorkouts || 5}</span>
                                </div>
                                <div className="text-center p-1">
                                    <span className="material-symbols-outlined text-emerald-500 text-[10px] block mb-0.5 rotate-90">battery_0_bar</span>
                                    <span className="text-[10px] font-bold text-white">{week.numRestDays || 2}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Race Day Node */}
            <div className="relative pl-8 border-l-2 border-slate-700 pb-2">
                <div className="absolute -left-[11px] top-0 w-6 h-6 rounded-full bg-white border-4 border-[#0f172a] flex items-center justify-center">
                    <span className="material-symbols-outlined text-black text-xs">flag</span>
                </div>
                <div className="glass-card p-5 rounded-xl border border-white/10 bg-gradient-to-r from-slate-800 to-slate-900">
                    <h3 className="text-xl font-black italic text-white uppercase">Race Day</h3>
                    <p className="text-sm text-slate-400">The big event. You are ready.</p>
                </div>
            </div>
        </div>
    );
};

export default TrainingPhasesView;
