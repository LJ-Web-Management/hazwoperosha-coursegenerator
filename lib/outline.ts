import { getOpenAI, textModel } from "@/lib/openai";
import {
  OUTLINE_SYSTEM_PROMPT,
  OUTLINE_JSON_SCHEMA,
  buildInitialOutlinePrompt,
  buildRevisionPrompt,
} from "@/lib/prompts";
import { recordOpenAiUsage } from "@/lib/usage";
import type { OutlineContent, OutlineModule } from "@/lib/types";

async function runOutlineResponse(courseId: string, input: string): Promise<OutlineContent> {
  const client = getOpenAI();
  const model = textModel();
  const response = await client.responses.create({
    model,
    instructions: OUTLINE_SYSTEM_PROMPT,
    input,
    text: { format: { type: "json_schema", ...OUTLINE_JSON_SCHEMA } },
  });

  if (response.usage) {
    await recordOpenAiUsage({
      courseId,
      operation: "outline",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  }

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned no output for outline generation");
  }
  const parsed = JSON.parse(raw) as OutlineContent;
  return parsed;
}

export async function generateInitialOutline(
  courseId: string,
  courseName: string,
  durationMinutes: number,
): Promise<OutlineContent> {
  return runOutlineResponse(courseId, buildInitialOutlinePrompt(courseName, durationMinutes));
}

export async function reviseOutline(
  courseId: string,
  previousModules: OutlineModule[],
  feedback: string,
): Promise<OutlineContent> {
  return runOutlineResponse(courseId, buildRevisionPrompt(previousModules, feedback));
}
