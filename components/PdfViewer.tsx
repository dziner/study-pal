import React, { useState, useEffect, useRef, memo, useLayoutEffect } from 'react';
import { Spinner } from './Spinner';

interface PdfViewerProps {
    file: File;
    imageUrl?: string;
}

// A memoized component to render a single page of a PDF.
// This prevents re-rendering of pages that are already on screen.
const PdfPage: React.FC<{ pdfDoc: any; pageNum: number; containerWidth: number; }> = memo(({ pdfDoc, pageNum, containerWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current || containerWidth <= 0) return;

            try {
                const page = await pdfDoc.getPage(pageNum);
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;
                
                const viewport = page.getViewport({ scale: 1 });
                
                // Define a maximum width for the content for better readability on wide screens.
                const MAX_CONTENT_WIDTH = 896; // e.g., 56rem

                // Calculate the available width inside the container, accounting for padding (p-4 -> 32px total).
                const availableWidth = containerWidth - 32;

                // Determine the target width: it's the smaller of the available space or our max width.
                const targetCanvasWidth = Math.min(availableWidth, MAX_CONTENT_WIDTH);

                // Calculate scale based on the determined target width.
                const scale = targetCanvasWidth / viewport.width;
                const scaledViewport = page.getViewport({ scale });

                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

            } catch (e) {
                console.error(`Error rendering page ${pageNum}:`, e);
                // Optionally display an error message on the canvas
                if(canvasRef.current) {
                    canvasRef.current.style.display = 'none';
                }
            }
        };

        renderPage();
    }, [pdfDoc, pageNum, containerWidth]);

    return <canvas ref={canvasRef} className="shadow-lg max-w-full" />;
});


export const PdfViewer: React.FC<PdfViewerProps> = ({ file, imageUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);


    // Load PDF
    useEffect(() => {
        // Reset state for new file
        setIsLoading(true);
        setError(null);
        setPdfDoc(null);
        setNumPages(0);
        setContainerWidth(0); // Reset width for re-measurement
        pageRefs.current = [];
        setCurrentPage(1);

        if (file.type.startsWith('image/')) {
            setIsLoading(false);
            return;
        }

        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
            setError("The PDF library (pdf.js) failed to load. Please check your internet connection and refresh the page.");
            setIsLoading(false);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async function() {
            if (!(this.result instanceof ArrayBuffer)) {
                setError("Failed to read file as ArrayBuffer.");
                setIsLoading(false);
                return;
            }
            const typedarray = new Uint8Array(this.result);

            try {
                const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';
                pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
                const loadingTask = pdfjs.getDocument(typedarray);
                const doc = await loadingTask.promise;
                setPdfDoc(doc);
                setNumPages(doc.numPages);
            } catch (e) {
                console.error("Failed to load PDF:", e);
                setError("Could not load the PDF file. It might be corrupted or in an unsupported format.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the file.");
            setIsLoading(false);
        };
        reader.readAsArrayBuffer(file);
        
        // Cleanup function to destroy the PDF document object
        return () => {
             if (pdfDoc && typeof pdfDoc.destroy === 'function') {
                pdfDoc.destroy();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);
    
    // Use useLayoutEffect for a reliable initial width measurement after the DOM is updated.
    useLayoutEffect(() => {
        if (containerRef.current && !isLoading && containerWidth === 0) {
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width > 0) {
                setContainerWidth(rect.width);
            }
        }
    }, [isLoading, containerWidth]);


    // Setup ResizeObserver to get container width for subsequent window resizes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry && entry.contentRect.width > 0) {
                 setContainerWidth(entry.contentRect.width);
            }
        });

        observer.observe(container);
        
        return () => observer.disconnect();

    }, []);

    // Setup IntersectionObserver to track current page
    useEffect(() => {
        if (!pdfDoc || !containerWidth || !containerRef.current) return;

        const options = {
            root: containerRef.current,
            rootMargin: '0px',
            threshold: 0.1,
        };

        const callback = (entries: IntersectionObserverEntry[]) => {
            const intersectingPages = entries
                .filter(e => e.isIntersecting)
                .map(e => ({
                    pageNum: parseInt(e.target.getAttribute('data-page-num') || '0', 10),
                    top: e.boundingClientRect.top
                }))
                .filter(p => p.pageNum > 0)
                .sort((a, b) => a.top - b.top); 

            if (intersectingPages.length > 0) {
                setCurrentPage(intersectingPages[0].pageNum);
            }
        };

        const observer = new IntersectionObserver(callback, options);
        const targets = pageRefs.current.filter(ref => ref !== null);
        targets.forEach(target => observer.observe(target!));

        return () => {
            targets.forEach(target => observer.unobserve(target!));
        };
    }, [pdfDoc, containerWidth]);


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-100">
                <Spinner />
                <p className="mt-4 text-slate-600">Loading document...</p>
            </div>
        );
    }
    
    if (error) {
        return <div className="flex items-center justify-center h-full bg-slate-100 text-red-600 p-4 text-center">{error}</div>;
    }

    if (file.type.startsWith('image/')) {
        return (
             <div className="h-full w-full bg-slate-100 p-4 flex items-center justify-center overflow-auto">
                <img src={imageUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
        )
    }

    return (
        <div className="relative flex flex-col h-full bg-slate-100">
            <div ref={containerRef} className="flex-1 overflow-y-auto flex flex-col items-center p-4 space-y-4">
                {/* Render a PdfPage component for each page only after width is known */}
                {pdfDoc && containerWidth > 0 && Array.from(new Array(numPages), (el, index) => (
                    <div 
                        key={`page_wrapper_${index + 1}`} 
                        ref={elem => { pageRefs.current[index] = elem; }}
                        data-page-num={index + 1}
                    >
                        <PdfPage 
                            key={`page_${index + 1}`} 
                            pdfDoc={pdfDoc}
                            pageNum={index + 1}
                            containerWidth={containerWidth}
                        />
                    </div>
                ))}
                {/* Show a spinner if the PDF is loaded but the container width isn't calculated yet */}
                {pdfDoc && containerWidth <= 0 && !error && <Spinner/>}
            </div>
            {/* Page Indicator */}
            {numPages > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg pointer-events-none">
                    {currentPage} / {numPages}
                </div>
            )}
        </div>
    );
};