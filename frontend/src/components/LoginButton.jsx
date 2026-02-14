import { useState, useEffect } from "react";

const StravaIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
        <path d="M15.4 3L9 12h4.5L8 21l9-10h-4.5L15.4 3z" fill="white" />
    </svg>
);

const PulseDots = () => (
    <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: 5,
    }}>
        {[0, 0.15, 0.3].map((delay, i) => (
            <div key={i} style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "white",
                animation: `pulseDot 1s ease-in-out ${delay}s infinite`,
            }} />
        ))}
    </div>
);


export default function StravaLoginButton({ onLogin }) {
    // States: idle -> pressing -> shrinking -> loading
    const [phase, setPhase] = useState("idle");

    const handleClick = () => {
        if (phase !== "idle") return;
        setPhase("pressing");
    };

    useEffect(() => {
        let t1, t2;
        if (phase === "pressing") {
            // After press flash, start shrink
            t1 = setTimeout(() => setPhase("shrinking"), 180);
        }
        if (phase === "shrinking") {
            // After shrink completes, show loader and trigger login
            t2 = setTimeout(() => {
                setPhase("loading");
                if (onLogin) onLogin();
            }, 500);
        }
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [phase, onLogin]);

    // --- Derived geometry ---
    const isIdle = phase === "idle";
    const isPressing = phase === "pressing";
    const isShrinking = phase === "shrinking";
    const isLoading = phase === "loading";

    // Width: idle = full pill, shrinking+ = circle (56px)
    const width = (isShrinking || isLoading) ? 56 : 220;
    // Opacity of text+icon
    const contentOpacity = (isShrinking || isLoading) ? 0 : 1;
    // Slight Y scale on press
    const pressScale = isPressing ? 0.95 : 1;
    // Loader visibility
    const loaderOpacity = isLoading ? 1 : 0;

    return (
        <div style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        }}>
            {/* Subtle ambient glow behind button */}
            <div style={{
                position: "absolute",
                width: 260,
                height: 100,
                background: "radial-gradient(ellipse, rgba(252,76,20,0.25) 0%, transparent 70%)",
                filter: "blur(30px)",
                transition: "all 0.6s cubic-bezier(.4,0,0.2,1)",
                opacity: isLoading ? 0.4 : 0.7,
                transform: `scale(${(isShrinking || isLoading) ? 0.4 : 1})`,
            }} />

            {/* Button container — also handles the shrink morph */}
            <div
                onClick={handleClick}
                style={{
                    position: "relative",
                    width,
                    height: 56,
                    borderRadius: 28, // always pill → becomes circle when width = height
                    background: "linear-gradient(135deg, #fc4c14 0%, #e8430f 60%, #d43d0e 100%)",
                    // Layered shadow: depth + colored glow
                    boxShadow: isLoading
                        ? "0 2px 12px rgba(252,76,20,0.35)"
                        : "0 4px 24px rgba(252,76,20,0.4), 0 2px 8px rgba(0,0,0,0.3)",
                    cursor: isIdle ? "pointer" : "default",
                    // Single unified transition for morph
                    transition: "width 0.45s cubic-bezier(.4,0,0.2,1), box-shadow 0.4s ease",
                    transform: `scale(${pressScale})`,
                    // Press scale uses a faster curve; morph uses the main transition
                    ...(isPressing ? { transition: "transform 0.12s ease-out" } : {}),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    // Prevent text selection on rapid clicks
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
            >
                {/* ---------- Idle / Press content (icon + text) ---------- */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: contentOpacity,
                    transition: "opacity 0.18s ease-out",
                    // We use pointerEvents none so the content doesn't
                    // interfere with the parent's click target during shrink
                    pointerEvents: "none",
                    position: "absolute",
                    whiteSpace: "nowrap",
                }}>
                    <StravaIcon />
                    <span style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                    }}>
                        Log in with Strava
                    </span>
                </div>

                {/* ---------- Loading spinner (fades in after shrink) ---------- */}
                <div style={{
                    opacity: loaderOpacity,
                    transition: "opacity 0.25s ease-in",
                    pointerEvents: "none",
                    position: "absolute",
                    inset: 0,
                }}>
                    {/* Pulsing dots loader */}
                    <PulseDots />
                </div>

                {/* ---------- Shimmer overlay (idle only) ---------- */}
                {isIdle && (
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "inherit",
                        background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
                        backgroundSize: "200% 100%",
                        backgroundPosition: "200% 0",
                        animation: "shimmer 2.2s ease-in-out infinite",
                        pointerEvents: "none",
                    }} />
                )}
            </div>

            {/* ---------- Keyframes ---------- */}
            <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(0.6); opacity: 0.4; }
          50%      { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
        </div>
    );
}