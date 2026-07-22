import { ApiError } from "@google/genai";
import { getOpenAI, textModel } from "@/lib/openai";
import { getGemini, geminiImageModel } from "@/lib/gemini";
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

class GeminiFilteredError extends Error {
  constructor(reason: string) {
    super(`Gemini filtered the image: ${reason}`);
    this.name = "GeminiFilteredError";
  }
}

async function generateImageBytes(prompt: string): Promise<Buffer> {
  const client = getGemini();
  const result = await client.models.generateImages({
    model: geminiImageModel(),
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9",
    },
  });

  const generated = result.generatedImages?.[0];
  if (generated?.raiFilteredReason) {
    throw new GeminiFilteredError(generated.raiFilteredReason);
  }
  const b64 = generated?.image?.imageBytes;
  if (!b64) {
    throw new Error("Gemini returned no image data");
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
      const isModerationLike =
        err instanceof GeminiFilteredError || (err instanceof ApiError && err.status === 400);
      if (!isModerationLike || i === attempts.length - 1) {
        if (isModerationLike) {
          // Both attempts were rejected by safety filtering — degrade gracefully instead of failing the slide.
          return { blobUrl: null, fallbackTextOnly: true };
        }
        throw err;
      }
      // else fall through and retry with the sanitized prompt
    }
  }

  return { blobUrl: null, fallbackTextOnly: true };
}
