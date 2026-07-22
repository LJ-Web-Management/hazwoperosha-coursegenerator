import { getOpenAI, textModel } from "@/lib/openai";
import {
  OUTLINE_SYSTEM_PROMPT,
  OUTLINE_JSON_SCHEMA,
  buildInitialOutlinePrompt,
  buildRevisionPrompt,
} from "@/lib/prompts";
import type { OutlineContent, OutlineModule } from "@/lib/types";

async function runOutlineResponse(input: string): Promise<OutlineContent> {
  const client = getOpenAI();
  const response = await client.responses.create({
    model: textModel(),
    instructions: OUTLINE_SYSTEM_PROMPT,
    input,
    text: { format: { type: "json_schema", ...OUTLINE_JSON_SCHEMA } },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned no output for outline generation");
  }
  const parsed = JSON.parse(raw) as OutlineContent;
  return parsed;
}

export async function generateInitialOutline(
  courseName: string,
  durationMinutes: number,
): Promise<OutlineContent> {
  return runOutlineResponse(buildInitialOutlinePrompt(courseName, durationMinutes));
}

export async function reviseOutline(
  previousModules: OutlineModule[],
  feedback: string,
): Promise<OutlineContent> {
  return runOutlineResponse(buildRevisionPrompt(previousModules, feedback));
}
