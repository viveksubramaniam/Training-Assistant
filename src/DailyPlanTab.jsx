import React, { useState } from 'react';

const DailyPlanTab = ({ user, onNavigateToCalendar }) => {
    // Mock data based on HTML reference
    const todayFocus = [
        {
            level: "Level 1",
            levelColor: "text-emerald-400",
            duration: "25m",
            title: "Recovery Flush",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBvVUF_VK01IJptsX46nSyTF_j1f836icO-clrstRk3blRL5mDKoQ4EEg9tjPVtpycYKhYzyVH8R5ZNDjufYj0ZX965KO6LoJfnYHytZ8f6QmUyf9dmpuPgHOPnp3O8OJeu_8d0jUtlqX0-bufzh3-hLcE-PiwbJEu5ce7OYMtugEV9Zm1YQ4nxZ8HFZ0ZUZu_Lizb_jHCARvuE5ItyirVE11_wBUPOJhk0MQP_y8H25IX0-ccSeQhFCqnai77kkCzxTTkYFZ2i120",
            recommended: false
        },
        {
            level: "Level 2",
            levelColor: "text-primary",
            duration: "45m",
            title: "Zone 2 Aerobic Base",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuApvg49L3qSHo7b4cy73edJZn_QNShz8GVmtEyhDv08Z0cnlLap6RiRHxGdjX8jTg7no9KqnXA7r07_fBjQiKEzgMCp98LDWvA6amaCdydlEW8vQWHRTH9KPiv6wT8aX5ZYNWfbM34hT216O9S6pw08XZ2yPMhUTMy-z271rB7TJqcln4SrtPx33anNHBCIUTTMDn3tscXc32xK_37cA-PiJzdmyz8Y_5fgGHTF7dt2HQ8d2jzV0Yq0Bn7l-Rgbhr1df9pIKf4mM7E",
            recommended: true
        },
        {
            level: "Level 3",
            levelColor: "text-rose-500",
            duration: "60m",
            title: "Threshold Intervals",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCANXX5R_t3iz1dcuTr2HTiyrZDVCU8no3WnpGJzIu2aDTcLP4z6-HugWiFRGy6SdYb7YoFNJGWpxKP_ev-w8xlVOvCgPPC41aqlcZ49JjTFj5_mp9koSNJt6IDDiVW2YyVu5MfkjRSOJ201vlIjiO41TdpBfBYlaM1p-qSIpOWIu5GlAKAeWLH5AD3oWimzmXc4t2d1by1w-NOapAgqh59afr6Q4GgPQb0BujLh1uMJzaIhBiaQtjhWFA4D5HrXhyvzeqZe8nSFG4",
            recommended: false
        }
    ];

    return (
        <div className="space-y-6 pb-24">

            {/* Header: No border, simplified to remove separation */}
            <header className="sticky top-0 z-50 border-none bg-gradient-to-b from-[#0f172a] via-[#0f172a]/80 to-transparent pb-4">
                <div className="max-w-md mx-auto px-5 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-white border border-primary/20 shadow-lg shadow-primary/10">
                            <span className="material-symbols-outlined text-2xl font-bold text-primary">shadow</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter text-white">ECLIPSE <span className="text-primary">V2</span></h1>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Adaptive Coach</p>
                        </div>
                    </div>

                    {/* Big Streak Bubble */}
                    <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-orange-600/20 px-4 py-2 rounded-full border border-orange-500/30">
                        <span className="material-symbols-outlined text-orange-500 text-lg">local_fire_department</span>
                        <span className="text-sm font-bold text-orange-400 tracking-wide">12 Day Streak</span>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-5 py-2 space-y-8">

                {/* 1. Today's Focus Section */}
                <section className="space-y-4">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400">Today's Focus</h2>
                        <span className="text-[10px] font-bold opacity-50 uppercase text-slate-500">Oct 24</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {todayFocus.map((item, idx) => (
                            <div
                                key={idx}
                                className={`glass-card p-4 rounded-xl flex items-center gap-4 relative overflow-hidden group transition-all duration-300 active:scale-[0.98] cursor-pointer border ${item.recommended ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-primary/40 shadow-xl shadow-orange-900/10' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800'}`}
                            >
                                {item.recommended && (
                                    <div className="absolute top-0 right-0 px-2 py-1 bg-primary text-[8px] font-bold text-white uppercase rounded-bl-lg">
                                        Recommended
                                    </div>
                                )}

                                <div className="w-14 h-14 rounded-lg bg-cover bg-center relative z-10 bg-slate-800 shadow-inner"
                                    style={{ backgroundImage: `url('${item.image}')` }}>
                                </div>

                                <div className="flex-1 relative z-10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${item.levelColor}`}>
                                            {item.level}
                                        </span>
                                        <span className={`text-[10px] font-bold ${item.recommended ? 'text-primary' : 'opacity-60 text-white'}`}>{item.duration}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-white leading-tight">{item.title}</h3>
                                </div>

                                {item.recommended ? (
                                    <button className="relative z-10 w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
                                    </button>
                                ) : (
                                    <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* 2. Week Progress (Moved Up) */}
                <section className="glass-card bg-gradient-to-br from-indigo-900/20 to-slate-900/50 p-5 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <span className="material-symbols-outlined text-6xl text-white">flag</span>
                    </div>

                    <div className="flex items-center gap-6 relative z-10">
                        {/* Points Figure / Progress Circle */}
                        <div className="relative w-24 h-24 flex-none">
                            <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                                <circle className="text-slate-800" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeWidth="8"></circle>
                                <circle className="text-primary" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeDasharray="263.8" strokeDashoffset="79" strokeLinecap="round" strokeWidth="8"></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-white leading-none tracking-tighter">42</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">/ 60</span>
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-300">Week Progress</h3>
                            <p className="text-2xl font-black text-white">Day 4 <span className="text-slate-500 text-lg">/ 7</span></p>
                            <p className="text-xs text-indigo-200/60 leading-relaxed">You are crushing your weekly volume goals. Keep it up!</p>
                        </div>
                    </div>
                </section>

                {/* 3. The Road Ahead (Moved Down) */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400">The Road Ahead</h2>
                        <button className="text-[10px] font-bold text-primary hover:text-orange-300 transition-colors" onClick={onNavigateToCalendar}>Full Calendar</button>
                    </div>
                    <div className="flex overflow-x-auto gap-4 hide-scrollbar pb-4 -mx-5 px-5 snap-x">
                        {/* Mock Upcoming Days */}
                        <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-2xl border-l-4 border-l-primary snap-center flex flex-col justify-between h-32">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Fri</p>
                                <h4 className="text-lg font-bold mt-1 text-white leading-tight">Speed Intervals</h4>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] font-mono text-slate-400">12k • 5am</span>
                                <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                            </div>
                        </div>
                        <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-2xl border border-white/5 snap-center flex flex-col justify-between h-32 hover:bg-slate-800 transition-colors cursor-pointer">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sat</p>
                                <h4 className="text-lg font-bold mt-1 text-white leading-tight">Long Run</h4>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] font-mono text-slate-400">24k • 7am</span>
                                <span className="material-symbols-outlined text-sm text-slate-500">timer</span>
                            </div>
                        </div>
                        <div className="flex-none w-36 glass-card bg-slate-800/50 p-4 rounded-2xl border border-white/5 snap-center flex flex-col justify-between h-32 hover:bg-slate-800 transition-colors cursor-pointer">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sun</p>
                                <h4 className="text-lg font-bold mt-1 text-white leading-tight">Active Rest</h4>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] font-mono text-slate-400">Yoga</span>
                                <span className="material-symbols-outlined text-sm text-emerald-500">spa</span>
                            </div>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
};

export default DailyPlanTab;
