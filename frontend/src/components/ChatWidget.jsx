import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Target, Calendar, TrendingUp, SkipForward, ArrowLeftRight, Gauge, Clock, MessageCircle, BarChart3, CalendarPlus } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const ACTION_BADGES = {
    create_goal: { label: 'Goal Created', icon: Target, color: 'text-emerald-400 border-emerald-500/30' },
    update_goal: { label: 'Goal Updated', icon: Target, color: 'text-blue-400 border-blue-500/30' },
    delete_goal: { label: 'Goal Removed', icon: Target, color: 'text-red-400 border-red-500/30' },
    skip_workout: { label: 'Workout Skipped', icon: SkipForward, color: 'text-amber-400 border-amber-500/30' },
    swap_workouts: { label: 'Workouts Swapped', icon: ArrowLeftRight, color: 'text-purple-400 border-purple-500/30' },
    adjust_difficulty: { label: 'Intensity Adjusted', icon: Gauge, color: 'text-orange-400 border-orange-500/30' },
    adjust_intensity: { label: 'Intensity Adjusted', icon: Gauge, color: 'text-orange-400 border-orange-500/30' },
    modify_plan: { label: 'Plan Updated', icon: Sparkles, color: 'text-primary border-primary/30' },
    get_estimate: { label: 'Estimate', icon: Clock, color: 'text-cyan-400 border-cyan-500/30' },
    weekly_summary: { label: 'Weekly Summary', icon: BarChart3, color: 'text-indigo-400 border-indigo-500/30' },
    extend_goal: { label: 'Goal Extended', icon: CalendarPlus, color: 'text-teal-400 border-teal-500/30' },
};

const QUICK_SUGGESTIONS = [
    { label: 'Skip today', message: "Skip today's workout, I need rest" },
    { label: 'Make it easier', message: "Make today's workout easier" },
    { label: 'Make it harder', message: "Give me a harder workout today" },
    { label: 'Time estimate', message: "How long will today's workout take?" },
    { label: 'Weekly summary', message: "How is my week going so far?" },
    { label: 'Push goal back', message: "Push my goal back by 2 weeks" },
];

const ChatWidget = ({ isOpen, onClose, onPlanUpdate, onGoalChanged }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm your AI coach. I can help you manage your goals, adjust workouts, or answer any training questions. Try asking me to skip a workout, change difficulty, or set a new goal!" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load chat history from DB on first open
    useEffect(() => {
        if (isOpen && !historyLoaded) {
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
    }, [isOpen, historyLoaded]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(scrollToBottom, 300);
        }
    }, [messages, isOpen]);

    const sendMessage = async (messageText) => {
        const userMessage = (messageText || input).trim();
        if (!userMessage || isLoading) return;

        setInput('');
        setShowSuggestions(false);
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
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

            const data = await response.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message,
                action: data.action,
                planUpdate: data.planUpdate,
                goalChanged: data.goalChanged
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
                content: "I'm having trouble connecting. Let's try again."
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

    const renderActionBadge = (msg) => {
        if (!msg.action || msg.action === 'chat') {
            if (msg.planUpdate) {
                return (
                    <div className="mt-3 pt-2 border-t border-white/10 text-xs text-primary flex items-center gap-1.5 font-bold uppercase tracking-wide">
                        <Sparkles className="w-3 h-3" />
                        Plan updated
                    </div>
                );
            }
            return null;
        }

        const badge = ACTION_BADGES[msg.action];
        if (!badge) return null;

        const Icon = badge.icon;
        return (
            <div className={`mt-3 pt-2 border-t border-white/10 text-xs flex items-center gap-1.5 font-bold uppercase tracking-wide ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </div>
        );
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[450px] h-[85vh] bg-[#0f172a]/90 backdrop-blur-md rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col z-50 transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
            {/* Grab Handle / Close Area */}
            <div className="flex flex-col items-center pt-4 pb-2 cursor-pointer active:opacity-70" onClick={onClose}>
                <div className="w-12 h-1.5 bg-slate-700/50 rounded-full"></div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mr-2 mt-2 flex-shrink-0">
                                <span className="material-symbols-outlined text-primary text-[14px]">psychology</span>
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-br-sm shadow-md shadow-orange-900/20 font-medium'
                                : 'bg-[#1e293b] text-slate-200 rounded-bl-sm border border-white/5'
                                }`}
                        >
                            {msg.content}
                            {msg.role === 'assistant' && renderActionBadge(msg)}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mr-2 flex-shrink-0">
                            <span className="material-symbols-outlined text-primary text-[14px]">psychology</span>
                        </div>
                        <div className="bg-[#1e293b] px-4 py-3 rounded-2xl rounded-bl-sm border border-white/5 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            {showSuggestions && messages.length <= 2 && (
                <div className="px-4 pb-2">
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={isLoading}
                                className="flex-none px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-primary/30 transition-all whitespace-nowrap disabled:opacity-50"
                            >
                                {suggestion.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 pb-8 bg-gradient-to-t from-[#0f172a] to-[#0f172a]/95 border-t border-white/5">
                <div className="flex items-center gap-2 bg-slate-900/80 rounded-2xl px-2 py-2 border border-white/5 focus-within:border-primary/50 transition-colors">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask your coach anything..."
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none px-3 font-medium"
                        disabled={isLoading}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                        className="p-3 bg-primary rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-orange-900/20"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWidget;
