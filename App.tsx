
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Chat } from '@google/genai';
import { processDocumentWithAI } from './services/geminiService';
import type { DocumentData, ChatMessage, Model, ModelInfo } from './types';
// FIX: Import from constants.ts which is now a proper module.
import { initialBotMessage } from './constants';
import { ChatBubble } from './components/ChatBubble';
import { Spinner } from './components/Spinner';
import { SendIcon, LogoIcon, DocumentIcon, ChatIcon, PlusIcon, SummaryIcon, ChevronDownIcon, TrashIcon } from './components/icons';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { IdleStateView } from './components/IdleStateView';


// pdfjs worker configuration
const pdfjs = (window as any).pdfjsLib;
if (pdfjs) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';
}

const AVAILABLE_MODELS: ModelInfo[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and cost-effective for most tasks.' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning for complex topics.' }
];

const FileList: React.FC<{
    documents: DocumentData[];
    selectedDocId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onTriggerUpload: () => void;
}> = ({ documents, selectedDocId, onSelect, onDelete, onTriggerUpload }) => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
        <div className="p-3 border-b border-slate-200">
            <button
                onClick={onTriggerUpload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-sm"
            >
                <PlusIcon /> New File
            </button>
        </div>
        <div className="flex-1 overflow-y-auto">
            <ul className="p-2 space-y-1">
                {documents.map(doc => (
                    <li key={doc.id} className="group relative">
                        <button
                            onClick={() => onSelect(doc.id)}
                            className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ${selectedDocId === doc.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100'}`}
                        >
                            <DocumentIcon />
                            <span className="flex-1 truncate text-sm font-medium text-slate-700">{doc.file.name}</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete file"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
        <div className="p-4 text-center">
            <p style={{ fontFamily: "'Mynerve', cursive" }} className="text-slate-500 text-sm">
                Powered by your daddy.
            </p>
        </div>
    </div>
);

const PdfPage: React.FC<{ page: any, containerWidth: number }> = ({ page, containerWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!page || !canvasRef.current || containerWidth === 0) return;
        
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if(!context) return;
        
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderTask = page.render({ canvasContext: context, viewport: scaledViewport });
        renderTaskRef.current = renderTask;
        
        return () => {
             if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };

    }, [page, containerWidth]);

    return <canvas ref={canvasRef} className="block mx-auto my-4 rounded-md shadow-md" />;
};


const PdfViewer: React.FC<{ document?: DocumentData, pages: any[] }> = ({ document, pages }) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setWidth(entries[0].contentRect.width - 32); // Subtract padding
            }
        });

        if (viewerRef.current) {
            observer.observe(viewerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const getProcessingMessage = () => {
        if (!document) return '';
        const modelInfo = AVAILABLE_MODELS.find(m => m.id === document.model);
        const modelName = modelInfo ? modelInfo.name : document.model;
        switch(document.processingState) {
            case 'reading': return 'Reading document...';
            case 'summarizing': return `Summarizing with ${modelName}...`;
            case 'generating_questions': return `Generating smart questions with ${modelName}... 🤔`;
            default: return '';
        }
    }

    return(
    <div ref={viewerRef} className="flex-1 h-full overflow-y-auto bg-slate-100 p-4">
        {!document && (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                     <LogoIcon />
                     <h2 className="mt-4 text-xl font-bold text-slate-800">Welcome to Kangmul+Joan's AI Study Pal</h2>
                     <p className="text-slate-500">Select a document to start learning.</p>
                </div>
            </div>
        )}
        {document && document.processingState !== 'done' && document.processingState !== 'error' && (
             <div className="flex flex-col items-center justify-center h-full text-center">
                <Spinner />
                <p className="mt-4 text-lg font-medium text-slate-600">
                   {getProcessingMessage()}
                </p>
            </div>
        )}
        {document?.processingState === 'error' && (
            <div className="flex items-center justify-center h-full text-red-600 p-4 bg-red-50 rounded-lg">
                <p className="font-semibold">Error:</p>
                <p>{document.errorMessage}</p>
            </div>
        )}
        {document?.processingState === 'done' && pages.map((page, index) => (
             <PdfPage key={`${document.id}-page-${index}`} page={page} containerWidth={width} />
        ))}
    </div>
)};

const ModelSelector: React.FC<{
    availableModels: ModelInfo[];
    selectedModel: Model;
    onModelChange: (model: Model) => void;
    currentDocModel?: Model;
}> = ({ availableModels, selectedModel, onModelChange, currentDocModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentModelInfo = availableModels.find(m => m.id === (currentDocModel || selectedModel));

    const handleSelect = (model: Model) => {
        onModelChange(model);
        setIsOpen(false);
    };

    return (
        <div className="relative text-sm">
            <div className="text-xs text-slate-500 mb-1 flex justify-between">
                <span>{currentDocModel ? `Current Chat Model` : 'Model for New Chat'}</span>
                <span className="opacity-70">Daily Tokens: N/A</span>
            </div>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex items-center justify-between w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-200 transition-colors"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <span>{currentModelInfo?.name || selectedModel}</span>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg bottom-full mb-1">
                    {availableModels.map(model => (
                        <li key={model.id}>
                            <button onClick={() => handleSelect(model.id)} className="w-full text-left px-3 py-2 hover:bg-slate-100">
                                <p className="font-semibold">{model.name}</p>
                                <p className="text-xs text-slate-500">{model.description}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const PresetQuestions: React.FC<{questions: string[], onQuestionClick: (q: string) => void}> = ({ questions, onQuestionClick }) => (
    <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Not sure where to start? Try one of these:</h3>
        <div className="flex flex-col items-stretch gap-2">
            {questions.map((q, i) => (
                <button 
                    key={i} 
                    onClick={() => onQuestionClick(q)}
                    className="text-left px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-sm hover:bg-sky-200 transition-colors"
                >
                    {q}
                </button>
            ))}
        </div>
    </div>
);


const SidePanel: React.FC<{
    document?: DocumentData;
    onSendMessage: (message: string) => void;
    isBotTyping: boolean;
    availableModels: ModelInfo[];
    selectedModel: Model;
    onModelChange: (model: Model) => void;
}> = ({ document, onSendMessage, isBotTyping, availableModels, selectedModel, onModelChange }) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'summary'>('chat');
    const [userInput, setUserInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [document?.chatHistory, isBotTyping]);
    
    useEffect(() => {
        setActiveTab('chat');
    }, [document?.id])

    const handleSend = (message: string) => {
        if (!message.trim() || !document || !document.chat) return;
        onSendMessage(message);
        setUserInput('');
    };

    if (!document) {
        return <div className="flex items-center justify-center h-full bg-white text-slate-500 p-4 text-center">Select or upload a document to begin your AI-powered study session.</div>;
    }
    
    const showPresetQuestions = document.chatHistory.length <= 1 && document.presetQuestions && document.presetQuestions.length > 0;

    return (
        <div className="flex flex-col h-full bg-white border-l border-slate-200">
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 font-semibold transition-colors ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <ChatIcon /> AI Chat
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 font-semibold transition-colors ${activeTab === 'summary' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <SummaryIcon /> Summary
                </button>
            </div>

            {activeTab === 'summary' && (
                <div className="flex-1 p-4 overflow-y-auto prose prose-slate max-w-none">
                    {document.processingState === 'done' ? <MarkdownRenderer content={document.summary} /> : <div className="flex items-center justify-center h-full text-slate-500">Summary is being generated...</div> }
                </div>
            )}
            
            {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div ref={chatContainerRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {showPresetQuestions && <PresetQuestions questions={document.presetQuestions!} onQuestionClick={(q) => handleSend(q)} />}
                        {document.chatHistory.map((msg, index) => (
                            <ChatBubble key={index} sender={msg.sender} text={msg.text} />
                        ))}
                        {isBotTyping && <ChatBubble sender="bot" text="" isTyping />}
                    </div>
                    <div className="p-4 border-t border-slate-200 space-y-3">
                         <ModelSelector 
                            availableModels={availableModels}
                            selectedModel={selectedModel}
                            onModelChange={onModelChange}
                            currentDocModel={document.model}
                         />
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend(userInput)}
                                placeholder="Ask a question..."
                                className="flex-1 w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isBotTyping || document.processingState !== 'done'}
                            />
                            <button
                                onClick={() => handleSend(userInput)}
                                disabled={isBotTyping || !userInput.trim() || document.processingState !== 'done'}
                                className="p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResizablePanels: React.FC<{ children: React.ReactNode[] }> = ({ children }) => {
    const [panelWidths, setPanelWidths] = useState([20, 50, 30]);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDrag = (dividerIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidths = [...panelWidths];

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!containerRef.current) return;
            const containerWidth = containerRef.current.offsetWidth;
            const dx = moveEvent.clientX - startX;
            const dWidthPercent = (dx / containerWidth) * 100;

            const newWidths = [...startWidths];
            newWidths[dividerIndex] += dWidthPercent;
            newWidths[dividerIndex + 1] -= dWidthPercent;

            // Enforce min width (e.g., 15%)
            if (newWidths.some(w => w < 15)) return;

            setPanelWidths(newWidths);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    return (
        <div ref={containerRef} className="flex-1 flex overflow-hidden">
            <div style={{ width: `${panelWidths[0]}%` }} className="h-full flex-shrink-0">{children[0]}</div>
            <div onMouseDown={(e) => handleDrag(0, e)} className="w-1.5 h-full bg-slate-200 hover:bg-blue-300 cursor-col-resize transition-colors"/>
            <div style={{ width: `${panelWidths[1]}%` }} className="h-full flex-shrink-0 flex flex-col">{children[1]}</div>
            <div onMouseDown={(e) => handleDrag(1, e)} className="w-1.5 h-full bg-slate-200 hover:bg-blue-300 cursor-col-resize transition-colors"/>
            <div style={{ width: `${panelWidths[2]}%` }} className="h-full flex-shrink-0">{children[2]}</div>
        </div>
    )
}

const App: React.FC = () => {
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [pdfPages, setPdfPages] = useState<any[]>([]);
    const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<Model>('gemini-2.5-flash');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedDoc = documents.find(doc => doc.id === selectedDocId);

    useEffect(() => {
        const loadPages = async () => {
            if (selectedDoc && selectedDoc.pdfDoc) {
                const pages = [];
                for (let i = 1; i <= selectedDoc.pdfDoc.numPages; i++) {
                    const page = await selectedDoc.pdfDoc.getPage(i);
                    pages.push(page);
                }
                setPdfPages(pages);
            } else {
                setPdfPages([]);
            }
        };
        loadPages();
    }, [selectedDoc]);

    const updateDocument = (id: string, updates: Partial<DocumentData>) => {
        setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, ...updates } : doc));
    };

    const handleFileChange = async (file: File | null) => {
        if (!file || !file.type.includes('pdf')) return;
        
        const docId = `${file.name}-${Date.now()}`;
        const newDoc: DocumentData = {
            id: docId,
            file,
            summary: '',
            chat: null,
            chatHistory: [], // Will be populated after AI processing
            processingState: 'reading',
            model: selectedModel,
        };

        setDocuments(prev => [newDoc, ...prev]);
        setSelectedDocId(docId);

        try {
            const fileBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjs.getDocument(fileBuffer).promise;
            
            updateDocument(docId, { pdfDoc, processingState: 'summarizing' });
            
            let fullText = '';
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
            }
            
            updateDocument(docId, { processingState: 'generating_questions' });
            const { summary, chat, presetQuestions } = await processDocumentWithAI(fullText, selectedModel);
            updateDocument(docId, { summary, chat, presetQuestions, chatHistory: [initialBotMessage], processingState: 'done' });
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            updateDocument(docId, { processingState: 'error', errorMessage: `Failed to process: ${errorMessage}` });
        }
    };
    
    const handleDeleteDocument = (idToDelete: string) => {
        setDocuments(prev => prev.filter(doc => doc.id !== idToDelete));
        if (selectedDocId === idToDelete) {
            const remainingDocs = documents.filter(doc => doc.id !== idToDelete);
            setSelectedDocId(remainingDocs.length > 0 ? remainingDocs[0].id : null);
            setPdfPages([]);
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!selectedDoc || !selectedDoc.chat) return;
        
        const docId = selectedDoc.id;
        const chat = selectedDoc.chat;
    
        // Correctly append user message using a functional update
        setDocuments(prevDocs => 
            prevDocs.map(doc =>
                doc.id === docId 
                    ? { ...doc, chatHistory: [...doc.chatHistory, { sender: 'user', text: message }] } 
                    : doc
            )
        );
    
        setIsBotTyping(true);
    
        try {
            const responseStream = await chat.sendMessageStream({ message });
            let fullText = "";
            let firstChunk = true;
    
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (typeof chunkText !== 'string') continue;
                
                fullText += chunkText;
    
                setDocuments(prevDocs => prevDocs.map(doc => {
                    if (doc.id !== docId) return doc;
    
                    const updatedHistory = [...doc.chatHistory];
                    const lastMessageIndex = updatedHistory.length - 1;
    
                    if (firstChunk) {
                        // For the first chunk, add a new bot message bubble
                        updatedHistory.push({ sender: 'bot', text: fullText });
                        firstChunk = false;
                    } else if (lastMessageIndex >= 0 && updatedHistory[lastMessageIndex].sender === 'bot') {
                        // For subsequent chunks, update the last message immutably
                        const updatedLastMessage = { ...updatedHistory[lastMessageIndex], text: fullText };
                        updatedHistory[lastMessageIndex] = updatedLastMessage;
                    }
                    
                    return { ...doc, chatHistory: updatedHistory };
                }));
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMsg: ChatMessage = { sender: 'bot', text: "Sorry, I ran into a little trouble. Please try again!" };
            setDocuments(prevDocs => prevDocs.map(doc => 
                doc.id === docId ? { ...doc, chatHistory: [...doc.chatHistory, errorMsg] } : doc
            ));
        } finally {
            setIsBotTyping(false);
        }
    };
    
    const handleTriggerUpload = () => fileInputRef.current?.click();

    if (documents.length === 0) {
        return <IdleStateView onFileSelected={handleFileChange} />
    }

    return (
        <div className="flex flex-col h-screen font-sans text-slate-800 bg-slate-50">
            <header className="flex items-center justify-between p-3 border-b border-slate-200 shadow-sm z-10 bg-white">
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    <h1 className="text-xl font-bold text-slate-800">Kangmul+Joan's AI Study Pal</h1>
                </div>
            </header>

            <ResizablePanels>
                <FileList 
                    documents={documents} 
                    selectedDocId={selectedDocId} 
                    onSelect={setSelectedDocId} 
                    onDelete={handleDeleteDocument}
                    onTriggerUpload={handleTriggerUpload} 
                />
                <PdfViewer document={selectedDoc} pages={pdfPages} />
                <SidePanel 
                    document={selectedDoc}
                    onSendMessage={handleSendMessage}
                    isBotTyping={isBotTyping}
                    availableModels={AVAILABLE_MODELS}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                />
            </ResizablePanels>
            
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                accept=".pdf"
            />
        </div>
    );
};

export default App;