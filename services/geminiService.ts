import { GoogleGenAI, Type } from '@google/genai';
import type { Chat } from '@google/genai';
import { AI_PERSONA_PROMPT } from '../constants';
import type { Model } from '../types';

// This is a browser-only environment, so we can access pdfjsLib from the window
declare const pdfjsLib: any;

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

// Helper to extract text from a PDF file
async function extractTextFromPdf(file: File): Promise<string> {
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const numPages = pdf.numPages;
    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ');
        fullText += '\n\n'; // Add space between pages
    }
    return fullText;
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
    let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;
    const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
    
    if (fileType === 'image') {
        const base64Data = await fileToBase64(file);
        imagePart = {
            inlineData: {
                mimeType: file.type,
                data: base64Data,
            },
        };
    } else {
        documentText = await extractTextFromPdf(file);
    }
    
    if (!documentText && !imagePart) {
        throw new Error("Could not extract any content from the file.");
    }
    
    // 1. Generate Summary
    const summaryPrompt = `Based on the following document content, provide a concise but comprehensive summary of the key points. Use Markdown for formatting:
- Use headings (e.g., '## Subtitle') for main sections.
- Use bold text ('**text**') for important terms.
- Use bullet points ('* point') for lists.
${documentText ? `\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` : ''}`;
    
    const summaryContents = { parts: [] as any[] };
    if (imagePart) summaryContents.parts.push(imagePart);
    summaryContents.parts.push({ text: summaryPrompt });

    const summaryPromise = ai.models.generateContent({
        model,
        contents: summaryContents,
    });

    // 2. Generate Preset Questions
    const questionsPrompt = `Based on the following document content, generate 5 short, one-sentence questions a student might ask to get started. The questions should be general and invite exploration of key topics. One question should be a prompt to create a quiz. 

For each question, start with a relevant emoji (like 🤔, 🧐, 📝, ✨) and use Markdown bold syntax (\`**word**\`) to highlight the key concept. Example: "🤔 Explain the **main concept**."

Return the result as a valid JSON array of strings.
${documentText ? `\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` : ''}`;
    
    const questionsContents = { parts: [] as any[] };
    if (imagePart) questionsContents.parts.push(imagePart);
    questionsContents.parts.push({ text: questionsPrompt });

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
    const chatHistory: any[] = [
        {
            role: 'user',
            parts: []
        },
        {
            role: 'model',
            parts: [{ text: "Understood. I have received the document and I'm ready to answer questions based solely on its content." }]
        }
    ];
    if(imagePart) chatHistory[0].parts.push(imagePart);
    if(documentText) chatHistory[0].parts.push({ text: `Here is the document content you need to answer questions about. All your answers must be based *only* on this text.\n\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` });
    if(!documentText && imagePart) chatHistory[0].parts.push({ text: `Here is the image you need to answer questions about. All your answers must be based *only* on this image.` });

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
            `🤔 What are the three most **important key takeaways** from this ${imagePart ? 'image' : 'document'}?`,
            "🧐 Explain the **main concept** in simple terms.",
            `✨ What is something that might be **easy to misunderstand** from this ${imagePart ? 'image' : 'text'}?`,
            `📝 Summarize the **${imagePart ? 'image' : 'introduction'}**.`,
            "✍️ Create a **3-question quiz** based on the main topic."
        ];
    }


  return { summary, chat, presetQuestions };
}