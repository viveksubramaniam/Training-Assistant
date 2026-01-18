import React, { useState, useMemo } from 'react';

const MonthView = ({ masterPlan }) => {
    // 1. State for View Navigation
    const [viewDate, setViewDate] = useState(new Date());

    // 2. Data Processing: Map dates to workout details
    const { workoutMap, programEndDate } = useMemo(() => {
        const map = {};
        let lastDate = null;

        if (masterPlan && masterPlan.weeks) {
            masterPlan.weeks.forEach(week => {
                if (week.days) {
                    week.days.forEach(day => {
                        if (day.date) {
                            // Parse date to local YYYY-MM-DD to match grid
                            const d = new Date(day.date);
                            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            map[dStr] = {
                                type: day.workout_type,
                                intensity: day.intensity || 1 // Default to 1 if missing
                            };

                            // Track max date for Program End
                            if (!lastDate || dStr > lastDate) {
                                lastDate = dStr;
                            }
                        }
                    });
                }
            });
        }
        return { workoutMap: map, programEndDate: lastDate };
    }, [masterPlan]);


    // 3. Date Calculations
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    // Get first day of the month (0=Sun, 1=Mon)
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDayOffset = firstDayOfMonth.getDay();

    // Get days in month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 4. Handlers
    const handlePrevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Helper for formatting YYYY-MM-DD locally
    const getYMD = (year, month, day) => {
        // Note: month is 0-indexed in JS date, need 1-indexed for string
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    return (
        <div className="glass-card rounded-xl p-4 font-display">
            {/* Header / Navigation */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{monthNames[currentMonth]} {currentYear}</h3>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
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
                {Array.from({ length: startDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8"></div>
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = getYMD(currentYear, currentMonth, dayNum);

                    const todayStr = new Date().toISOString().split('T')[0];
                    const isToday = dateStr === todayStr;

                    const workout = workoutMap[dateStr];
                    const isRaceDay = dateStr === programEndDate;

                    return (
                        <div key={dayNum} className="flex flex-col items-center gap-1 relative group">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono transition-colors
                                ${isToday ? 'bg-[#f97415] text-white' : 'text-slate-300 hover:bg-white/5'}
                                ${isRaceDay ? 'ring-2 ring-emerald-500' : ''}
                            `}>
                                {isRaceDay ? (
                                    <span className="material-symbols-outlined text-emerald-500 text-xs">sports_score</span>
                                ) : (
                                    dayNum
                                )}
                            </div>

                            {/* Dots for workouts */}
                            <div className="flex gap-1 min-h-[6px] mt-0.5">
                                {workout && !['rest', 'rest day'].includes(String(workout.type).toLowerCase()) && !isRaceDay && (
                                    <div className={`w-1.5 h-1.5 rounded-full 
                                        ${workout.intensity == 3 ? 'bg-rose-500' :
                                            workout.intensity == 2 ? 'bg-[#f97415]' : 'bg-emerald-500'}
                                    `}></div>
                                )}
                                {isRaceDay && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-white/5 flex gap-4 justify-center text-[10px] text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-1"><span className="material-symbols-outlined text-emerald-500 text-[10px]">sports_score</span> End</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f97415]"></div> Today</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Easy</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Hard</div>
            </div>
        </div>
    );
};

export default MonthView;
