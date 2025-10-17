import React from 'react';
import { renderInline } from './MarkdownRenderer';
import { ChevronDownIcon, ChevronUpIcon, LightbulbIcon } from './icons';

interface PresetQuestionsProps {
    questions: string[];
    onQuestionClick: (question: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const PresetQuestions: React.FC<PresetQuestionsProps> = ({ questions, onQuestionClick, isOpen, setIsOpen }) => {
    return (
        <div className="mb-4">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex justify-between items-center text-sm font-medium text-slate-600 p-2 rounded-lg hover:bg-slate-100 focus:outline-none"
                aria-expanded={isOpen}
            >
                <span className="flex items-center">
                    <LightbulbIcon className="h-5 w-5 mr-2 text-yellow-500" />
                    Try one of these
                </span>
                {isOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
            </button>
            
            {isOpen && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                    {questions.map((q, i) => {
                         // Simple regex to split emoji from text
                        const match = q.match(/^(.*?)\s(.*)$/);
                        const emoji = match ? match[1] : '';
                        const text = match ? match[2] : q;
                        const isQuizQuestion = text.toLowerCase().includes('quiz');

                        return (
                            <button
                                key={i}
                                onClick={() => onQuestionClick(q)}
                                className={`p-3 rounded-lg text-left border transition-all shadow-sm flex items-start space-x-2 ${
                                    isQuizQuestion
                                    ? 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200 font-semibold'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                            >
                               <span className="text-lg mt-0.5">{emoji}</span>
                               <span className="flex-1 font-medium">{renderInline(text)}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    );
};