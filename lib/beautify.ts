import { readFileSync } from "fs";
import path from "path";
import { toFile } from "openai/uploads";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { getOpenAI, textModel } from "@/lib/openai";
import { enforceTextFitsInBox } from "@/lib/pptxAutofit";
import { recordOpenAiUsage } from "@/lib/usage";

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
Phase 1 — fix the box geometry so it can never overlap its neighbors, for every slide, before touching font size:
1. Find the title shape's bottom edge (top + height) and the real-world-example callout's top edge on this slide (compute the callout's intended position first if you haven't placed it yet).
2. Set the body text box's top to the title's bottom edge plus a small margin (~0.15in), and set its height so that top + height lands at the callout's top edge minus a small margin (~0.15in). This is the maximum safe vertical span — use it fully; do not leave the box shorter than this span "just in case," and never let it extend past either boundary.
3. Leave the box's width and left position as the existing left-column width; do not change those.

Phase 2 — choose a font size for that corrected box:
4. Pick the largest size from this list that looks reasonable for how much text the slide has: 32, 28, 26, 24, 22, 20, 18, 17, 16 — a slide with two short bullets should end up much larger than a slide with eight long ones. Do not go below 16pt.
5. Do not hand-derive exact wrapped-line math for this — an automated pass runs on the file after you finish and re-measures every text box against its own stored geometry, shrinking anything that doesn't actually fit. That pass only ever shrinks text, never enlarges it, so still pick the largest size that looks reasonable rather than defaulting to something small "to be safe."
6. As a final check, confirm text_box_top >= title_bottom_edge and (text_box_top + text_box_height) <= callout_top_edge. If either is violated, your Phase 1 geometry was wrong — fix it, don't just shrink the font further.
- Maintain consistent line spacing, paragraph spacing, and bullet indentation across slides (the font size varies, but the spacing multipliers/ratios should not).
- Do not distort text boxes or stretch text horizontally — only change font size and box height (per Phase 1), never box width.

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
- Horizontally center each image within its right-hand column (the space between the body text box's right edge and the slide's right margin), rather than left- or right-aligning it. This matters most when the fitted image, after preserving its native aspect ratio, ends up narrower than the column — center the leftover horizontal space evenly on both sides instead of pushing the image to one edge.
- Use consistent image framing, such as a subtle border or clean rectangular crop.

Titles
Every content slide's title arrives already horizontally centered (paragraph alignment = center) across the slide width. Preserve that centered alignment — do not left-align or right-align it, and do not change it when you touch font size or box height for Phase 1 above.
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
Every content slide already has the HAZWOPER Training LLC logo placed in the upper-right corner at the correct size and position, tucked above the title. Do not move, resize, duplicate, restyle, recolor, crop, or delete this logo on content slides — leave that picture shape exactly as it arrives. Only the title slide needs the logo added by you (it doesn't have one yet):
- On the title slide, add the attached logo, larger and more prominent, featured as part of the design.
- Maintain the logo's original aspect ratio; do not stretch, recolor, crop, or distort it.
- Do not cover the title-slide title or subtitle with it.

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
- Place them tucked into the true lower-right corner of the slide, close to the physical edge — about 0.1 inch from the bottom edge and 0.15 inch from the right edge. Do not give it a larger margin than that; a bigger margin is what pushes it into the callout box's footprint.
- Use a readable but unobtrusive size.
- The "Real-world example" callout spans across the bottom of the slide and is the element most likely to collide with the slide number. Before finalizing each slide, explicitly compare the slide number's bounding box against the callout's bounding box (and the logo's, and any image's). If they intersect, do not just leave it: either inset the callout box's width/right edge slightly so it stops short of the slide-number corner, or nudge the slide number to the small margin strip outside the callout's footprint — the two must never overlap.

Quality-Control Requirements
Before returning the presentation, inspect every slide and confirm:
- All original text is present.
- No wording was accidentally altered.
- All em dashes and en dashes were removed.
- No text is cut off or overflowing.
- No text overlaps another element. In particular, on every slide, explicitly recompute and check: body-text-box-top >= title-bottom-edge, and body-text-box-bottom <= callout-top-edge. Do this check even for slides where the text "looked fine" — a box whose stored geometry overlaps its neighbors can still look fine with short text and only show the overlap on slides with more text.
- All images remain on their original slides.
- Every picture's displayed aspect ratio (after any crop) is within 1% of its native aspect ratio — recheck any image that looked stretched, cropped oddly, or squeezed in the original file too.
- Every image is horizontally centered within its column, with no leftover space bunched on one side.
- The logo appears on every slide — untouched in its original upper-right position on content slides, and added prominently on the title slide.
- Every content slide's title is still horizontally centered.
- Fonts and colors are consistent.
- Body-text size looks reasonable per slide (larger for short slides, smaller for dense ones).
- The real-world example is clearly distinct.
- Slide numbers are present, tucked close to the true bottom-right corner, and their bounding box does not intersect the real-world-example callout (or the logo, or any image).
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

export async function checkBeautify(courseId: string, responseId: string): Promise<BeautifyResult> {
  const client = getOpenAI();
  const response = await client.responses.retrieve(responseId);

  if (response.status === "queued" || response.status === "in_progress") {
    return { status: "running" };
  }

  if (response.usage) {
    await recordOpenAiUsage({
      courseId,
      operation: "beautify",
      model: textModel(),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
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
  const rawBuffer = Buffer.from(await fileResponse.arrayBuffer());
  // The model's per-slide font-fit math is a best effort, not a guarantee — re-measure
  // every text box against its own stored geometry and shrink anything that overflows.
  const buffer = await enforceTextFitsInBox(rawBuffer);
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
