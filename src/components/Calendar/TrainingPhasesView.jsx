import React from 'react';

const TrainingPhasesView = ({ masterPlan }) => {
    if (!masterPlan || !masterPlan.weeks) return <p className="text-center text-slate-500 mt-10">No plan data available.</p>;

    // Group weeks by phase
    // Assuming weeks have 'phase' property
    const phases = [];
    let currentPhase = null;

    masterPlan.weeks.forEach(week => {
        if (!currentPhase || currentPhase.name !== week.phase) {
            if (currentPhase) phases.push(currentPhase);
            currentPhase = {
                name: week.phase || 'Base Training',
                startWeek: week.week,
                endWeek: week.week,
                description: week.phaseDescription || 'Building aerobic foundation',
                goal: week.focus || 'Improve endurance',
                weeks: [week]
            };
        } else {
            currentPhase.endWeek = week.week;
            currentPhase.weeks.push(week);
        }
    });
    if (currentPhase) phases.push(currentPhase);

    const currentWeek = masterPlan.currentWeek || 1;

    return (
        <div className="space-y-6 pb-20 mt-4 font-display">
            {phases.map((phase, idx) => {
                const isActive = currentWeek >= phase.startWeek && currentWeek <= phase.endWeek;
                const isCompleted = currentWeek > phase.endWeek;

                return (
                    <div key={idx} className={`relative pl-8 border-l-2 ${isActive ? 'border-[#f97415]' : isCompleted ? 'border-emerald-500' : 'border-slate-700'}`}>
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isActive ? 'bg-[#f97415] border-[#0f172a]' : isCompleted ? 'bg-emerald-500 border-[#0f172a]' : 'bg-slate-800 border-slate-600'
                            }`}></div>

                        <div className={`glass-card p-5 rounded-xl border ${isActive ? 'border-[#f97415]/30' : 'border-white/5'} ${isCompleted ? 'opacity-70' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className={`text-lg font-bold ${isCompleted ? 'text-emerald-500' : isActive ? 'text-[#f97415]' : 'text-white'}`}>
                                        {phase.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-mono">Weeks {phase.startWeek} - {phase.endWeek}</p>
                                </div>
                                {isActive && <span className="text-[10px] font-bold uppercase bg-[#f97415]/20 text-[#f97415] px-2 py-1 rounded">Current</span>}
                                {isCompleted && <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded">Done</span>}
                            </div>

                            <p className="text-sm text-slate-300 mb-4">{phase.description}</p>

                            <div className="bg-black/20 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">bolt</span>
                                    <span className="text-xs font-bold uppercase text-slate-400">Key Focus</span>
                                </div>
                                <p className="text-xs text-slate-300 italic">"{phase.goal || 'Follow the plan to improve performance'}"</p>
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
