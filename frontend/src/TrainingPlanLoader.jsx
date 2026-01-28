import React from 'react';

const TrainingPlanLoader = () => {
    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
            {/* Running Animation Container */}
            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">

                {/* Track/Ground Line */}
                <div className="absolute bottom-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-[#f97415] to-transparent animate-track-slide"></div>
                </div>

                {/* Left Shoe */}
                <div className="absolute w-12 h-6 bg-white rounded-full rounded-tr-sm rounded-bl-lg transform -rotate-12 animate-run-left shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                    <div className="absolute top-1 right-2 w-4 h-4 rounded-full border-2 border-slate-200"></div> {/* Laces area */}
                    <div className="absolute bottom-0 w-full h-2 bg-slate-300 rounded-b-lg"></div> {/* Sole */}
                    <div className="absolute bottom-0 right-1 w-8 h-1 bg-[#f97415]"></div> {/* Stripe */}
                </div>

                {/* Right Shoe */}
                <div className="absolute w-12 h-6 bg-slate-200 rounded-full rounded-tr-sm rounded-bl-lg transform -rotate-12 animate-run-right shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                    <div className="absolute top-1 right-2 w-4 h-4 rounded-full border-2 border-slate-300"></div>
                    <div className="absolute bottom-0 w-full h-2 bg-slate-400 rounded-b-lg"></div>
                    <div className="absolute bottom-0 right-1 w-8 h-1 bg-[#f97415]"></div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">
                Designing Your Plan
            </h2>
            <p className="text-slate-400 text-sm">
                AI is crafting your personalized training schedule...
            </p>

            {/* CSS Styles injected locally for this specific animation */}
            <style>{`
        @keyframes track-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes run-left {
          0%, 100% { transform: translate(-10px, 0) rotate(-10deg); z-index: 1; }
          25% { transform: translate(0, -15px) rotate(5deg); z-index: 1; }
          50% { transform: translate(15px, 0) rotate(10deg); z-index: 0; }
          75% { transform: translate(0, -5px) rotate(0deg); z-index: 0; }
        }

        @keyframes run-right {
          0%, 100% { transform: translate(15px, 0) rotate(10deg); z-index: 0; }
          25% { transform: translate(0, -5px) rotate(0deg); z-index: 0; }
          50% { transform: translate(-10px, 0) rotate(-10deg); z-index: 1; }
          75% { transform: translate(0, -15px) rotate(5deg); z-index: 1; }
        }

        .animate-track-slide {
          animation: track-slide 1s linear infinite;
        }

        .animate-run-left {
          animation: run-left 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .animate-run-right {
          animation: run-right 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          animation-delay: -0.4s; /* Start halfway through cycle */
        }
      `}</style>
        </div>
    );
};

export default TrainingPlanLoader;
