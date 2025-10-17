import React, { useState, useEffect, useRef } from 'react';
import type { DocumentData, ChatMessage, QuizData } from '../types';
import { ChatIcon, SummaryIcon, CopyIcon, DownloadIcon, MicrophoneIcon, QuizIcon } from './icons';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatBubble } from './ChatBubble';
import { PresetQuestions } from './PresetQuestions';
import { Quiz } from './Quiz';

// Assuming jspdf and html2canvas are loaded from CDN
declare const jspdf: any;
declare const html2canvas: any;

interface InteractionPanelProps {
    document: DocumentData;
    onChatHistoryChange: (history: ChatMessage[]) => void;
}

export const InteractionPanel: React.FC<InteractionPanelProps> = ({ document, onChatHistoryChange }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'chat'>('summary');
    const [userInput, setUserInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [showChatTooltip, setShowChatTooltip] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false); // State for toast visibility
    const [isPresetQuestionsOpen, setIsPresetQuestionsOpen] = useState(true);
    
    const summaryRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null); // SpeechRecognition instance

    // Effect to show a tooltip guiding the user to the chat tab
    useEffect(() => {
        if (document.processingState === 'done' && activeTab === 'summary') {
            const tooltipTimer = setTimeout(() => {
                setShowChatTooltip(true);
                const hideTimer = setTimeout(() => {
                    setShowChatTooltip(false);
                }, 5000);
                return () => clearTimeout(hideTimer);
            }, 700);
            return () => clearTimeout(tooltipTimer);
        }
    }, [document.id, document.processingState, activeTab]);

    const handleChatTabClick = () => {
        setActiveTab('chat');
        setShowChatTooltip(false); // Hide tooltip when user clicks the tab
    };

    // Speech Recognition Setup
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0])
                    .map((result) => result.transcript)
                    .join('');
                setUserInput(transcript);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    const handleSendMessage = async (messageText: string) => {
        if (!document.chat || isBotTyping) return;
        
        const text = messageText.trim();
        if(!text) return;

        setUserInput('');
        setIsBotTyping(true);
        setCurrentQuiz(null);

        const updatedHistory: ChatMessage[] = [...document.chatHistory, { sender: 'user', text }];
        onChatHistoryChange(updatedHistory);
        
        try {
            const response = await document.chat.sendMessage({ message: text });
            let botResponseText = response.text;

            // Check for quiz data
            const quizMatch = botResponseText.match(/<quiz_data>([\s\S]*?)<\/quiz_data>/);
            if (quizMatch && quizMatch[1]) {
                 // Show a temp "crafting quiz" message
                const craftingMessage: ChatMessage = { sender: 'bot', text: "Crafting your quiz... 🧠✨" };
                onChatHistoryChange([...updatedHistory, craftingMessage]);
                
                try {
                    // Small delay to make the "crafting" message visible
                    await new Promise(res => setTimeout(res, 1500));
                    const quizJson = JSON.parse(quizMatch[1]);
                    setCurrentQuiz(quizJson);
                    botResponseText = "Great! I've created a quiz for you. Check it out! 👇";
                    const finalBotMessage: ChatMessage = { sender: 'bot', text: botResponseText };
                    onChatHistoryChange([...updatedHistory, finalBotMessage]);

                } catch (e) {
                    console.error("Failed to parse quiz JSON:", e);
                    botResponseText = "I tried to create a quiz, but there was an error in the format. Please try asking again.";
                    const errorBotMessage: ChatMessage = { sender: 'bot', text: botResponseText };
                    onChatHistoryChange([...updatedHistory, errorBotMessage]);
                }
            } else {
                 const botMessage: ChatMessage = { sender: 'bot', text: botResponseText };
                 onChatHistoryChange([...updatedHistory, botMessage]);
            }
            
        } catch(e) {
            console.error("Error sending message:", e);
            const errorMessage: ChatMessage = { sender: 'bot', text: "Sorry, I encountered an error. Please try again. 🙏" };
            onChatHistoryChange([...updatedHistory, errorMessage]);
        } finally {
            setIsBotTyping(false);
        }
    };

    const handleCreateAnotherQuiz = () => {
        handleSendMessage("Create another quiz for me based on the document.");
    };
    
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [document.chatHistory, isBotTyping, currentQuiz]);

    const handleCopyToClipboard = () => {
        if (summaryRef.current) {
            navigator.clipboard.writeText(summaryRef.current.innerText)
                .then(() => {
                    setShowCopyToast(true);
                    setTimeout(() => setShowCopyToast(false), 2000); // Hide after 2 seconds
                })
                .catch(err => console.error('Failed to copy text: ', err));
        }
    };
    
    const handleDownloadPdf = () => {
        if (summaryRef.current && typeof jspdf !== 'undefined') {
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4'
            });
            const content = summaryRef.current;
            const docName = document.file.name.replace(/\.[^/.]+$/, "");

            pdf.html(content, {
                callback: function (doc: any) {
                    doc.save(`${docName}-summary.pdf`);
                },
                margin: [40, 40, 40, 40], // top, right, bottom, left
                autoPaging: 'text',
                width: 515, // A4 width in points (595) - left/right margins (40*2)
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <button onClick={() => setActiveTab('summary')} className={`flex-1 justify-center flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'summary' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}>
                        <SummaryIcon /> <span className="ml-1.5">Summary</span>
                    </button>
                    <div className="relative flex-1">
                        <button onClick={handleChatTabClick} className={`w-full justify-center flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}>
                            <ChatIcon /> <span className="ml-1.5">Chat</span>
                        </button>
                            {showChatTooltip && (
                            <div className="absolute top-full left-0 mt-2 w-max px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-md shadow-lg animate-bounce z-10 whitespace-nowrap">
                                Start asking questions here! 💬
                                <div className="absolute left-8 -translate-x-1/2 bottom-full w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-blue-500"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className={`flex-1 flex-col overflow-y-auto ${activeTab === 'summary' ? 'flex' : 'hidden'}`}>
                <div className="flex-shrink-0 p-4 bg-white border-b">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-slate-800">Summary</h3>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleCopyToClipboard} className="flex items-center space-x-1 text-sm text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100">
                                <CopyIcon /> <span>Copy</span>
                            </button>
                                <button onClick={handleDownloadPdf} className="flex items-center space-x-1 text-sm text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100">
                                <DownloadIcon /> <span>PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div ref={summaryRef} className="p-6 bg-white">
                    <MarkdownRenderer content={document.summary} />
                </div>
            </div>
            
            <div className={`flex-1 flex-col bg-white overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {document.chatHistory.map((msg, index) => <ChatBubble key={index} message={msg} />)}
                    {isBotTyping && <ChatBubble message={{sender: 'bot', text: '...'}} />}
                    {currentQuiz && (
                        <div className="flex items-start gap-3 w-full justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <QuizIcon />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl rounded-bl-sm shadow-md p-2 sm:p-4 max-w-xl w-full">
                                <Quiz data={currentQuiz} onCreateAnotherQuiz={handleCreateAnotherQuiz} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-3xl mx-auto">
                        {document.presetQuestions && (
                            <PresetQuestions
                                isOpen={isPresetQuestionsOpen}
                                setIsOpen={setIsPresetQuestionsOpen}
                                questions={document.presetQuestions}
                                onQuestionClick={(q) => {
                                    handleSendMessage(q);
                                    setIsPresetQuestionsOpen(false);
                                }}
                            />
                        )}
                        <div className="flex items-start gap-2 p-1.5 bg-white border border-slate-300 rounded-xl focus-within:border-blue-400 transition-colors">
                             <button
                                onClick={toggleListening}
                                className={`flex-shrink-0 p-2 rounded-full ${isListening ? 'text-red-500 bg-red-100' : 'text-slate-500 hover:bg-slate-100'}`}
                                aria-label={isListening ? 'Stop listening' : 'Start listening'}
                            >
                                <MicrophoneIcon className="h-6 w-6" />
                            </button>
                            <textarea
                                rows={2}
                                value={userInput}
                                onChange={(e) => {
                                    setUserInput(e.target.value);
                                    const target = e.currentTarget;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                }}
                                onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(userInput)}}}
                                placeholder="Ask a question..."
                                className="w-full border-none focus:ring-0 focus:outline-none resize-none bg-transparent py-2 text-base placeholder-slate-500"
                                style={{ maxHeight: '150px' }}
                                disabled={isBotTyping}
                                aria-label="Chat input"
                            />
                            <button
                                onClick={() => handleSendMessage(userInput)}
                                disabled={isBotTyping || !userInput.trim()}
                                className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center self-end disabled:bg-slate-200 disabled:cursor-not-allowed enabled:bg-blue-500 enabled:text-white hover:enabled:bg-blue-600 transition-colors"
                                aria-label="Send message"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm py-2 px-4 rounded-full shadow-lg transition-all duration-300 ${showCopyToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
                Summary copied to clipboard!
            </div>
        </div>
    );
};