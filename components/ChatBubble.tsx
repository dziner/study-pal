import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatBubbleProps {
    sender: 'user' | 'bot';
    text: string;
    isTyping?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ sender, text, isTyping }) => {
    const isBot = sender === 'bot';

    const bubbleClasses = isBot
        ? 'bg-slate-200 text-slate-800'
        : 'bg-blue-600 text-white';

    const containerClasses = `flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`;
    
    const showTyping = isBot && isTyping;

    return (
        <div className={containerClasses}>
            <div className={`max-w-md md:max-w-lg rounded-2xl p-3 shadow-sm ${bubbleClasses}`}>
                {showTyping ? (
                    <div className="flex items-center justify-center space-x-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    </div>
                ) : (
                    isBot ? <MarkdownRenderer content={text} /> : <p className="whitespace-pre-wrap">{text}</p>
                )}
            </div>
        </div>
    );
};