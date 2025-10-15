
import { GoogleGenAI, Type } from '@google/genai';
import type { Chat } from '@google/genai';
import { AI_PERSONA_PROMPT } from '../constants';
import type { Model } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processDocumentWithAI(documentText: string, model: Model): Promise<{ summary: string; chat: Chat, presetQuestions: string[] }> {

  // 1. Generate Summary
  const summaryPrompt = `Based on the following document text, provide a concise but comprehensive summary of the key points. Use Markdown for formatting:
- Use headings (e.g., '## Subtitle') for main sections.
- Use bold text ('**text**') for important terms.
- Use bullet points ('* point') for lists.

DOCUMENT TEXT:\n"""\n${documentText}\n"""`;
  
  const summaryPromise = ai.models.generateContent({
      model,
      contents: summaryPrompt,
  });

  // 2. Generate Preset Questions
  // FIX: Updated prompt to be more specific about the JSON structure to improve model reliability.
  const questionsPrompt = `Based on the following document text, generate 5 short, one-sentence questions a student might ask to get started. The questions should be general and invite exploration of key topics. One question should be a prompt to create a quiz. Keep each question concise. Example: "Explain the main concept.", "Quiz me on the key terms.", "What are the main takeaways?".

Return the result as a valid JSON object with a single key "questions" which is an array of strings.

DOCUMENT TEXT:\n"""\n${documentText}\n"""`;

  const questionsPromise = ai.models.generateContent({
    model,
    contents: questionsPrompt,
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
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: AI_PERSONA_PROMPT,
    },
    history: [
      {
        role: 'user',
        parts: [{ text: `Here is the document content you need to answer questions about. All your answers must be based *only* on this text.\n\nDOCUMENT TEXT:\n"""\n${documentText}\n"""` }]
      },
      {
        role: 'model',
        parts: [{ text: "Understood. I have read the document and I'm ready to answer questions based solely on its content." }]
      }
    ]
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
        "What are the three most important key takeaways from this document?",
        "Explain the main concept in simple terms.",
        "What is something that might be easy to misunderstand from this text?",
        "Summarize the introduction.",
        "Create a 3-question quiz based on the main topic."
    ];
  }


  return { summary, chat, presetQuestions };
}