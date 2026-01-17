import React from 'react';

const MonthView = ({ masterPlan }) => {
    // Determine current month based on plan start or current date
    // For MVP, just showing a grid of the current month
    // If masterPlan has start_date, use that.

    // Simplification: Just generate a grid for the *current* month of the user
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

    // Mock data integration: In reality, we'd map masterPlan weeks to dates
    // masterPlan.weeks is array of { week: 1, start_date: '...', ... }

    const getEventsForDay = (day) => {
        // Find if this day matches any workout in the plan
        // To be implemented with real date mapping
        return [];
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="glass-card rounded-xl p-4 font-display">
            <div className="flex justify-between items-center mb-6">
                <button className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{monthNames[currentMonth]} {currentYear}</h3>
                <button className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>

            {/* Week Headers */}
            <div className="grid grid-cols-7 mb-4 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-xs font-bold text-slate-500">{d}</div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-4 text-center">
                {/* Empty slots for start of month */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8"></div>
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate();

                    return (
                        <div key={day} className="flex flex-col items-center gap-1 relative">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono ${isToday ? 'bg-[#f97415] text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                                {day}
                            </div>
                            {/* Dots for workouts */}
                            <div className="flex gap-0.5 min-h-[4px]">
                                {/* Placeholder dots */}
                                {(day % 3 === 0) && <div className="w-1 h-1 rounded-full bg-emerald-500"></div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex gap-4 justify-center text-[10px] text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f97415]"></div> Race</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Workout</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-600"></div> Rest</div>
            </div>
        </div>
    );
};

export default MonthView;
