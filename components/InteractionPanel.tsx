import React, { useState, useEffect, useRef } from 'react';
import type { DocumentData, ChatMessage, QuizData } from '../types';
import { ChatIcon, SummaryIcon, CopyIcon, DownloadIcon, MicrophoneIcon } from './icons';
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
    const [activeView, setActiveView] = useState<'summary' | 'chat'>('summary');
    const [userInput, setUserInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
    const [isListening, setIsListening] = useState(false);
    
    const summaryRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null); // SpeechRecognition instance

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
    
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [document.chatHistory, isBotTyping, currentQuiz]);

    const handleCopyToClipboard = () => {
        if (summaryRef.current) {
            navigator.clipboard.writeText(summaryRef.current.innerText)
                .then(() => alert('Summary copied to clipboard!'))
                .catch(err => console.error('Failed to copy text: ', err));
        }
    };
    
    const handleDownloadPdf = () => {
        if (summaryRef.current && typeof jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
            const { jsPDF } = jspdf;
            const content = summaryRef.current;
            const docName = document.file.name.replace(/\.[^/.]+$/, "");

            html2canvas(content, { scale: 2 }).then((canvas: any) => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                const height = pdfWidth / ratio;
                
                let position = 0;
                let remainingHeight = canvasHeight;
                
                while(remainingHeight > 0) {
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, height);
                    remainingHeight -= canvasHeight;
                    if (remainingHeight > 0) {
                       pdf.addPage();
                    }
                }
                pdf.save(`${docName}-summary.pdf`);
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <button onClick={() => setActiveView('summary')} className={`flex-1 justify-center flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeView === 'summary' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}>
                        <SummaryIcon /> <span className="ml-1.5">Summary</span>
                    </button>
                    <button onClick={() => setActiveView('chat')} className={`flex-1 justify-center flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeView === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}>
                        <ChatIcon /> <span className="ml-1.5">Chat</span>
                    </button>
                </div>
            </div>
            
             {activeView === 'summary' && (
                 <div className="flex-1 overflow-y-auto">
                    <div className="p-4 bg-white border-b">
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
            )}
            {activeView === 'chat' && (
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {document.chatHistory.map((msg, index) => <ChatBubble key={index} message={msg} />)}
                        {isBotTyping && <ChatBubble message={{sender: 'bot', text: '...'}} />}
                        {currentQuiz && <div className="bg-white rounded-lg shadow p-2 sm:p-4 max-w-xl mx-auto"><Quiz data={currentQuiz}/></div>}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200">
                        <div className="max-w-3xl mx-auto">
                            {document.chatHistory.length <= 1 && document.presetQuestions && (
                                <PresetQuestions questions={document.presetQuestions} onQuestionClick={(q) => handleSendMessage(q)} />
                            )}
                            <div className="relative flex items-center">
                                <textarea
                                    rows={1}
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(userInput)}}}
                                    placeholder="Ask a question..."
                                    className="w-full p-3 pl-12 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-white"
                                    disabled={isBotTyping}
                                />
                                 <button onClick={toggleListening} className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening ? 'text-red-500' : 'text-slate-500 hover:bg-slate-100'}`}>
                                    <MicrophoneIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleSendMessage(userInput)} disabled={isBotTyping || !userInput} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-blue-500 hover:bg-blue-100 disabled:text-slate-400 disabled:bg-transparent">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};