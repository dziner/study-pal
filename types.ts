import type { Chat } from '@google/genai';

export interface ChatMessage {
    sender: 'user' | 'bot';
    text: string;
}

export type DocumentProcessingState = 'reading' | 'summarizing' | 'generating_questions' | 'error' | 'done';

export const AVAILABLE_MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
export type Model = typeof AVAILABLE_MODEL_IDS[number];

export interface ModelInfo {
    id: Model;
    name: string;
    description: string;
}

export interface DocumentData {
  id: string;
  file: File;
  fileType: 'pdf' | 'image';
  pdfDoc?: any; // pdf.js document object
  imageUrl?: string; // for images
  summary: string;
  chat: Chat | null;
  chatHistory: ChatMessage[];
  presetQuestions?: string[];
  processingState: DocumentProcessingState;
  errorMessage?: string;
  model: Model;
}

export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export interface UserAnswer {
  questionIndex: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
}