import OpenAI from "openai";
import { getOpenAI, textModel, imageModel } from "@/lib/openai";
import {
  SLIDE_SYSTEM_PROMPT,
  SLIDE_JSON_SCHEMA,
  buildSlidePrompt,
  buildImagePrompt,
  sanitizeImagePrompt,
} from "@/lib/prompts";
import { uploadBuffer } from "@/lib/blob";

interface SlideTextResult {
  title: string;
  bullets: string[];
  example: string;
  imagePrompt: string;
}

export async function generateSlideText(params: {
  courseName: string;
  moduleTitle: string;
  topicTitle: string;
  neighboringTitles: string[];
}): Promise<SlideTextResult> {
  const client = getOpenAI();
  const response = await client.responses.create({
    model: textModel(),
    instructions: SLIDE_SYSTEM_PROMPT,
    input: buildSlidePrompt(params),
    text: { format: { type: "json_schema", ...SLIDE_JSON_SCHEMA } },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned no output for slide content");
  }
  return JSON.parse(raw) as SlideTextResult;
}

export interface SlideImageResult {
  blobUrl: string | null;
  fallbackTextOnly: boolean;
}

async function generateImageBytes(prompt: string): Promise<Buffer> {
  const client = getOpenAI();
  const result = await client.images.generate({
    model: imageModel(),
    prompt,
    size: "1536x1024",
    quality: "medium",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }
  return Buffer.from(b64, "base64");
}

export async function generateSlideImage(
  courseId: string,
  slideIndex: number,
  rawPrompt: string,
): Promise<SlideImageResult> {
  const attempts = [buildImagePrompt(rawPrompt), sanitizeImagePrompt(rawPrompt)];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const bytes = await generateImageBytes(attempts[i]);
      const url = await uploadBuffer(
        `courses/${courseId}/slides/${slideIndex}.png`,
        bytes,
        "image/png",
      );
      return { blobUrl: url, fallbackTextOnly: false };
    } catch (err) {
      const isModerationLike = err instanceof OpenAI.APIError && err.status === 400;
      if (!isModerationLike || i === attempts.length - 1) {
        if (isModerationLike) {
          // Both attempts were rejected by moderation — degrade gracefully instead of failing the slide.
          return { blobUrl: null, fallbackTextOnly: true };
        }
        throw err;
      }
      // else fall through and retry with the sanitized prompt
    }
  }

  return { blobUrl: null, fallbackTextOnly: true };
}
