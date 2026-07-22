import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!cached) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    cached = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return cached;
}

export function geminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || "imagen-4.0-generate-001";
}
