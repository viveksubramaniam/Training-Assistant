import React, { useState, useEffect } from 'react';

export default function GoalEditorModal({ isOpen, onClose, existingGoal, onSave }) {
    const [goalType, setGoalType] = useState('Half Marathon');
    const [targetDate, setTargetDate] = useState('');
    const [weeklyTarget, setWeeklyTarget] = useState(40);
    const [preferredDays, setPreferredDays] = useState(['Mon', 'Wed', 'Fri', 'Sun']);
    const [saving, setSaving] = useState(false);
    const [inputFocused, setInputFocused] = useState(null);

    const goalTypes = ['5K', '10K', 'Half Marathon', 'Marathon', 'General Fitness'];
    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    useEffect(() => {
        if (existingGoal) {
            setGoalType(existingGoal.type || 'Half Marathon');
            setTargetDate(existingGoal.targetDate || '');
            setWeeklyTarget(existingGoal.weeklyTarget || 40);
            setPreferredDays(existingGoal.preferredDays || ['Mon', 'Wed', 'Fri', 'Sun']);
        }
    }, [existingGoal]);

    const toggleDay = (day) => {
        setPreferredDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };

    const handleSave = () => {
        // Pass data to parent immediately
        onSave({
            goalType,
            targetDate: targetDate || null,
            weeklyTarget,
            preferredDays
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'relative',
                borderRadius: 24,
                padding: 32,
                width: '100%',
                maxWidth: 448,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        padding: 8,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-fg-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>

                {/* Header */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'color-mix(in oklch, var(--color-ignite) 15%, transparent)',
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--color-ignite)' }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    </div>
                    <div>
                        <h2 className="font-display font-bold" style={{ fontSize: 20, color: 'var(--color-fg)' }}>
                            {existingGoal ? 'Edit Goal' : 'Set Your Goal'}
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--color-fg-dim)', marginTop: 4 }}>Define your training target</p>
                    </div>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Goal Type */}
                    <div>
                        <label className="mono-data" style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 8,
                        }}>
                            Goal Type
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {goalTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setGoalType(type)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        transition: 'all 0.15s',
                                        background: goalType === type ? 'var(--color-ignite)' : 'var(--color-surface-2)',
                                        color: goalType === type ? 'white' : 'var(--color-fg-muted)',
                                        border: goalType === type ? 'none' : '1px solid var(--color-line)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Date */}
                    <div>
                        <label className="mono-data" style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 8,
                        }}>
                            Target Date (Optional)
                        </label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            onFocus={() => setInputFocused('targetDate')}
                            onBlur={() => setInputFocused(null)}
                            style={{
                                width: '100%',
                                background: 'var(--color-surface-2)',
                                border: `1px solid ${inputFocused === 'targetDate' ? 'var(--color-ignite)' : 'var(--color-line)'}`,
                                borderRadius: 12,
                                padding: '12px 16px',
                                color: 'var(--color-fg)',
                                fontSize: 14,
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Weekly Distance Target */}
                    <div>
                        <label className="mono-data" style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 8,
                        }}>
                            Weekly Distance Target (km)
                        </label>
                        <input
                            type="number"
                            value={weeklyTarget}
                            onChange={(e) => setWeeklyTarget(parseInt(e.target.value) || 0)}
                            onFocus={() => setInputFocused('weeklyTarget')}
                            onBlur={() => setInputFocused(null)}
                            style={{
                                width: '100%',
                                background: 'var(--color-surface-2)',
                                border: `1px solid ${inputFocused === 'weeklyTarget' ? 'var(--color-ignite)' : 'var(--color-line)'}`,
                                borderRadius: 12,
                                padding: '12px 16px',
                                color: 'var(--color-fg)',
                                fontSize: 14,
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                            }}
                            min="0"
                            max="200"
                        />
                    </div>

                    {/* Preferred Workout Days */}
                    <div>
                        <label className="mono-data" style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            color: 'var(--color-fg-dim)',
                            marginBottom: 8,
                        }}>
                            Preferred Workout Days
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {allDays.map(day => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        borderRadius: 8,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        transition: 'all 0.15s',
                                        background: preferredDays.includes(day) ? 'var(--color-ignite)' : 'var(--color-surface-2)',
                                        color: preferredDays.includes(day) ? 'white' : 'var(--color-fg-muted)',
                                        border: preferredDays.includes(day) ? 'none' : '1px solid var(--color-line)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {day.charAt(0)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: 12,
                            border: '1px solid var(--color-line)',
                            background: 'transparent',
                            color: 'var(--color-fg-muted)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-2)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'var(--color-ignite)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'opacity 0.15s',
                            opacity: saving ? 0.6 : 1,
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Goal'}
                    </button>
                </div>
            </div>
        </div>
    );
}
