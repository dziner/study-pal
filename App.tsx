import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentData, ChatMessage, QuizData, Model } from './types';
import { IdleStateView } from './components/IdleStateView';
import { MenuIcon, PlusIcon, DocumentIcon, TrashIcon, PreviewIcon } from './components/icons';
import { processDocumentWithAI } from './services/geminiService';
import { initialBotMessage } from './constants';
import { PdfViewer } from './components/PdfViewer';
import { InteractionPanel } from './components/InteractionPanel';
import { Spinner } from './components/Spinner';
import { AVAILABLE_MODEL_IDS } from './types';


const fileToBase64 = (file: File): Promise<{mimeType: string, data: string}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const [mimeType, data] = result.split(',');
            resolve({ mimeType: file.type, data });
        };
        reader.onerror = error => reject(error);
    });
};

const App: React.FC = () => {
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isFileListOpen, setIsFileListOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    // Add window resize listener
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // On desktop, ensure sidebars are open
            if(!mobile){
                setIsFileListOpen(true);
                setIsPreviewOpen(true);
            } else {
                setIsFileListOpen(false);
                setIsPreviewOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // initial check
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const activeDocument = documents.find(d => d.id === activeDocumentId);

    const updateDocument = useCallback((docId: string, updates: Partial<DocumentData>) => {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
    }, []);
    
    const handleFileSelected = useCallback(async (file: File) => {
        const newDocId = `doc-${Date.now()}`;
        const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';

        const newDoc: DocumentData = {
            id: newDocId,
            file,
            fileType,
            summary: '',
            chat: null,
            chatHistory: [], // Start with empty history
            processingState: 'reading',
            model: 'gemini-2.5-flash',
        };

        if (fileType === 'image') {
            const { data } = await fileToBase64(file);
            newDoc.imageUrl = `data:${file.type};base64,${data}`;
        }

        setDocuments(prev => [newDoc, ...prev]);
        setActiveDocumentId(newDocId);
        if (isMobile) {
            setIsFileListOpen(false);
            setIsPreviewOpen(false);
        }

        try {
            updateDocument(newDocId, { processingState: 'summarizing' });
            
            const { summary, chat, presetQuestions } = await processDocumentWithAI({
                file,
                model: newDoc.model,
            });

            updateDocument(newDocId, { 
                summary, 
                chat, 
                presetQuestions,
                processingState: 'done',
                chatHistory: [initialBotMessage], // Add initial message now
             });

        } catch (error) {
            console.error("Error processing document:", error);
            updateDocument(newDocId, { 
                processingState: 'error', 
                errorMessage: 'An error occurred while analyzing the document. Please try again.'
            });
        }
    }, [isMobile, updateDocument]);


    const handleDeleteDocument = (docId: string) => {
        setDocuments(docs => {
            const newDocs = docs.filter(d => d.id !== docId);
            if (activeDocumentId === docId) {
                setActiveDocumentId(newDocs.length > 0 ? newDocs[0].id : null);
            }
            return newDocs;
        });
    };
    
    const handleNewSession = () => {
        setDocuments([]);
        setActiveDocumentId(null);
    };
    
    const handleModelChange = (docId: string, model: Model) => {
        updateDocument(docId, { model });
        // NOTE: In a real app, you might want to re-process the document with the new model.
        // For simplicity here, we just update it for future chats.
    };

    if (documents.length === 0) {
        return <IdleStateView onFileSelected={handleFileSelected} />;
    }

    const fileListPanel = (
        <div className="bg-white border-r border-slate-200 flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 flex-shrink-0 flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-800">My Study Pal</h1>
            </div>
            <div className="flex-grow overflow-y-auto">
                <button onClick={handleNewSession} className="flex items-center w-full text-left p-3 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                    <PlusIcon />
                    <span className="ml-2">New Session</span>
                </button>
                <div className="mt-2">
                    {documents.map(doc => (
                        <div key={doc.id} onClick={() => setActiveDocumentId(doc.id)} className={`flex items-center justify-between p-3 mx-2 rounded-lg cursor-pointer ${activeDocumentId === doc.id ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <div className="flex items-center overflow-hidden">
                                <DocumentIcon />
                                <span className="ml-2 text-sm font-medium truncate">{doc.file.name}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="ml-2 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 flex-shrink-0">
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex-shrink-0">
                <div className="text-center text-sm text-slate-500 mb-3">
                    <p style={{ fontFamily: "'Mynerve', cursive" }}>Powered by your daddy.</p>
                </div>
                 {activeDocument && (
                    <div>
                        <label className="text-xs text-slate-500 font-semibold mb-1 block">AI Model</label>
                        <select
                            value={activeDocument.model}
                            onChange={(e) => handleModelChange(activeDocument.id, e.target.value as Model)}
                            className="w-full p-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                            {AVAILABLE_MODEL_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-100 font-sans text-slate-800 overflow-hidden">
             {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-2 bg-white border-b border-slate-200 flex-shrink-0">
                <button onClick={() => setIsFileListOpen(!isFileListOpen)} className="p-2 rounded-md hover:bg-slate-100">
                    <MenuIcon className="h-6 w-6" />
                </button>
                <h2 className="font-semibold truncate">{activeDocument?.file.name || 'AI Study Pal'}</h2>
                <button onClick={() => setIsPreviewOpen(!isPreviewOpen)} className="p-2 rounded-md hover:bg-slate-100" disabled={!activeDocument}>
                    <PreviewIcon className="h-6 w-6" />
                </button>
            </header>
            
            <div className="flex flex-1 overflow-hidden">
                {/* File List Panel (Desktop) */}
                <aside className="hidden md:block w-72 flex-shrink-0">
                    {fileListPanel}
                </aside>

                {/* File List Panel (Mobile Overlay) */}
                 {isMobile && isFileListOpen && (
                    <div className="absolute top-0 left-0 h-full w-4/5 max-w-sm bg-white z-30 shadow-lg">
                        {fileListPanel}
                        <button onClick={() => setIsFileListOpen(false)} className="absolute top-2 right-2 p-2 text-slate-500">&times;</button>
                    </div>
                )}
                 {isMobile && isFileListOpen && <div className="absolute inset-0 bg-black/30 z-20" onClick={() => setIsFileListOpen(false)}></div>}


                {/* Main Content: Preview + Interaction */}
                {isMobile && activeDocument && activeDocument.processingState !== 'done' ? (
                     <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white h-full">
                        <Spinner />
                        <p className="mt-4 text-slate-600 font-medium capitalize">Analyzing document...</p>
                        <p className="mt-2 text-slate-500 max-w-xs">Please wait a moment while AI is working its magic.</p>
                        {activeDocument.processingState === 'error' && <p className="mt-4 text-red-600 bg-red-100 p-3 rounded-lg text-sm">{activeDocument.errorMessage}</p>}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* Preview Panel */}
                        <main className={`${!isPreviewOpen && isMobile ? 'hidden' : 'flex'} flex-1 bg-slate-200 relative flex-col overflow-y-auto`}>
                            {isMobile && (
                                <button onClick={() => setIsPreviewOpen(false)} className="absolute top-2 right-2 z-10 p-2 bg-white/70 rounded-full shadow-md text-slate-600 backdrop-blur-sm">&times;</button>
                            )}
                            
                            {activeDocument ? (
                                activeDocument.processingState !== 'done' ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white h-full">
                                        <Spinner />
                                        <p className="mt-4 text-slate-600 font-medium capitalize">{activeDocument.processingState.replace('_', ' ')}...</p>
                                        <p className="mt-2 text-slate-500 max-w-xs">AI is analyzing your document. This might take a moment.</p>
                                        {activeDocument.processingState === 'error' && <p className="mt-4 text-red-600 bg-red-100 p-3 rounded-lg text-sm">{activeDocument.errorMessage}</p>}
                                    </div>
                                ) : activeDocument.fileType === 'pdf' ? (
                                    <PdfViewer file={activeDocument.file} />
                                ) : (
                                    <div className="p-4 flex items-center justify-center h-full">
                                        <img src={activeDocument.imageUrl} alt={activeDocument.file.name} className="max-w-full max-h-full object-contain" />
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">Select or upload a document to view it.</div>
                            )}
                        </main>

                        {/* Interaction Panel */}
                        <aside className={`${isPreviewOpen && isMobile ? 'hidden' : 'flex'} w-full h-full md:w-[420px] lg:w-[480px] flex-shrink-0 bg-white border-l border-slate-200 flex-col`}>
                            {activeDocument ? (
                               <InteractionPanel 
                                    key={activeDocument.id}
                                    document={activeDocument}
                                    onChatHistoryChange={(chatHistory) => updateDocument(activeDocument.id, { chatHistory })}
                               />
                            ) : (
                                 <div className="flex items-center justify-center h-full text-slate-500 p-4 text-center">Select a document to start interacting.</div>
                            )}
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;