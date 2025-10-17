import { GoogleGenAI, Type } from '@google/genai';
import type { Chat } from '@google/genai';
import { AI_PERSONA_PROMPT } from '../constants';
import type { Model } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert a file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

/**
 * Extracts all text content from a given PDF file.
 * This function relies on the pdf.js library being loaded globally via a script tag in index.html.
 * @param file The PDF file object to process.
 * @returns A promise that resolves to a single string containing all the text from the PDF.
 */
async function extractTextFromPdf(file: File): Promise<string> {
    const pdfjs = (window as any).pdfjsLib;

    if (!pdfjs) {
        throw new Error("The PDF processing library (pdf.js) failed to load. Please check your internet connection and refresh the page.");
    }

    const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

    const arrayBuffer = await file.arrayBuffer();
    const typedarray = new Uint8Array(arrayBuffer);

    let pdfDoc: any = null;

    try {
        const loadingTask = pdfjs.getDocument(typedarray);
        pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        const pageTexts: string[] = [];
        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            if (pageText.trim().length > 0) {
                pageTexts.push(pageText);
            }
        }
        
        return pageTexts.join('\n\n');

    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw new Error('Failed to read the PDF file. It might be corrupted, password-protected, or in an unsupported format.');
    } finally {
        if (pdfDoc && typeof pdfDoc.destroy === 'function') {
            pdfDoc.destroy();
        }
    }
}

/**
 * Converts the first few pages of a PDF into images for multimodal analysis.
 * @param file The PDF file to convert.
 * @returns A promise that resolves to an array of image parts for the Gemini API.
 */
async function convertPdfToImages(file: File): Promise<{ inlineData: { mimeType: string; data: string } }[]> {
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) return [];

    const arrayBuffer = await file.arrayBuffer();
    const typedarray = new Uint8Array(arrayBuffer);
    let pdfDoc: any = null;

    try {
        const loadingTask = pdfjs.getDocument(typedarray);
        pdfDoc = await loadingTask.promise;
        
        const numPagesToProcess = Math.min(pdfDoc.numPages, 5); // Process up to 5 pages
        const imageParts = [];

        for (let i = 1; i <= numPagesToProcess; i++) {
            const page = await pdfDoc.getPage(i);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;

            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = imageDataUrl.split(',')[1];
            
            imageParts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        }
        return imageParts;
    } catch(e) {
        console.error("Failed to convert PDF to images:", e);
        return [];
    } finally {
        if (pdfDoc && typeof pdfDoc.destroy === 'function') {
            pdfDoc.destroy();
        }
    }
}


interface ProcessDocumentOptions {
    file: File;
    model: Model;
}

export async function processDocumentWithAI({
    file,
    model,
}: ProcessDocumentOptions): Promise<{ summary: string; chat: Chat, presetQuestions: string[] }> {
    
    let documentText: string | undefined;
    let imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
    let isTextOnly = false;
    
    if (fileType === 'image') {
        const base64Data = await fileToBase64(file);
        imageParts.push({
            inlineData: {
                mimeType: file.type,
                data: base64Data,
            },
        });
    } else {
        documentText = await extractTextFromPdf(file);
        // If text extraction is successful, it's a text-only document.
        // Otherwise, fall back to processing pages as images.
        if (documentText && documentText.trim().length >= 100) {
            isTextOnly = true;
        } else {
            imageParts = await convertPdfToImages(file);
        }
    }
    
    if (!documentText && imageParts.length === 0) {
        throw new Error("Could not extract any content from the file.");
    }
    
    // 1. Generate Summary
    const summaryPrompt = `Based on the following document content, provide a concise but comprehensive summary of the key points. Use Markdown for formatting (headings, bold, lists).
${documentText ? `\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` : ''}`;
    
    const summaryContents = isTextOnly 
        ? summaryPrompt
        : { parts: [...imageParts, { text: summaryPrompt }] as any[] };

    const summaryPromise = ai.models.generateContent({
        model,
        contents: summaryContents,
    });

    // 2. Generate Preset Questions
    const questionsPrompt = `Based on the following document content, generate 5 short, one-sentence questions a student might ask. One question should be a prompt to create a quiz. For each question, start with a relevant emoji and use Markdown bold syntax (\`**word**\`) to highlight the key concept. Example: "🤔 Explain the **main concept**." Return the result as a valid JSON array of strings.
${documentText ? `\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` : ''}`;
    
    const questionsContents = isTextOnly
        ? questionsPrompt
        : { parts: [...imageParts, { text: questionsPrompt }] as any[] };

    const questionsPromise = ai.models.generateContent({
        model,
        contents: questionsContents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });

    // 3. Initialize Chat
    const chatHistory: any[] = [{ role: 'user', parts: [] as any[] }];
    
    if(isTextOnly && documentText){
         chatHistory[0].parts.push({ text: `Here is the document content you need to answer questions about. All your answers must be based *only* on this text.\n\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` });
    } else {
        chatHistory[0].parts.push(...imageParts);
        chatHistory[0].parts.push({ text: `Here are images from the document you need to answer questions about. All your answers must be based *only* on these images.` });
    }
    
    chatHistory.push({
        role: 'model',
        parts: [{ text: "Understood. I have received the document and I'm ready to answer questions based solely on its content." }]
    });

    const chat = ai.chats.create({
        model,
        config: {
            systemInstruction: AI_PERSONA_PROMPT,
        },
        history: chatHistory
    });

    const [summaryResponse, questionsResponse] = await Promise.all([summaryPromise, questionsPromise]);

    const summary = summaryResponse.text;
    
    let presetQuestions: string[] = [];
    try {
        const questionsJson = JSON.parse(questionsResponse.text);
        if (questionsJson.questions && Array.isArray(questionsJson.questions)) {
            presetQuestions = questionsJson.questions;
        }
    } catch(e) {
        console.error("Failed to parse preset questions JSON", e);
        // fallback questions
        presetQuestions = [
            `🤔 What are the three most **important key takeaways** from this document?`,
            "🧐 Explain the **main concept** in simple terms.",
            `✨ What is something that might be **easy to misunderstand** from this text?`,
            `📝 Summarize the **introduction**.`,
            "✍️ Create a **3-question quiz** based on the main topic."
        ];
    }


  return { summary, chat, presetQuestions };
}