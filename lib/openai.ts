import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!cached) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

export function textModel(): string {
  return process.env.OPENAI_TEXT_MODEL || "gpt-5";
}

export function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
}
