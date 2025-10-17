import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentData, ChatMessage, QuizData, Model } from './types';
import { IdleStateView } from './components/IdleStateView';
import { MenuIcon, PlusIcon, DocumentIcon, TrashIcon, PreviewIcon, ChatIcon, CollapseLeftIcon } from './components/icons';
import { processDocumentWithAI } from './services/geminiService';
import { initialBotMessage } from './constants';
import { InteractionPanel } from './components/InteractionPanel';
import { Spinner } from './components/Spinner';
import { AVAILABLE_MODEL_IDS } from './types';
import { PdfViewer } from './components/PdfViewer';

const App: React.FC = () => {
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isFileListOpen, setIsFileListOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isPreviewVisibleMobile, setIsPreviewVisibleMobile] = useState(false);
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [rightPanelWidth, setRightPanelWidth] = useState(600);
    const [isResizing, setIsResizing] = useState(false);
    
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if(!mobile){
                setIsFileListOpen(true);
            } else {
                setIsFileListOpen(false);
                setIsNavCollapsed(false); // On mobile, never be collapsed
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMouseDownOnResizer = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 400; // Min width for the interaction panel
        const maxWidth = window.innerWidth * 0.7; // Max 70% of screen width
        if (newWidth > minWidth && newWidth < maxWidth) {
            setRightPanelWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);


    const activeDocument = documents.find(d => d.id === activeDocumentId);

    const updateDocument = useCallback((docId: string, updates: Partial<DocumentData>) => {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
    }, []);
    
    const handleFileSelected = useCallback(async (file: File) => {
        const newDocId = `doc-${Date.now()}`;
        const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
        const imageUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

        const newDoc: DocumentData = {
            id: newDocId,
            file,
            fileType,
            imageUrl,
            summary: '',
            chat: null,
            chatHistory: [],
            processingState: 'reading',
            model: 'gemini-2.5-flash',
        };

        setDocuments(prev => [newDoc, ...prev]);
        setActiveDocumentId(newDocId);
        if (isMobile) {
            setIsFileListOpen(false);
            setIsPreviewVisibleMobile(false);
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
                chatHistory: [initialBotMessage],
             });

        } catch (error) {
            console.error("Error processing document:", error);
            let message = "An unexpected error occurred. Please try again.";
            if (error instanceof Error) {
                message = error.message;
            }
            updateDocument(newDocId, { 
                processingState: 'error', 
                errorMessage: message
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
    
    const handleAddNewFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
            e.target.value = '';
        }
    };
    
    const handleModelChange = (docId: string, model: Model) => {
        updateDocument(docId, { model });
    };

    if (documents.length === 0) {
        return <IdleStateView onFileSelected={handleFileSelected} />;
    }

    const fileListPanel = (
        <div className="bg-white border-r border-slate-200 flex flex-col h-full transition-all duration-300 overflow-hidden">
            <div className={`p-4 border-b border-slate-200 flex-shrink-0 flex items-center ${isNavCollapsed && !isMobile ? 'justify-center' : 'justify-between'}`}>
                {(!isNavCollapsed || isMobile) && <h1 className="text-xl font-bold text-slate-800">My Study Pal</h1>}
                {!isMobile &&
                    <button onClick={() => setIsNavCollapsed(!isNavCollapsed)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600">
                        <CollapseLeftIcon className={`h-5 w-5 transition-transform duration-300 ${isNavCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                }
            </div>
            <div className="flex-grow overflow-y-auto w-full">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,image/*"
                />
                <button onClick={handleAddNewFileClick} className={`flex items-center w-full text-left p-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 ${isNavCollapsed ? 'justify-center' : ''}`}>
                    <PlusIcon />
                    {!isNavCollapsed && <span className="ml-2">New File</span>}
                </button>
                <div className="mt-2">
                    {documents.map(doc => (
                        <div key={doc.id} onClick={() => setActiveDocumentId(doc.id)} className={`flex items-center p-3 mx-2 rounded-lg cursor-pointer ${isNavCollapsed ? 'justify-center' : 'justify-between'} ${activeDocumentId === doc.id ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <div className="flex items-center overflow-hidden">
                                <DocumentIcon />
                                {!isNavCollapsed && <span className="ml-2 text-sm font-medium truncate">{doc.file.name}</span>}
                            </div>
                            {!isNavCollapsed && 
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="ml-2 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 flex-shrink-0">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            }
                        </div>
                    ))}
                </div>
            </div>
            {!isNavCollapsed && 
                <div className="p-4 border-t border-slate-200 flex-shrink-0">
                    <div className="text-center text-sm text-slate-500 mb-3">
                        <p style={{ fontFamily: "'Mynerve', cursive" }}>Crafted by your dad with love.</p>
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
            }
        </div>
    );
    
    const processingView = activeDocument && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white h-full">
            {activeDocument.processingState === 'error' ? (
                <>
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-xl font-semibold text-slate-800 mb-2">Error Processing Document</p>
                    <p className="mt-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm max-w-sm">
                        {activeDocument.errorMessage}
                    </p>
                </>
            ) : (
                <>
                    <Spinner />
                    <p className="mt-4 text-slate-600 font-medium capitalize">{activeDocument.processingState.replace('_', ' ')}...</p>
                    <p className="mt-2 text-slate-500 max-w-xs">AI is analyzing your document. This might take a moment.</p>
                </>
            )}
        </div>
    );
    
    const interactionContent = (
        <>
        {activeDocument ? (
            activeDocument.processingState !== 'done' ? (
                processingView
            ) : (
                <InteractionPanel 
                    key={activeDocument.id}
                    document={activeDocument}
                    onChatHistoryChange={(chatHistory) => updateDocument(activeDocument.id, { chatHistory })}
                />
            )
        ) : (
                <div className="flex items-center justify-center h-full text-slate-500 p-4 text-center">Select a document to start interacting.</div>
        )}
        </>
    );

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-100 font-sans text-slate-800 overflow-hidden">
            <header className="md:hidden flex items-center justify-between p-2 bg-white border-b border-slate-200 flex-shrink-0">
                <button onClick={() => setIsFileListOpen(!isFileListOpen)} className="p-2 rounded-md hover:bg-slate-100">
                    <MenuIcon className="h-6 w-6" />
                </button>
                <h2 className="font-semibold truncate">{activeDocument?.file.name || 'AI Study Pal'}</h2>
                <div className="w-10 h-10 flex items-center justify-center">
                    {activeDocument && activeDocument.processingState === 'done' && (
                         <button onClick={() => setIsPreviewVisibleMobile(!isPreviewVisibleMobile)} className="p-2 rounded-md hover:bg-slate-100">
                            {isPreviewVisibleMobile ? <ChatIcon /> : <PreviewIcon className="h-6 w-6" />}
                        </button>
                    )}
                </div>
            </header>
            
            <div className="flex flex-1 overflow-hidden">
                <aside className={`hidden md:block flex-shrink-0 transition-all duration-300 ease-in-out ${isNavCollapsed ? 'w-20' : 'w-72'}`}>
                    {fileListPanel}
                </aside>

                 {isMobile && isFileListOpen && (
                    <div className="absolute top-0 left-0 h-full w-4/5 max-w-sm bg-white z-30 shadow-lg">
                        {fileListPanel}
                        <button onClick={() => setIsFileListOpen(false)} className="absolute top-2 right-2 p-2 text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                 {isMobile && isFileListOpen && <div className="absolute inset-0 bg-black/30 z-20" onClick={() => setIsFileListOpen(false)}></div>}

                {/* Center Column (Viewer on Desktop) */}
                <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-slate-100 min-w-0">
                    {activeDocument ? (
                        <PdfViewer
                            key={`${activeDocument.id}-viewer`}
                            file={activeDocument.file}
                            imageUrl={activeDocument.imageUrl}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 p-4 text-center bg-slate-100">Select a document to see the preview.</div>
                    )}
                </div>

                {/* Resizer Handle */}
                <div
                    onMouseDown={handleMouseDownOnResizer}
                    className={`hidden md:block w-1.5 cursor-col-resize bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors duration-200 ease-in-out ${isResizing ? 'bg-blue-500' : ''}`}
                />


                {/* Right Column (Interaction on Desktop) or Main Content (Mobile) */}
                <main 
                    className="flex flex-col flex-1 md:flex-none md:flex-shrink-0 overflow-hidden bg-white md:border-l md:border-slate-200"
                    style={!isMobile ? { width: `${rightPanelWidth}px` } : {}}
                >
                     {isMobile ? (
                        isPreviewVisibleMobile && activeDocument ? (
                             <PdfViewer
                                key={`${activeDocument.id}-viewer-mobile`}
                                file={activeDocument.file}
                                imageUrl={activeDocument.imageUrl}
                            />
                        ) : (
                            interactionContent
                        )
                    ) : (
                        interactionContent
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;