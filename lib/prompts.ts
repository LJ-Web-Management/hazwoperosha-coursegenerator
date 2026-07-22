import type { OutlineModule } from "@/lib/types";
import { targetModuleCount, targetSlideCount } from "@/lib/duration";

export const OUTLINE_SYSTEM_PROMPT = `You are an expert HAZWOPER/OSHA safety training curriculum designer. You write clear, compliance-accurate, adult-learner-appropriate course outlines for workplace safety training. Follow OSHA terminology precisely. Keep topic titles concise and actionable.`;

export const OUTLINE_JSON_SCHEMA = {
  name: "course_outline",
  strict: true,
  schema: {
    type: "object",
    properties: {
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  slideCount: { type: "integer" },
                },
                required: ["title", "slideCount"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "topics"],
          additionalProperties: false,
        },
      },
    },
    required: ["modules"],
    additionalProperties: false,
  },
} as const;

export function buildInitialOutlinePrompt(courseName: string, durationMinutes: number): string {
  const slides = targetSlideCount(durationMinutes);
  const modules = targetModuleCount(durationMinutes);
  return `Create a course outline for a HAZWOPER/OSHA safety training course titled "${courseName}", intended to run approximately ${durationMinutes} minutes.

Aim for approximately ${modules} modules and ${slides} total slides across all modules combined (±10% is fine — prioritize a logical, complete curriculum over hitting the number exactly). Each topic should specify a reasonable slideCount (typically 1-4 slides per topic). Order modules and topics in a logical instructional sequence (e.g. hazard recognition before control measures, general requirements before role-specific procedures).`;
}

export function buildRevisionPrompt(previousModules: OutlineModule[], feedback: string): string {
  return `Here is the current course outline as JSON:

${JSON.stringify({ modules: previousModules }, null, 2)}

The reviewer requested these changes:
"""
${feedback}
"""

Produce a revised outline that addresses the feedback while keeping everything else that wasn't flagged as-is. Keep the same overall structure/format.`;
}

export const SLIDE_SYSTEM_PROMPT = `You are an expert HAZWOPER/OSHA safety training content writer. You write slide content for adult workplace-safety learners: clear, direct, compliance-accurate, free of jargon unless it's standard OSHA terminology (which you should define on first use). Bullets should be scannable, not full paragraphs.`;

export const SLIDE_JSON_SCHEMA = {
  name: "slide_content",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 5,
      },
      example: { type: "string" },
      imagePrompt: { type: "string" },
    },
    required: ["title", "bullets", "example", "imagePrompt"],
    additionalProperties: false,
  },
} as const;

export function buildSlidePrompt(params: {
  courseName: string;
  moduleTitle: string;
  topicTitle: string;
  neighboringTitles: string[];
}): string {
  const { courseName, moduleTitle, topicTitle, neighboringTitles } = params;
  const context =
    neighboringTitles.length > 0
      ? `For narrative continuity, here are the titles of nearby slides in this course: ${neighboringTitles.join(", ")}.`
      : "";

  return `Course: "${courseName}"
Module: "${moduleTitle}"
Topic for this slide: "${topicTitle}"
${context}

Write the content for one slide covering this topic:
- title: a short slide title (may match or refine the topic title)
- bullets: 3-5 concise bullet points teaching the key facts/procedures for this topic
- example: one short real-world example or scenario illustrating this topic in a workplace setting
- imagePrompt: a description (1-2 sentences) for a photorealistic training-illustration image depicting this topic — an industrial/workplace safety setting, visible PPE where relevant, professional training-material style, no text or writing rendered in the image`;
}

const HAZARD_TERMS_TO_SANITIZE: Array<[RegExp, string]> = [
  [/\b(explosion|explosive)\b/gi, "hazardous incident"],
  [/\b(toxic|poison(ous)?)\b/gi, "hazardous"],
  [/\b(chemical spill|spill)\b/gi, "safety scenario"],
  [/\b(fire|burning|flames)\b/gi, "emergency response scenario"],
  [/\b(death|dead|fatal(ity)?|injury|injured|blood)\b/gi, "safety concern"],
];

export function sanitizeImagePrompt(prompt: string): string {
  let sanitized = prompt;
  for (const [pattern, replacement] of HAZARD_TERMS_TO_SANITIZE) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return `Generic professional workplace safety training illustration, ${sanitized}, no text overlays, no gore, no graphic content, instructional style.`;
}

export function buildImagePrompt(rawPrompt: string): string {
  return `${rawPrompt}. Style: photorealistic, professional OSHA/HAZWOPER training material, no text or writing rendered in the image, no logos.`;
}
