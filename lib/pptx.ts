import { readFileSync } from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { fetchAsBuffer } from "@/lib/blob";
import type { courses, slides } from "@/lib/db/schema";

export type CourseRow = typeof courses.$inferSelect;
export type SlideRow = typeof slides.$inferSelect;

const LOGO_PATH = path.join(process.cwd(), "public/brand/hazwoper-logo.png");
// Native logo asset is 280x51 (ratio ~5.49); frame matches that ratio so `contain` doesn't letterbox.
const LOGO_W = 1.3;
const LOGO_H = 0.24;

async function fetchImagesInBatches(
  slideRows: SlideRow[],
  batchSize = 5,
): Promise<Map<string, Buffer>> {
  const withImages = slideRows.filter((s) => s.imageBlobUrl && !s.imageFallbackTextOnly);
  const result = new Map<string, Buffer>();

  for (let i = 0; i < withImages.length; i += batchSize) {
    const batch = withImages.slice(i, i + batchSize);
    const buffers = await Promise.all(batch.map((s) => fetchAsBuffer(s.imageBlobUrl!)));
    batch.forEach((s, j) => result.set(s.id, buffers[j]));
  }

  return result;
}

export async function buildPptx(course: CourseRow, slideRows: SlideRow[]): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "HAZ_16x9", width: 13.33, height: 7.5 });
  pres.layout = "HAZ_16x9";

  const title = pres.addSlide();
  title.addText(course.name, {
    x: 0.5,
    y: 2.5,
    w: "90%",
    h: 1.5,
    fontSize: 40,
    bold: true,
    align: "center",
  });
  title.addText("Hazwoper Osha Training", {
    x: 0.5,
    y: 4.0,
    w: "90%",
    h: 0.6,
    fontSize: 18,
    align: "center",
    color: "666666",
  });

  const imageBuffers = await fetchImagesInBatches(slideRows);
  const logoBuf = readFileSync(LOGO_PATH);
  const logoDataUri = `data:image/png;base64,${logoBuf.toString("base64")}`;

  for (const slide of slideRows) {
    const s = pres.addSlide();
    s.addImage({
      data: logoDataUri,
      x: 13.33 - 0.15 - LOGO_W,
      y: 0.15,
      w: LOGO_W,
      h: LOGO_H,
      sizing: { type: "contain", w: LOGO_W, h: LOGO_H },
    });
    s.addText(slide.title ?? slide.topicTitle, {
      x: 0.4,
      y: 0.5,
      w: "92%",
      h: 0.7,
      fontSize: 28,
      bold: true,
      align: "center",
    });

    const hasImage = Boolean(slide.imageBlobUrl && !slide.imageFallbackTextOnly);
    const bulletW = hasImage ? 6.5 : "92%";

    if (slide.bullets && slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.4, y: 1.3, w: bulletW, h: 4.2, fontSize: 16 },
      );
    }

    const imgBuf = hasImage ? imageBuffers.get(slide.id) : undefined;
    if (imgBuf) {
      // Gemini renders these at 16:9, so `contain` letterboxes them inside the square
      // frame instead of stretching to fill it (pptxgenjs's default `addImage` behavior).
      s.addImage({
        data: `data:image/png;base64,${imgBuf.toString("base64")}`,
        x: 7.2,
        y: 1.3,
        w: 5.6,
        h: 5.6,
        sizing: { type: "contain", w: 5.6, h: 5.6 },
      });
    }

    if (slide.exampleText) {
      s.addText(`Real-world example: ${slide.exampleText}`, {
        x: 0.4,
        y: 5.7,
        w: "92%",
        h: 1.4,
        fontSize: 13,
        italic: true,
        fill: { color: "F2F2F2" },
      });
    }
  }

  const buf = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}
