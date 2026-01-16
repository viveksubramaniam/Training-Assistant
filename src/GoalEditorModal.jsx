import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, MapPin, Check } from 'lucide-react';

/**
 * GoalEditorModal - Modal for creating/editing training goals
 */
export default function GoalEditorModal({ isOpen, onClose, existingGoal, onSave }) {
    const [goalType, setGoalType] = useState('Half Marathon');
    const [targetDate, setTargetDate] = useState('');
    const [weeklyTarget, setWeeklyTarget] = useState(40);
    const [preferredDays, setPreferredDays] = useState(['Mon', 'Wed', 'Fri', 'Sun']);
    const [saving, setSaving] = useState(false);

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

    const handleSave = async () => {
        setSaving(true);
        try {
            const method = existingGoal?.id ? 'PUT' : 'POST';
            const url = existingGoal?.id ? `/api/goals/${existingGoal.id}` : '/api/goals';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    goalType,
                    targetDate: targetDate || null,
                    weeklyTarget,
                    preferredDays
                })
            });

            if (res.ok) {
                const data = await res.json();
                onSave(data);
                onClose();
            }
        } catch (err) {
            console.error('Failed to save goal:', err);
        }
        setSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5 text-slate-400" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#f97415]/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-[#f97415]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {existingGoal ? 'Edit Goal' : 'Set Your Goal'}
                        </h2>
                        <p className="text-sm text-slate-400">Define your training target</p>
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-5">
                    {/* Goal Type */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Goal Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {goalTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setGoalType(type)}
                                    className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all ${goalType === type
                                            ? 'bg-[#f97415] text-white'
                                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Date */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Target Date (Optional)
                        </label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f97415]/50"
                        />
                    </div>

                    {/* Weekly Distance Target */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Weekly Distance Target (km)
                        </label>
                        <input
                            type="number"
                            value={weeklyTarget}
                            onChange={(e) => setWeeklyTarget(parseInt(e.target.value) || 0)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f97415]/50"
                            min="0"
                            max="200"
                        />
                    </div>

                    {/* Preferred Workout Days */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Preferred Workout Days
                        </label>
                        <div className="flex gap-2">
                            {allDays.map(day => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${preferredDays.includes(day)
                                            ? 'bg-[#f97415] text-white'
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                                        }`}
                                >
                                    {day.charAt(0)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-slate-300 font-semibold hover:bg-white/5 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 px-4 rounded-xl bg-[#f97415] text-white font-bold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            'Saving...'
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Save Goal
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
