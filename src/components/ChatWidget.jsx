import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, Loader2 } from 'lucide-react';

const ChatWidget = ({ onPlanUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm your AI coach. Ask me anything about your training or tell me if you need to adjust today's workout." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/coach/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: userMessage })
            });

            const data = await response.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message,
                planUpdate: data.planUpdate
            }]);

            // Notify parent if plan was updated
            if (data.planUpdate && onPlanUpdate) {
                onPlanUpdate(data.updatedPlan);
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

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-4 w-12 h-12 bg-primary rounded-full shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-105 transition-transform z-50 border border-white/20"
            >
                <span className="material-symbols-outlined text-white text-2xl">smart_toy</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-[#0f172a] rounded-2xl shadow-2xl border border-white/10 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#818CF8]/20 to-[#6366F1]/20 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#818CF8] to-[#6366F1] rounded-full flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">AI Coach</h3>
                        <p className="text-xs text-slate-400">Ready to help</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user'
                                ? 'bg-[#818CF8] text-white rounded-br-sm'
                                : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                                }`}
                        >
                            {msg.content}
                            {msg.planUpdate && (
                                <div className="mt-2 text-xs text-[#f97415] flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Plan updated!
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800 px-4 py-2 rounded-2xl rounded-bl-sm">
                            <Loader2 className="w-5 h-5 text-[#818CF8] animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask your coach..."
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="p-2 bg-[#818CF8] rounded-lg hover:bg-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                    Try: "Make today easier" or "How's my progress?"
                </p>
            </div>
        </div>
    );
};

export default ChatWidget;
