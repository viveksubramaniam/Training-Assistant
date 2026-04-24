import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

const ACTION_BADGES = {
    create_goal: { label: 'Goal Created', color: { text: 'var(--color-mint)', border: 'color-mix(in oklch, var(--color-mint) 30%, transparent)' } },
    update_goal: { label: 'Goal Updated', color: { text: 'var(--color-sky)', border: 'color-mix(in oklch, var(--color-sky) 30%, transparent)' } },
    delete_goal: { label: 'Goal Removed', color: { text: 'var(--color-crimson)', border: 'color-mix(in oklch, var(--color-crimson) 30%, transparent)' } },
    skip_workout: { label: 'Workout Skipped', color: { text: 'var(--color-ignite)', border: 'color-mix(in oklch, var(--color-ignite) 30%, transparent)' } },
    swap_workouts: { label: 'Workouts Swapped', color: { text: 'var(--color-gold)', border: 'color-mix(in oklch, var(--color-gold) 30%, transparent)' } },
    adjust_difficulty: { label: 'Intensity Adjusted', color: { text: 'var(--color-ignite)', border: 'color-mix(in oklch, var(--color-ignite) 30%, transparent)' } },
    adjust_intensity: { label: 'Intensity Adjusted', color: { text: 'var(--color-ignite)', border: 'color-mix(in oklch, var(--color-ignite) 30%, transparent)' } },
    modify_plan: { label: 'Plan Updated', color: { text: 'var(--color-ignite)', border: 'color-mix(in oklch, var(--color-ignite) 30%, transparent)' } },
    get_estimate: { label: 'Estimate', color: { text: 'var(--color-sky)', border: 'color-mix(in oklch, var(--color-sky) 30%, transparent)' } },
    weekly_summary: { label: 'Weekly Summary', color: { text: 'var(--color-sky)', border: 'color-mix(in oklch, var(--color-sky) 30%, transparent)' } },
    extend_goal: { label: 'Goal Extended', color: { text: 'var(--color-mint)', border: 'color-mix(in oklch, var(--color-mint) 30%, transparent)' } },
};

const QUICK_SUGGESTIONS = [
    { label: 'Skip today', message: "Skip today's workout, I need rest" },
    { label: 'Make it easier', message: "Make today's workout easier" },
    { label: 'Make it harder', message: "Give me a harder workout today" },
    { label: 'Time estimate', message: "How long will today's workout take?" },
    { label: 'Weekly summary', message: "How is my week going so far?" },
    { label: 'Push goal back', message: "Push my goal back by 2 weeks" },
];

// Brain SVG used in avatars
const BrainSVG = ({ size = 14, color = 'var(--color-fg)' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
);

const ChatWidget = ({ onPlanUpdate, onGoalChanged }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm your AI coach. I can help you manage your goals, adjust workouts, or answer any training questions. Try asking me to skip a workout, change difficulty, or set a new goal!", timestamp: Date.now() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load chat history from DB on component mount
    useEffect(() => {
        if (!historyLoaded) {
            const loadHistory = async () => {
                try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch(`${API_BASE_URL}/api/coach/chat/history`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.messages && data.messages.length > 0) {
                            setMessages(data.messages);
                            setShowSuggestions(false);
                        }
                    }
                } catch (err) {
                    console.error('Failed to load chat history:', err);
                }
                setHistoryLoaded(true);
            };
            loadHistory();
        }
    }, [historyLoaded]);

    useEffect(() => {
        setTimeout(scrollToBottom, 300);
    }, [messages]);

    const sendMessage = async (messageText) => {
        const userMessage = (messageText || input).trim();
        if (!userMessage || isLoading) return;

        setInput('');
        setShowSuggestions(false);
        setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/coach/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMessage })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.message) {
                throw new Error('Invalid response format from API');
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message,
                action: data.action,
                planUpdate: data.planUpdate,
                goalChanged: data.goalChanged,
                timestamp: Date.now()
            }]);

            // Notify parent about plan updates
            if (data.planUpdate && onPlanUpdate) {
                onPlanUpdate(data.updatedPlan);
            }

            // Notify parent about goal changes
            if (data.goalChanged && onGoalChanged) {
                onGoalChanged();
            }

        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting. Let's try again.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleSuggestionClick = (suggestion) => {
        sendMessage(suggestion.message);
    };

    const handleBack = () => {
        // Navigate back to home using hash routing
        window.location.hash = '#/home';
    };

    const renderActionBadge = (msg) => {
        if (!msg.action || msg.action === 'chat') {
            if (msg.planUpdate) {
                return (
                    <div style={{
                        background: 'color-mix(in oklch, var(--color-ignite) 10%, transparent)',
                        border: '1px solid color-mix(in oklch, var(--color-ignite) 20%, transparent)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        marginTop: 10
                    }}>
                        <div className="mono-data" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--color-ignite)', textTransform: 'uppercase' }}>Plan Updated</div>
                        <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginTop: 4 }}>Your session has been adjusted.</div>
                        <button style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ignite)', background: 'none', border: 'none', padding: 0, marginTop: 8, cursor: 'pointer' }}>View session →</button>
                    </div>
                );
            }
            return null;
        }

        const badge = ACTION_BADGES[msg.action];
        if (!badge) return null;

        return (
            <div style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: badge.color.text,
            }}>
                {badge.label}
            </div>
        );
    };

    return (
        <div style={{
            background: 'var(--color-bg)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
        }}>
            {/* Header */}
            <div style={{
                height: 60,
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-line)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 12,
                flexShrink: 0,
            }}>
                {/* Back button */}
                <button
                    onClick={handleBack}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-fg)',
                        flexShrink: 0,
                        transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = 'var(--color-line)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'var(--color-surface-2)';
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                </button>

                {/* Coach avatar */}
                <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-ignite), var(--color-crimson))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <BrainSVG size={14} color="white" />
                </div>

                {/* Title area */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="font-display" style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-fg)' }}>
                        Coach
                    </span>
                    <span className="mono-data" style={{ fontSize: 10, color: 'var(--color-mint)', marginLeft: 8 }}>
                        ● LIVE
                    </span>
                </div>
            </div>

            {/* Message thread */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}>
                {messages.map((msg) => (
                    <div
                        key={`${msg.role}-${msg.timestamp}-${msg.content.substring(0, 10)}`}
                        style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        {msg.role === 'assistant' && (
                            <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'color-mix(in oklch, var(--color-ignite) 15%, transparent)',
                                border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 8,
                                marginTop: 4,
                                flexShrink: 0,
                            }}>
                                <BrainSVG size={12} color="var(--color-ignite)" />
                            </div>
                        )}
                        <div style={{
                            maxWidth: '80%',
                            padding: '12px 16px',
                            fontSize: 14,
                            lineHeight: 1.6,
                            ...(msg.role === 'user'
                                ? {
                                    background: 'var(--color-ignite)',
                                    color: 'var(--color-fg)',
                                    borderRadius: '18px 18px 4px 18px',
                                    fontWeight: 500,
                                }
                                : {
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-line)',
                                    borderRadius: '18px 18px 18px 4px',
                                    color: 'var(--color-fg)',
                                }
                            ),
                        }}>
                            {msg.content}
                            {msg.role === 'assistant' && renderActionBadge(msg)}
                        </div>
                    </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'color-mix(in oklch, var(--color-ignite) 15%, transparent)',
                            border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                            marginTop: 4,
                            flexShrink: 0,
                        }}>
                            <BrainSVG size={12} color="var(--color-ignite)" />
                        </div>
                        <div style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            borderRadius: '18px 18px 18px 4px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            {[0, 150, 300].map((delay, i) => (
                                <div
                                    key={i}
                                    className="animate-bounce"
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: 'var(--color-fg-dim)',
                                        animationDelay: `${delay}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestion pills */}
            {showSuggestions && messages.length <= 2 && (
                <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {QUICK_SUGGESTIONS.map((suggestion) => (
                            <button
                                key={`suggestion-${suggestion.label}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={isLoading}
                                style={{
                                    background: 'var(--color-surface-2)',
                                    border: '1px solid var(--color-line)',
                                    borderRadius: 20,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    color: 'var(--color-fg-muted)',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    opacity: isLoading ? 0.5 : 1,
                                }}
                            >
                                {suggestion.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input bar */}
            <div style={{
                background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-line)',
                padding: '12px 16px 24px',
                flexShrink: 0,
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--color-surface-2)',
                    border: `1px solid ${inputFocused ? 'var(--color-ignite)' : 'var(--color-line)'}`,
                    borderRadius: 28,
                    padding: '8px',
                    gap: 8,
                    transition: 'border-color 0.15s',
                }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder="Ask coach…"
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            color: 'var(--color-fg)',
                            border: 'none',
                            outline: 'none',
                            padding: '0 12px',
                            fontSize: 14,
                        }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: input.trim() ? 'var(--color-ignite)' : 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                            color: input.trim() ? 'var(--color-fg)' : 'var(--color-fg-dim)',
                            transition: 'background 0.15s, color 0.15s',
                            flexShrink: 0,
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWidget;
