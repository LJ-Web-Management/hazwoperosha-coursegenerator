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
You cannot visually preview the rendered slide, so compute each slide's body font size explicitly instead of guessing — do not just pick a size that "looks about right."
For every slide's body text box, follow this procedure in your Python code:
1. Read the text box's width and height in points (EMU / 12700), then subtract its internal margins (text_frame margin_left/right/top/bottom, or 0.1 inch per side if unset) to get the usable width and height.
2. For a candidate font size, estimate the wrapped line count of each bullet as ceil((len(bullet_text) * avg_char_width_at_size) / usable_width), where avg_char_width_at_size ≈ 0.5 * font_size_pt for a typical sans-serif body font. Sum the wrapped-line counts across all bullets (each bullet also gets +1 line of paragraph spacing) to get the total lines needed at that size.
3. Multiply total lines needed by the line height (≈ 1.2 * font_size_pt) to get the total height needed at that candidate size.
4. Starting at 32pt and stepping down (32, 28, 26, 24, 22, 20, 18, 17, 16, 15, 14), pick the LARGEST size where the total height needed fits within the usable height. This is why the size must vary slide to slide — a slide with two short bullets should end up much larger than a slide with eight long ones.
5. Use approximately 18-point as the preferred minimum; only go below 18pt (down to 14pt) if the slide's original text genuinely cannot fit at 18pt within its box — never truncate, shrink the box, or drop text to avoid this.
6. After setting the computed size, also set text_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE on that text box as a safety net only — it lets PowerPoint shrink further on open if your estimate was still slightly too large, but it is not a substitute for step 4; do not skip the explicit computation and rely on autofit alone, since autofit never enlarges text and tends to over-shrink.
- Maintain consistent line spacing, paragraph spacing, and bullet indentation across slides (the font size varies, but the spacing multipliers/ratios should not).
- Do not distort text boxes or stretch text horizontally — only change font size and, if truly necessary, the text box height, never its width.

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
- Some source images may already be stretched out of their native proportions (e.g. a widescreen image squeezed into a square frame) — correct this rather than preserving it.
- Never independently set a picture shape's width and height to arbitrary values that change its native aspect ratio. Before resizing or repositioning any picture, first read its native pixel dimensions (shape.image.size) and compute native_ratio = native_width / native_height. Then, for the target frame you're placing it in, either:
  (a) fit the image entirely within the frame preserving native_ratio (shrink one dimension so nothing is cut off, leaving a small margin rather than stretching to fill the frame exactly), or
  (b) fill the frame edge-to-edge by proportionally cropping the overflow with shape.crop_left / crop_right / crop_top / crop_bottom (values between 0 and 1) — never by scaling width and height independently.
- After resizing any picture, verify new_width / new_height is within 1% of native_ratio (accounting for any crop you applied) before moving to the next slide.
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
- Every picture's displayed aspect ratio (after any crop) is within 1% of its native aspect ratio — recheck any image that looked stretched, cropped oddly, or squeezed in the original file too.
- The logo appears on every slide.
- Fonts and colors are consistent.
- Body-text size was computed per slide using the sizing procedure above (not eyeballed), and no body text box relies on auto-shrink alone to avoid overflow.
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
