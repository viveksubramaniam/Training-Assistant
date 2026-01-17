import React, { useState } from 'react';
import ChatWidget from './components/ChatWidget';

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

            <header className="sticky top-0 z-50 glass bg-black/40 border-b border-white/5">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-white border border-primary/20">
                            <span className="material-symbols-outlined text-xl font-bold text-primary">shadow</span>
                        </div>
                        <h1 className="text-sm font-black tracking-tighter text-white">ECLIPSE <span className="text-primary">V2</span></h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
                            <span className="material-symbols-outlined text-primary text-xs">local_fire_department</span>
                            <span className="text-[10px] font-bold text-primary">12</span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-primary overflow-hidden bg-slate-800">
                            <img
                                src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}
                                alt="User"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Chat Widget replaces the static FAB */}
                <ChatWidget />

                {/* Today's Focus Section */}
                <section className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-lg font-black tracking-tight uppercase text-white">Today's Focus</h2>
                        <span className="text-[10px] font-bold opacity-50 uppercase text-slate-400">Oct 24</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {todayFocus.map((item, idx) => (
                            <div
                                key={idx}
                                className={`glass rounded-xl p-3 flex items-center gap-4 relative overflow-hidden group transition-transform active:scale-95 cursor-pointer ${item.recommended ? 'bg-primary/10 border-primary/30 glow-orange' : 'bg-white/5'}`}
                            >
                                {item.recommended && <div className="absolute inset-0 bg-primary/5"></div>}

                                <div className="w-12 h-12 rounded-lg bg-cover bg-center relative z-10 bg-slate-800"
                                    style={{ backgroundImage: `url('${item.image}')` }}>
                                </div>

                                <div className="flex-1 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${item.levelColor}`}>
                                            {item.level} {item.recommended ? '• Recommended' : ''}
                                        </span>
                                        <span className={`text-[10px] font-bold ${item.recommended ? 'text-primary' : 'opacity-60 text-white'}`}>{item.duration}</span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                                </div>

                                {item.recommended ? (
                                    <button className="relative z-10 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                                        <span className="material-symbols-outlined text-white text-sm">play_arrow</span>
                                    </button>
                                ) : (
                                    <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Coach Insight & Weekly Goals */}
                <section className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 glass bg-indigo-950/20 rounded-2xl p-4 border-indigo-500/10 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[14px] text-white">auto_awesome</span>
                                </div>
                                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-300">Coach Insight</h2>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[11px] leading-relaxed text-indigo-100 opacity-90">
                                    Calf fatigue detected (HRV: 64ms). Based on your data, I recommend a <span className="text-primary font-bold">10-minute myofascial extension</span> session prior to your Zone 2 run today.
                                </p>
                            </div>
                        </div>

                        <div className="flex-none md:w-48 glass bg-white/5 rounded-2xl p-4 border-white/10 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Week Goals</h3>
                                <span className="material-symbols-outlined text-primary text-sm">stars</span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2">
                                <div className="relative w-20 h-20">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle className="text-white/5" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeWidth="8"></circle>
                                        <circle className="text-primary" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeDasharray="263.8" strokeDashoffset="79" strokeLinecap="round" strokeWidth="8"></circle>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg font-black text-white leading-none">42</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">/ 60</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Activity Distribution */}
                <section className="space-y-3">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Activity Distribution</h2>
                    <div className="glass bg-white/5 rounded-2xl p-4">
                        <div className="flex items-end justify-between h-20 gap-1">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                                    <div className={`w-full bg-white/5 rounded-t-sm relative h-full flex flex-col justify-end ${i > 2 ? 'border-t border-dashed border-white/10' : ''}`}>
                                        {i === 0 && <div className="w-full bg-primary/40 h-[70%] border-t border-primary/50"></div>}
                                        {i === 1 && <div className="w-full bg-primary/40 h-[90%] border-t border-primary/50"></div>}
                                        {i === 2 && <div className="w-full bg-primary h-[40%] border-t border-primary/50"></div>}
                                    </div>
                                    <span className={`text-[8px] font-bold ${i === 2 ? 'text-primary' : 'opacity-40 text-white'}`}>{day}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* The Road Ahead */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">The Road Ahead</h2>
                        <button className="text-[10px] font-bold text-primary" onClick={onNavigateToCalendar}>Full Calendar</button>
                    </div>
                    <div className="flex overflow-x-auto gap-3 hide-scrollbar pb-2">
                        {/* Mock Upcoming Days */}
                        <div className="flex-none w-40 glass bg-white/5 p-3 rounded-xl border-l-2 border-primary">
                            <p className="text-[8px] font-black text-primary uppercase">Fri</p>
                            <h4 className="text-xs font-bold mt-0.5 text-white">Intervals</h4>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[9px] opacity-50 text-white">12k • 5am</span>
                                <span className="material-symbols-outlined text-xs text-primary">bolt</span>
                            </div>
                        </div>
                        <div className="flex-none w-40 glass bg-white/5 p-3 rounded-xl">
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Sat</p>
                            <h4 className="text-xs font-bold mt-0.5 text-white">Long Run</h4>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[9px] opacity-50 text-white">24k • 7am</span>
                                <span className="material-symbols-outlined text-xs text-slate-500">timer</span>
                            </div>
                        </div>
                        <div className="flex-none w-40 glass bg-white/5 p-3 rounded-xl">
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Sun</p>
                            <h4 className="text-xs font-bold mt-0.5 text-white">Active Rest</h4>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[9px] opacity-50 text-white">Yoga</span>
                                <span className="material-symbols-outlined text-xs text-emerald-500">spa</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default DailyPlanTab;
