import { readFileSync } from "fs";
import path from "path";
import { toFile } from "openai/uploads";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { getOpenAI, textModel } from "@/lib/openai";

const LOGO_PATH = path.join(process.cwd(), "public/brand/hazwoper-logo.png");

const BEAUTIFY_PROMPT = `Edit the attached original PowerPoint presentation and return a fully revised .pptx file.
The presentation is a HAZWOPER/OSHA workplace safety training course. Preserve the accuracy and integrity of the compliance-training content.

Mandatory Content Rules
1. Do not rewrite, summarize, shorten, expand, paraphrase, reorder, or remove any titles, bullets, paragraphs, regulatory references, or real-world examples.
2. Keep every image on its original slide.
3. Do not replace or remove any existing images.
4. The only permitted text change is replacing all em dashes and en dashes with standard hyphens or suitable punctuation.
5. Preserve slide order.
6. Preserve all compliance-related terminology, citations, standards, numbers, and examples exactly as written.

Body Text Sizing
Adjust the body-text font size individually on each slide so the text properly fills the available text area.
- Increase the font size when a slide has less text.
- Reduce the font size when a slide has more text.
- Do not use one fixed body-text size throughout the entire presentation.
- Avoid text overflow, clipping, crowding, or text running underneath other objects.
- Keep body text as large as reasonably possible.
- Use approximately 18-point text as the preferred minimum.
- Only go below 18 points when absolutely necessary to keep all original text readable.
- Maintain consistent line spacing, paragraph spacing, and bullet indentation.
- Do not distort text boxes or stretch text horizontally.

Design Theme
Apply a clean, professional corporate safety-training design based on the attached HAZWOPER Training LLC logo.
Use the logo to determine the primary brand colors. The theme should generally use:
- Dark navy or deep blue
- Safety orange, yellow, or gold accents
- White backgrounds or light neutral backgrounds
- Dark gray or black body text

The design must be appropriate for OSHA and HAZWOPER training. It should look authoritative, professional, restrained, and readable from a distance. Do not use flashy graphics, excessive gradients, decorative effects, bright multicolor backgrounds, or unnecessary animation.

Slide Layout
For every content slide:
- Keep the slide title at the top.
- Keep the instructional text on the left.
- Keep the existing image on the right.
- Keep the "Real-world example" section across the bottom.
- Correct alignment, margins, spacing, and object placement.
- Use consistent positioning from slide to slide.
- Maintain adequate white space.
- Ensure text does not overlap the image, logo, slide number, or callout.
- Resize or crop existing images proportionally when needed.
- Do not stretch or distort images.
- Use consistent image framing, such as a subtle border or clean rectangular crop.

Titles
Use a consistent title style throughout the presentation.
- Titles should be prominent and easy to read.
- Use bold, professional typography.
- Use consistent placement and spacing.
- Do not allow titles to wrap awkwardly or overlap other elements.

Real-World Example Callout
Make the "Real-world example" section visually distinct from the instructional body text.
- Use a light tinted background derived from the company brand colors.
- Add a subtle border or accent line.
- Keep the full example text exactly as written.
- Use consistent internal margins.
- Keep the callout readable without making it look decorative or distracting.
- Clearly emphasize the words "Real-world example".

Logo
Place the attached HAZWOPER Training LLC logo on every slide.
- Use the same location and approximate size throughout the presentation.
- Prefer the upper-right corner or another unobtrusive location.
- Do not cover titles, text, images, or callout boxes.
- Maintain the logo's original aspect ratio.
- Do not stretch, recolor, crop, or distort the logo.
- On the title slide, the logo may be larger and more prominent.
- On content slides, use a smaller, consistent logo treatment.

Title Slide
Give the title slide a stronger and more polished design than the content slides.
- Preserve the existing title and subtitle wording exactly.
- Feature the HAZWOPER Training LLC logo prominently.
- Use the company brand colors.
- Create a clean visual hierarchy.
- Use balanced spacing and professional alignment.
- Do not add marketing claims, slogans, or new wording.

Slide Numbers
Add slide numbers to every slide except the title slide.
- Place them consistently in the lower-right corner.
- Use a readable but unobtrusive size.
- Make sure they do not overlap the logo, examples, images, or existing content.

Quality-Control Requirements
Before returning the presentation, inspect every slide and confirm:
- All original text is present.
- No wording was accidentally altered.
- All em dashes and en dashes were removed.
- No text is cut off or overflowing.
- No text overlaps another element.
- All images remain on their original slides.
- Images are not distorted.
- The logo appears on every slide.
- Fonts and colors are consistent.
- Body-text size is adjusted slide by slide.
- The real-world example is clearly distinct.
- Slide numbers are present and correctly positioned.
- The finished deck opens normally in Microsoft PowerPoint.

Return only the completed editable .pptx file. Do not return a PDF, screenshots, a written design proposal, or instructions for manually making the changes.`;

function buildInput(): string {
  return `You have two attached files available in your working directory: "original.pptx" (the source presentation) and "hazwoper-logo.png" (the company logo referenced below). Open "original.pptx" with python-pptx to make the edits.

${BEAUTIFY_PROMPT}

When finished, save the result as "output.pptx" in your working directory and make sure it is attached in your final message (not just described) so it can be downloaded.`;
}

export async function startBeautify(pptxBuffer: Buffer): Promise<{ responseId: string }> {
  const client = getOpenAI();

  const [pptxFile, logoFile] = await Promise.all([
    client.files.create({
      file: await toFile(pptxBuffer, "original.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      purpose: "assistants",
    }),
    client.files.create({
      file: await toFile(readFileSync(LOGO_PATH), "hazwoper-logo.png", { type: "image/png" }),
      purpose: "assistants",
    }),
  ]);

  const response = await client.responses.create({
    model: textModel(),
    background: true,
    tools: [
      {
        type: "code_interpreter",
        container: { type: "auto", file_ids: [pptxFile.id, logoFile.id] },
      },
    ],
    input: buildInput(),
  });

  return { responseId: response.id };
}

export type BeautifyResult =
  | { status: "running" }
  | { status: "completed"; buffer: Buffer }
  | { status: "failed"; error: string };

export async function checkBeautify(responseId: string): Promise<BeautifyResult> {
  const client = getOpenAI();
  const response = await client.responses.retrieve(responseId);

  if (response.status === "queued" || response.status === "in_progress") {
    return { status: "running" };
  }

  if (response.status !== "completed") {
    return {
      status: "failed",
      error: response.error?.message ?? `Response ended with status: ${response.status ?? "unknown"}`,
    };
  }

  const citation = findOutputFileCitation(response);
  if (!citation) {
    return {
      status: "failed",
      error: "The model finished but didn't attach a .pptx file to its response.",
    };
  }

  const fileResponse = await client.containers.files.content.retrieve(citation.file_id, {
    container_id: citation.container_id,
  });
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  return { status: "completed", buffer };
}

function findOutputFileCitation(
  response: OpenAIResponse,
): { file_id: string; container_id: string } | null {
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (
          annotation.type === "container_file_citation" &&
          annotation.filename?.toLowerCase().endsWith(".pptx")
        ) {
          return { file_id: annotation.file_id, container_id: annotation.container_id };
        }
      }
    }
  }
  return null;
}
