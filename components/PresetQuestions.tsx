import React from 'react';
import { renderInline } from './MarkdownRenderer';

interface PresetQuestionsProps {
    questions: string[];
    onQuestionClick: (question: string) => void;
}

export const PresetQuestions: React.FC<PresetQuestionsProps> = ({ questions, onQuestionClick }) => {
    return (
        <div className="mb-4">
            <p className="text-sm font-medium text-slate-600 mb-2">Try one of these:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {questions.slice(0, 4).map((q, i) => {
                     // Simple regex to split emoji from text
                    const match = q.match(/^(.*?)\s(.*)$/);
                    const emoji = match ? match[1] : '';
                    const text = match ? match[2] : q;

                    return (
                        <button
                            key={i}
                            onClick={() => onQuestionClick(q)}
                            className="p-3 bg-white text-slate-700 rounded-lg text-sm text-left border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm flex items-start space-x-2"
                        >
                           <span className="text-lg mt-0.5">{emoji}</span>
                           <span className="flex-1 font-medium">{renderInline(text)}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
