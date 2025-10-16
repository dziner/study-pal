import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from './Spinner';

// This is a browser-only environment, so we can access pdfjsLib from the window
declare const pdfjsLib: any;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

interface PdfViewerProps {
    file: File;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!file || !canvasContainerRef.current) return;
        
        const container = canvasContainerRef.current;
        let pdfDoc: any = null;
        let isCancelled = false;
        
        const renderPdf = async () => {
            setLoading(true);
            setError(null);
            // Clear previous renders
            container.innerHTML = ''; 

            try {
                const fileUrl = URL.createObjectURL(file);
                pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
                
                if (isCancelled) return;
                
                setLoading(false); // Stop loading indicator once PDF is loaded, before page rendering.

                for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                    if (isCancelled) break;
                    
                    // This can be done without awaiting each page render in the loop
                    // to make the UI feel more responsive.
                    pdfDoc.getPage(pageNum).then((page: any) => {
                        if (isCancelled) return;

                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        canvas.className = "mb-4 shadow-md";
                        const context = canvas.getContext('2d');
                        if (!context) return;
                        
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        container.appendChild(canvas);

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport,
                        };
                        page.render(renderContext);
                    });
                }

            } catch (err: any) {
                if (!isCancelled) {
                     setError("Failed to load or render PDF. The file might be corrupted or unsupported.");
                     console.error(err);
                     setLoading(false); // Ensure loading stops on error.
                }
            }
        };

        renderPdf();

        return () => {
            isCancelled = true;
            if (pdfDoc) {
                pdfDoc.destroy();
            }
        };
    }, [file]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Spinner />
                <p className="mt-2 text-slate-600">Loading PDF preview...</p>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-300">
            <div ref={canvasContainerRef} className="flex flex-col items-center"></div>
        </div>
    );
};