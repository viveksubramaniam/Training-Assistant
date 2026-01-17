
import React from 'react';
import { ChevronRight } from 'lucide-react';

const MonthView = ({ masterPlan }) => {
    if (!masterPlan || !masterPlan.weeks) return <div className="text-slate-400">No plan data available.</div>;

    return (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {masterPlan.weeks.map((week) => {
                const isPast = week.week < masterPlan.currentWeek;
                const isCurrent = week.week === masterPlan.currentWeek;
                // Phase logic: use data if available, or fallback
                const phaseName = week.phase || week.theme || `Week ${week.week}`;
                const phaseDesc = week.phaseDescription || week.focus || "Standard Training";

                return (
                    <div
                        key={week.week}
                        className={`h-16 border rounded-xl flex items-center px-6 transition-all group relative overflow-hidden
              ${isCurrent
                                ? 'bg-slate-800/80 border-[#f97415] shadow-[0_0_15px_rgba(249,116,21,0.2)]'
                                : isPast
                                    ? 'bg-slate-900/40 border-white/5 opacity-60 hover:opacity-100'
                                    : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'
                            }
            `}
                    >
                        {/* Progress Bar Background for Past Weeks? Optional aesthetic */}
                        {isPast && (
                            <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 w-full"></div>
                        )}

                        <div className="flex items-center gap-6 w-full z-10">
                            <span className={`text-xs font-mono w-16 ${isCurrent ? 'text-[#f97415] font-bold' : 'text-slate-500'}`}>
                                WEEK {String(week.week).padStart(2, '0')}
                            </span>

                            <div className="flex-1 flex flex-col justify-center">
                                <span className={`text-xs font-bold uppercase tracking-widest ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                                    {phaseName}
                                </span>
                                <span className="text-[10px] text-slate-500 mt-0.5 max-w-md truncate">
                                    {phaseDesc} • {week.targetKm}km Target
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                {isCurrent && (
                                    <span className="text-[10px] font-bold bg-[#f97415] text-white px-2 py-0.5 rounded-full uppercase">
                                        Current
                                    </span>
                                )}
                                {isPast && (
                                    <span className="text-emerald-500 material-symbols-outlined text-sm font-bold">
                                        ✓
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MonthView;
