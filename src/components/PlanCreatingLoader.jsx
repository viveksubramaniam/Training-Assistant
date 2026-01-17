import React from 'react';

/**
 * PlanCreatingLoader - Animated notepad/notebook loading animation
 * Shows when a training plan is being created after goal save
 */
export default function PlanCreatingLoader({ isVisible, message = "Your plan is now being created" }) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Content */}
            <div className="relative flex flex-col items-center gap-6 p-8 animate-fade-in">
                {/* Animated Notepad */}
                <div className="relative w-24 h-28">
                    {/* Notebook binding */}
                    <div className="absolute left-0 top-4 bottom-4 w-3 bg-primary rounded-l-lg shadow-lg shadow-primary/30" />

                    {/* Notebook pages */}
                    <div className="absolute left-3 top-0 right-0 bottom-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-r-lg border border-white/10 shadow-2xl overflow-hidden">
                        {/* Lines on page */}
                        <div className="absolute inset-4 space-y-3">
                            <div className="h-0.5 bg-white/10 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                            <div className="h-0.5 bg-white/10 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
                            <div className="h-0.5 bg-white/10 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
                            <div className="h-0.5 bg-white/10 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                            <div className="h-0.5 bg-white/10 rounded animate-pulse" style={{ animationDelay: '400ms' }} />
                        </div>

                        {/* Writing animation - pen/pencil marks appearing */}
                        <div className="absolute inset-4 space-y-3">
                            <div className="h-0.5 bg-primary/60 rounded w-0 animate-write-line" style={{ animationDelay: '0ms' }} />
                            <div className="h-0.5 bg-primary/60 rounded w-0 animate-write-line" style={{ animationDelay: '300ms' }} />
                            <div className="h-0.5 bg-primary/60 rounded w-0 animate-write-line" style={{ animationDelay: '600ms' }} />
                            <div className="h-0.5 bg-primary/40 rounded w-0 animate-write-line" style={{ animationDelay: '900ms' }} />
                            <div className="h-0.5 bg-primary/30 rounded w-0 animate-write-line" style={{ animationDelay: '1200ms' }} />
                        </div>
                    </div>

                    {/* Pen/pencil icon */}
                    <div className="absolute -right-3 -bottom-2 animate-bounce">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/50">
                            <span className="material-symbols-outlined text-white text-lg">edit</span>
                        </div>
                    </div>
                </div>

                {/* Message */}
                <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-2">{message}</h3>
                    <p className="text-sm text-white/50">This may take a moment...</p>
                </div>

                {/* Loading dots */}
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>

            {/* Custom animation styles */}
            <style>{`
                @keyframes write-line {
                    0% { width: 0; }
                    50% { width: 100%; }
                    100% { width: 100%; opacity: 0.3; }
                }
                .animate-write-line {
                    animation: write-line 1.5s ease-out infinite;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
