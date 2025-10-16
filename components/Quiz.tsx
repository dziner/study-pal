import React, { useState } from 'react';
import type { QuizData, UserAnswer } from '../types';

interface QuizProps {
    data: QuizData;
}

export const Quiz: React.FC<QuizProps> = ({ data }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const currentQuestion = data.questions[currentQuestionIndex];

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);
        const isCorrect = selectedOption === currentQuestion.correctAnswerIndex;
        setUserAnswers([
            ...userAnswers,
            {
                questionIndex: currentQuestionIndex,
                selectedOptionIndex: selectedOption,
                isCorrect,
            },
        ]);
    };

    const handleNext = () => {
        setIsSubmitted(false);
        setSelectedOption(null);
        if (currentQuestionIndex < data.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            setShowResults(true);
        }
    };
    
    const handleRestart = () => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setUserAnswers([]);
        setIsSubmitted(false);
        setShowResults(false);
    };

    if (showResults) {
        const score = userAnswers.filter(a => a.isCorrect).length;
        const total = data.questions.length;
        const percentage = Math.round((score / total) * 100);
        return (
            <div className="text-slate-800 p-2">
                <h3 className="font-bold text-lg mb-2">Quiz Results! 🎉</h3>
                <p className="font-semibold text-xl mb-4">You scored {score} out of {total} ({percentage}%)</p>
                <button
                    onClick={handleRestart}
                    className="w-full text-center px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }


    return (
        <div className="text-slate-800 p-2 space-y-4">
            <h2 className="text-lg font-bold">{data.title}</h2>
            <p className="text-sm font-semibold text-slate-600">Question {currentQuestionIndex + 1} of {data.questions.length}</p>
            <p className="font-medium">{currentQuestion.questionText}</p>
            
            <div className="space-y-2">
                {currentQuestion.options.map((option, index) => {
                    const isCorrectAnswer = index === currentQuestion.correctAnswerIndex;
                    const isSelectedAnswer = index === selectedOption;
                    let buttonClass = 'bg-white hover:bg-slate-100 text-slate-700';
                    if (isSubmitted) {
                        if (isCorrectAnswer) {
                            buttonClass = 'bg-green-200 text-green-800';
                        } else if (isSelectedAnswer) {
                            buttonClass = 'bg-red-200 text-red-800';
                        } else {
                            buttonClass = 'bg-white text-slate-500';
                        }
                    } else if (isSelectedAnswer) {
                        buttonClass = 'bg-blue-200 ring-2 ring-blue-500';
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => !isSubmitted && setSelectedOption(index)}
                            className={`w-full text-left p-3 rounded-lg border border-slate-300 transition-all text-sm font-medium ${buttonClass}`}
                            disabled={isSubmitted}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>

            {isSubmitted && (
                <div className="p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                    <p><strong>Explanation:</strong> {currentQuestion.explanation}</p>
                </div>
            )}

            <button
                onClick={isSubmitted ? handleNext : handleSubmit}
                disabled={selectedOption === null && !isSubmitted}
                className="w-full text-center px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
                {isSubmitted ? (currentQuestionIndex < data.questions.length - 1 ? 'Next Question' : 'Show Results') : 'Submit Answer'}
            </button>
        </div>
    );
};
