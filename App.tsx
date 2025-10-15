
import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

import type { DocumentData, ChatMessage, Model, ModelInfo } from './types';
import { initialBotMessage } from './constants';
import { processDocumentWithAI } from './services/geminiService';
import { IdleStateView } from './components/IdleStateView';
import { Spinner } from './components/Spinner';
import { DocumentIcon, PlusIcon, ChatIcon, SummaryIcon, ChevronDownIcon, TrashIcon, SendIcon, LogoIcon } from './components/icons';
import { ChatBubble } from './components/ChatBubble';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { AVAILABLE_MODEL_IDS } from './types';

// pdf.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MODELS: ModelInfo[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and cost-effective for most tasks.' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable model for complex reasoning.' }
];

const ModelSelector: React.FC<{
    selectedModel: Model;
    onModelChange: (model: Model) => void;
}> = ({ selectedModel, onModelChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleModelSelect = (model: Model) => {
        onModelChange(model);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">AI Model</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-slate-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm flex items-center justify-between"
            >
                <span>{MODELS.find(m => m.id === selectedModel)?.name}</span>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {MODELS.map((model) => (
                        <li
                            key={model.id}
                            onClick={() => handleModelSelect(model.id)}
                            className="text-slate-900 cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50"
                        >
                            <span className="font-semibold block truncate">{model.name}</span>
                            <p className="text-xs text-slate-500">{model.description}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


const App: React.FC = () => {
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [currentMessage, setCurrentMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'summary' | 'chat'>('summary');
    const [selectedModel, setSelectedModel] = useState<Model>(AVAILABLE_MODEL_IDS[0]);

    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [documents, activeDocumentId, isTyping]);


    const activeDocument = documents.find(d => d.id === activeDocumentId);

    const handleFileSelected = useCallback(async (file: File) => {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }
        const id = `${file.name}-${Date.now()}`;
        const newDoc: DocumentData = {
            id,
            file,
            summary: '',
            chat: null,
            chatHistory: [],
            processingState: 'reading',
            model: selectedModel,
        };
        setDocuments(docs => [...docs, newDoc]);
        setActiveDocumentId(id);
        setActiveTab('summary');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
            }
            
            setDocuments(docs => docs.map(d => d.id === id ? { ...d, processingState: 'summarizing' } : d));

            const { summary, chat, presetQuestions } = await processDocumentWithAI(fullText, selectedModel);
            
            setDocuments(docs => docs.map(d => d.id === id ? {
                ...d,
                summary,
                chat,
                presetQuestions,
                chatHistory: [initialBotMessage],
                processingState: 'done'
            } : d));
        } catch (error) {
            console.error("Error processing document:", error);
            setDocuments(docs => docs.map(d => d.id === id ? {
                ...d,
                processingState: 'error',
                errorMessage: error instanceof Error ? error.message : "An unknown error occurred while processing the PDF."
            } : d));
        }
    }, [selectedModel]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!activeDocument || !activeDocument.chat || isTyping || !messageText.trim()) return;

        const text = messageText.trim();
        setCurrentMessage('');

        const userMessage: ChatMessage = { sender: 'user', text };
        setDocuments(docs => docs.map(d => d.id === activeDocumentId ? { ...d, chatHistory: [...d.chatHistory, userMessage] } : d));
        setIsTyping(true);

        try {
            // FIX: Correctly access the generated text from the `GenerateContentResponse` object.
            const result = await activeDocument.chat.sendMessage(text);
            const botMessage: ChatMessage = { sender: 'bot', text: result.text };

            setDocuments(docs => {
                return docs.map(d => d.id === activeDocumentId ? { ...d, chatHistory: [...d.chatHistory, botMessage] } : d);
            });
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = { sender: 'bot', text: "Sorry, I encountered an error. Please try again." };
            setDocuments(docs => docs.map(d => d.id === activeDocumentId ? { ...d, chatHistory: [...d.chatHistory, errorMessage] } : d));
        } finally {
            setIsTyping(false);
        }
    }, [activeDocument, activeDocumentId, isTyping]);


    const handleNewChat = () => {
        setDocuments([]);
        setActiveDocumentId(null);
    };

    const handleDeleteDocument = (docId: string) => {
        setDocuments(docs => docs.filter(d => d.id !== docId));
        if (activeDocumentId === docId) {
            setActiveDocumentId(documents.length > 1 ? documents.filter(d => d.id !== docId)[0].id : null);
        }
    };

    const handlePresetQuestionClick = (question: string) => {
        handleSendMessage(question);
    };

    if (documents.length === 0) {
        return <IdleStateView onFileSelected={handleFileSelected} />;
    }

    const renderProcessingState = () => {
        if (!activeDocument) return null;
        
        const stateMap: Record<DocumentData['processingState'], { message: string, showSpinner: boolean }> = {
            reading: { message: "Reading your document...", showSpinner: true },
            summarizing: { message: "Summarizing key points...", showSpinner: true },
            generating_questions: { message: "Generating starter questions...", showSpinner: true },
            error: { message: `Error: ${activeDocument.errorMessage}`, showSpinner: false },
            done: { message: "", showSpinner: false }
        };

        const { message, showSpinner } = stateMap[activeDocument.processingState];

        if (activeDocument.processingState !== 'done') {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
                    {showSpinner && <Spinner />}
                    <p className="text-lg">{message}</p>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            {/* Sidebar */}
            <aside className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col p-4 space-y-4">
                <header className="flex items-center gap-2">
                    <LogoIcon />
                    <h1 className="text-xl font-bold text-slate-800">AI Study Pal</h1>
                </header>

                <button onClick={handleNewChat} className="flex items-center justify-center gap-2 w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    <PlusIcon />
                    New Chat
                </button>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Documents</h2>
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => { setActiveDocumentId(doc.id); setActiveTab('summary'); }}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer group ${activeDocumentId === doc.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <DocumentIcon />
                                <span className="truncate text-sm font-medium">{doc.file.name}</span>
                            </div>
                            <button onClick={(e) => {e.stopPropagation(); handleDeleteDocument(doc.id)}} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="border-t border-slate-200 pt-4">
                    <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                    <p className="text-xs text-slate-500 mt-2">The selected model will be used for new document uploads.</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                {activeDocument ? (
                    <div className="flex-1 flex flex-col min-h-0">
                        <header className="flex-shrink-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                             <h2 className="text-lg font-semibold text-slate-800 truncate" title={activeDocument.file.name}>
                                {activeDocument.file.name}
                            </h2>
                            {activeDocument.processingState === 'done' && (
                                <div className="flex items-center gap-2 p-1 bg-slate-200 rounded-lg">
                                    <button onClick={() => setActiveTab('summary')} className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-1 ${activeTab === 'summary' ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                                        <SummaryIcon/> Summary
                                    </button>
                                    <button onClick={() => setActiveTab('chat')} className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-1 ${activeTab === 'chat' ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                                        <ChatIcon /> Chat
                                    </button>
                                </div>
                            )}
                        </header>

                        <div className="flex-1 p-6 overflow-y-auto bg-white">
                            {renderProcessingState()}
                            {activeDocument.processingState === 'done' && (
                                <>
                                    {activeTab === 'summary' && (
                                        <div className="prose max-w-none">
                                            <MarkdownRenderer content={activeDocument.summary} />
                                        </div>
                                    )}
                                    {activeTab === 'chat' && (
                                        <div className="flex flex-col h-full">
                                            <div ref={chatHistoryRef} className="flex-1 space-y-4 overflow-y-auto pr-2 -mr-2">
                                                {activeDocument.chatHistory.map((msg, index) => (
                                                    <ChatBubble key={index} sender={msg.sender} text={msg.text} />
                                                ))}
                                                {isTyping && <ChatBubble sender="bot" text="" isTyping />}
                                            </div>
                                            
                                            <div className="pt-4 mt-auto">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                                                    {activeDocument.presetQuestions?.map((q, i) => (
                                                        <button key={i} onClick={() => handlePresetQuestionClick(q)} className="p-2 border border-slate-300 rounded-lg text-sm text-slate-700 text-left hover:bg-slate-100 transition-colors">{q}</button>
                                                    ))}
                                                </div>
                                                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(currentMessage); }} className="relative">
                                                    <input
                                                        type="text"
                                                        value={currentMessage}
                                                        onChange={(e) => setCurrentMessage(e.target.value)}
                                                        placeholder="Ask a question about the document..."
                                                        className="w-full p-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        disabled={isTyping}
                                                    />
                                                    <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400" disabled={isTyping || !currentMessage.trim()}>
                                                        <SendIcon />
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">Select a document to get started.</div>
                )}
            </main>
        </div>
    );
};

export default App;
