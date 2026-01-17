
import React from 'react';
import { Layers, ChevronRight } from 'lucide-react';

const TrainingPhasesView = ({ masterPlan }) => {
    if (!masterPlan || !masterPlan.weeks) return <div className="text-slate-400">No phase data available.</div>;

    // Group weeks by phase
    const phases = [];
    let currentPhase = null;

    masterPlan.weeks.forEach(week => {
        const phaseName = week.phase || week.theme || "General";

        if (!currentPhase || currentPhase.name !== phaseName) {
            if (currentPhase) phases.push(currentPhase);
            currentPhase = {
                name: phaseName,
                description: week.phaseDescription || week.focus || "Training Block",
                weeks: [week],
                startWeek: week.week
            };
        } else {
            currentPhase.weeks.push(week);
        }
    });
    if (currentPhase) phases.push(currentPhase);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {phases.map((phase, idx) => {
                const isCurrentPhase = phase.weeks.some(w => w.week === masterPlan.currentWeek);

                return (
                    <div key={idx} className={`relative pl-8 ${isCurrentPhase ? 'opacity-100' : 'opacity-70 hover:opacity-100 transition-opacity'}`}>
                        {/* Timeline Line */}
                        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isCurrentPhase ? 'bg-[#f97415]' : 'bg-slate-700'}`}></div>
                        {/* Timeline Dot */}
                        <div className={`absolute left-[-5px] top-0 w-3 h-3 rounded-full border-2 ${isCurrentPhase ? 'bg-[#f97415] border-[#f97415]' : 'bg-slate-900 border-slate-700'}`}></div>

                        <div className="glass-panel rounded-xl p-6 border border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className={`text-xl font-bold font-display uppercase tracking-tight ${isCurrentPhase ? 'text-white' : 'text-slate-400'}`}>
                                        {phase.name}
                                    </h3>
                                    <p className="text-sm text-slate-400 mt-1">{phase.description}</p>
                                </div>
                                {isCurrentPhase && (
                                    <span className="text-[10px] font-bold bg-[#f97415]/20 text-[#f97415] px-3 py-1 rounded-full uppercase border border-[#f97415]/30">
                                        Active Phase
                                    </span>
                                )}
                            </div>

                            {/* Weeks Grid */}
                            <div className="grid grid-cols-4 gap-4">
                                {phase.weeks.map(week => {
                                    const isCurrent = week.week === masterPlan.currentWeek;
                                    const isPast = week.week < masterPlan.currentWeek;

                                    return (
                                        <div key={week.week} className={`
                           bg-slate-900/50 rounded-lg p-3 border 
                           ${isCurrent ? 'border-[#f97415]' : 'border-white/5'}
                        `}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-mono text-slate-500">WEEK {week.week}</span>
                                                {isPast && <span className="text-emerald-500 text-[10px]">✓</span>}
                                            </div>
                                            <div className="text-xs font-bold text-slate-300">{week.focus}</div>
                                            <div className="mt-2 text-[10px] text-slate-500 font-mono">{week.targetKm} km</div>
                                            {week.keyWorkout && (
                                                <div className="mt-1 text-[10px] text-[#f97415] truncate" title={week.keyWorkout}>
                                                    ★ {week.keyWorkout}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TrainingPhasesView;
