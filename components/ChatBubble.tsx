import React from 'react';
import type { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LogoIcon } from './icons';
import { Spinner } from './Spinner';

export const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.sender === 'user';
    const isBotTyping = message.sender === 'bot' && message.text === '...';
    const isCraftingQuiz = message.sender === 'bot' && message.text === "Crafting your quiz... 🧠✨";

    return (
        <div className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <LogoIcon />
                </div>
            )}
            <div className={`max-w-xl rounded-xl px-4 py-3 ${isUser ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100'}`}>
                {isBotTyping ? (
                    <div className="flex items-center space-x-1 py-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    </div>
                ) : isCraftingQuiz ? (
                    <div className="flex items-center space-x-3 py-1">
                        <Spinner />
                        <span className="text-slate-600 font-medium">Crafting your quiz...</span>
                    </div>
                ) : (
                    isUser ? <p className="whitespace-pre-wrap">{message.text}</p> : <MarkdownRenderer content={message.text} />
                )}
            </div>
        </div>
    );
};