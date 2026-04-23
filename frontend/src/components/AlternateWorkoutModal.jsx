import React from 'react';

/* Display an alternate workout as a detailed modal, similar to the main card */
const AlternateWorkoutModal = ({ workout, onClose, onSwap }) => {
    const STEP_LABELS = ['WU', 'Z3', 'Z4', 'Z5', 'CD'];
    const STEP_COLORS = [
        'var(--color-mint)',
        'var(--color-gold)',
        'var(--color-ignite)',
        'var(--color-crimson)',
        'var(--color-mint)',
    ];

    /* Map workout titles to training zones for the effort profile bar */
    const effortProfile = (title = '', targetPace = '') => {
        const t = (title + ' ' + targetPace).toLowerCase();
        if (t.includes('interval') || t.includes('threshold') || t.includes('tempo')) {
            return [1.5, 3, 3, 0.8, 1.5];
        }
        if (t.includes('long')) return [1, 5, 2, 0, 1];
        if (t.includes('recovery') || t.includes('easy') || t.includes('shake')) return [1, 6, 0, 0, 1];
        if (t.includes('hill') || t.includes('sprint') || t.includes('vo2')) return [1, 2, 2, 3, 1];
        return [1, 4, 2, 0.5, 1];
    };

    const parseDurationMinutes = (d) => {
        if (!d) return null;
        if (typeof d === 'number') return d;
        const s = String(d).toLowerCase();
        const m = s.match(/(\d+)\s*m/);
        if (m) return parseInt(m[1], 10);
        const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
        if (h) return Math.round(parseFloat(h[1]) * 60);
        const pure = s.match(/^\s*(\d+)\s*$/);
        if (pure) return parseInt(pure[1], 10);
        return null;
    };

    const title = workout?.title || workout?.type || 'Alternate Workout';
    const description = workout?.description || 'Consider this alternative to customize your training.';
    const tag = workout?.tag
        || (String(title).toLowerCase().includes('threshold') ? 'Threshold'
            : String(title).toLowerCase().includes('interval') ? 'Intervals'
            : String(title).toLowerCase().includes('tempo') ? 'Tempo'
            : String(title).toLowerCase().includes('long') ? 'Long'
            : String(title).toLowerCase().includes('recovery') ? 'Recovery'
            : 'Alternative');

    const distance = workout?.distance || workout?.distance_km || null;
    const durationMin = parseDurationMinutes(workout?.duration);
    const avgPace = workout?.targetPace || workout?.target_pace || '—';
    const effort = effortProfile(title, avgPace);

    // Split the title for the dramatic 2-line hero typography
    const [titleLine1, titleLine2] = (() => {
        const words = String(title).split(' ');
        if (words.length <= 1) return [words[0] || title, ''];
        const mid = Math.ceil(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    })();

    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden font-display"
             style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-6">
                <button
                    onClick={onClose}
                    className="flex items-center justify-center"
                    style={{
                        width: 36, height: 36, borderRadius: 18,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        color: 'var(--color-fg-muted)',
                    }}
                    title="Back"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <div style={{ width: 36 }} />
            </div>

            {/* Scroll body */}
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">
                {/* Eyebrow + title */}
                <div className="px-5 pt-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em]"
                         style={{ color: 'var(--color-ignite)' }}>
                        {tag} · Alternative
                    </div>
                    <div className="text-[22px] font-semibold tracking-[-0.02em] mt-1">{title}</div>
                </div>

                {/* Main card */}
                <div
                    className="mx-5 mt-4 relative overflow-hidden grain"
                    style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                        borderRadius: 22,
                        padding: 24,
                    }}
                >
                    {/* corner glow */}
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute', top: -60, right: -60,
                            width: 200, height: 200, borderRadius: 100,
                            background: 'var(--color-ignite)',
                            opacity: 0.12, filter: 'blur(40px)',
                        }}
                    />

                    <div className="relative">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                             style={{ color: 'var(--color-ignite)' }}>
                            Alternative Workout
                        </div>

                        <div className="relative mt-4 font-semibold tracking-[-0.04em] leading-[1.05] text-[34px]">
                            {titleLine1}{titleLine2 && <><br/>{titleLine2}</>}
                        </div>
                        <p className="relative mt-2 text-[14px] leading-[1.45] max-w-[280px]"
                           style={{ color: 'var(--color-fg-muted)' }}>
                            {description}
                        </p>

                        {/* Stats row */}
                        <div className="relative mt-5 pt-4 grid grid-cols-3"
                             style={{ borderTop: '1px solid var(--color-line)' }}>
                            {[
                                { l: 'Distance', v: distance ? String(distance) : '—', u: 'km' },
                                { l: 'Duration', v: durationMin ? String(durationMin) : '—', u: 'min' },
                                { l: 'Avg pace', v: avgPace, u: '/km' },
                            ].map((s, i) => (
                                <div key={s.l}
                                     style={{
                                         borderLeft: i > 0 ? '1px solid var(--color-line)' : 'none',
                                         paddingLeft: i > 0 ? 14 : 0,
                                     }}>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                                         style={{ color: 'var(--color-fg-dim)' }}>{s.l}</div>
                                    <div className="mono-data text-[20px] font-medium mt-1 tracking-[-0.03em]">
                                        {s.v}
                                        <span className="text-[11px] ml-1" style={{ color: 'var(--color-fg-dim)' }}>{s.u}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Effort profile */}
                        <div className="relative mt-5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2"
                                 style={{ color: 'var(--color-fg-dim)' }}>
                                Effort profile
                            </div>
                            <div className="flex gap-[2px] h-2 rounded overflow-hidden">
                                {effort.map((w, i) => w > 0 ? (
                                    <div key={i} style={{ flex: w, background: STEP_COLORS[i] }}/>
                                ) : null)}
                            </div>
                            <div className="flex justify-between mt-[6px] mono-data text-[9px]"
                                 style={{ color: 'var(--color-fg-dim)', letterSpacing: '0.06em' }}>
                                {STEP_LABELS.map((s, i) => effort[i] > 0 ? <span key={i}>{s}</span> : <span key={i} style={{ opacity: 0 }}>{s}</span>)}
                            </div>
                        </div>

                        {/* Primary action */}
                        <button
                            onClick={onSwap}
                            className="relative mt-6 w-full h-[54px] flex items-center justify-center gap-2 font-display text-[16px] font-semibold active:scale-[0.985] transition"
                            style={{
                                borderRadius: 14,
                                background: 'var(--color-ignite)',
                                color: '#fff',
                                border: 'none',
                                letterSpacing: '0.01em',
                                boxShadow: '0 14px 30px -10px color-mix(in oklch, var(--color-ignite) 60%, transparent)',
                            }}
                        >
                            Swap for current workout
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M13 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlternateWorkoutModal;
