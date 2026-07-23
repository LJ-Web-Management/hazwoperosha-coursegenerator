import { getDb } from "@/lib/db/client";
import { apiUsage } from "@/lib/db/schema";
import { openaiCost, geminiCost } from "@/lib/pricing";

type Operation = "outline" | "slide_text" | "slide_image" | "beautify";

async function record(params: {
  courseId: string | null;
  provider: "openai" | "gemini";
  operation: Operation;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(apiUsage).values(params);
  } catch (err) {
    // Cost tracking must never break the actual generation flow.
    console.error("Failed to record API usage", err);
  }
}

export function recordOpenAiUsage(params: {
  courseId: string | null;
  operation: Operation;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  return record({
    ...params,
    provider: "openai",
    costUsd: openaiCost(params.model, params.inputTokens, params.outputTokens),
  });
}

export function recordGeminiUsage(params: {
  courseId: string | null;
  operation: Operation;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  return record({
    ...params,
    provider: "gemini",
    costUsd: geminiCost(params.model, params.inputTokens, params.outputTokens),
  });
}
