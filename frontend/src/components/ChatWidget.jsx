import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const ChatWidget = ({ isOpen, onClose, onPlanUpdate }) => {
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
        if (isOpen) {
            // Small delay to allow animation to start before scrolling
            setTimeout(scrollToBottom, 300);
        }
    }, [messages, isOpen]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/coach/chat`, {
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
                            {msg.planUpdate && (
                                <div className="mt-3 pt-2 border-t border-white/10 text-xs text-primary flex items-center gap-1.5 font-bold uppercase tracking-wide">
                                    <Sparkles className="w-3 h-3" />
                                    Plan updated
                                </div>
                            )}
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

            {/* Input */}
            <div className="p-4 pb-8 bg-gradient-to-t from-[#0f172a] to-[#0f172a]/95 border-t border-white/5">
                <div className="flex items-center gap-2 bg-slate-900/80 rounded-2xl px-2 py-2 border border-white/5 focus-within:border-primary/50 transition-colors">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask your coach for advice..."
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none px-3 font-medium"
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
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
