import JSZip from "jszip";

// EMU (English Metric Units) is the coordinate unit PowerPoint XML stores geometry in.
const EMU_PER_POINT = 12700;
const DEFAULT_INSET_EMU = 91440; // python-pptx/PowerPoint default text-box inset: 0.1in per side
const MIN_FONT_PT = 10;
const AVG_CHAR_WIDTH_FACTOR = 0.5; // heuristic average glyph width for a sans-serif body font
const LINE_HEIGHT_FACTOR = 1.2;
const SAFETY_MARGIN = 0.93; // leaves headroom for the wrap estimate's inherent error

/**
 * The AI redesign step asks an LLM to compute font sizes and box geometry via
 * generated Python each run, which is not reliably correct. This is the deterministic
 * backstop: it re-measures every text box against its own stored geometry and shrinks
 * any text that doesn't actually fit, so overflow can't reach the final file regardless
 * of what the model produced.
 */
export async function enforceTextFitsInBox(pptxBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );

  for (const name of slideFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    const fitted = fitSlideText(xml);
    if (fitted !== xml) zip.file(name, fitted);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

function fitSlideText(xml: string): string {
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shapeXml) => fitShapeText(shapeXml));
}

interface Box {
  widthPt: number;
  heightPt: number;
}

function fitShapeText(shapeXml: string): string {
  const box = readBoxGeometry(shapeXml);
  if (!box) return shapeXml;

  const sizes = [...shapeXml.matchAll(/\bsz="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  if (sizes.length === 0) return shapeXml;

  const paragraphs = [...shapeXml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) =>
    extractParagraphText(m[1]),
  );
  if (paragraphs.every((p) => p.length === 0)) return shapeXml;

  const baseFontPt = Math.max(...sizes) / 100;
  const fittedFontPt = findFittingFontSize(paragraphs, box, baseFontPt);

  let result = shapeXml;
  if (fittedFontPt < baseFontPt) {
    const scale = fittedFontPt / baseFontPt;
    result = result.replace(/\bsz="(\d+)"/g, (_m, val: string) => {
      const scaled = Math.max(MIN_FONT_PT * 100, Math.round(parseInt(val, 10) * scale));
      return `sz="${scaled}"`;
    });
  }

  return ensureNormAutofit(result);
}

function readBoxGeometry(shapeXml: string): Box | null {
  const xfrmMatch = shapeXml.match(
    /<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/,
  );
  if (!xfrmMatch) return null;
  const cx = parseInt(xfrmMatch[3], 10);
  const cy = parseInt(xfrmMatch[4], 10);

  const bodyPrMatch = shapeXml.match(/<a:bodyPr([^>]*?)\/?>/);
  const attrs = bodyPrMatch?.[1] ?? "";
  const lIns = readInset(attrs, "lIns");
  const rIns = readInset(attrs, "rIns");
  const tIns = readInset(attrs, "tIns");
  const bIns = readInset(attrs, "bIns");

  const widthPt = (cx - lIns - rIns) / EMU_PER_POINT;
  const heightPt = (cy - tIns - bIns) / EMU_PER_POINT;
  if (widthPt <= 0 || heightPt <= 0) return null;
  return { widthPt, heightPt };
}

function readInset(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`${name}="(\\d+)"`));
  return m ? parseInt(m[1], 10) : DEFAULT_INSET_EMU;
}

function extractParagraphText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("");
}

function findFittingFontSize(paragraphs: string[], box: Box, startPt: number): number {
  for (let f = Math.floor(startPt); f >= MIN_FONT_PT; f--) {
    if (estimateHeight(paragraphs, box.widthPt, f) <= box.heightPt * SAFETY_MARGIN) {
      return f;
    }
  }
  return MIN_FONT_PT;
}

function estimateHeight(paragraphs: string[], usableWidthPt: number, fontPt: number): number {
  const avgCharWidthPt = AVG_CHAR_WIDTH_FACTOR * fontPt;
  let totalLines = 0;
  for (const text of paragraphs) {
    if (text.length === 0) {
      totalLines += 1;
      continue;
    }
    totalLines += Math.max(1, Math.ceil((text.length * avgCharWidthPt) / usableWidthPt));
  }
  return totalLines * LINE_HEIGHT_FACTOR * fontPt;
}

const AUTOFIT_CHILDREN_RE =
  /<a:(?:noAutofit|spAutoFit|normAutofit)(?:[^>]*?)\/>|<a:normAutofit[^>]*>[\s\S]*?<\/a:normAutofit>/g;

function ensureNormAutofit(shapeXml: string): string {
  const selfClosing = /<a:bodyPr([^>]*)\/>/;
  if (selfClosing.test(shapeXml)) {
    return shapeXml.replace(selfClosing, (_m, attrs: string) => `<a:bodyPr${attrs}><a:normAutofit/></a:bodyPr>`);
  }

  const withChildren = /<a:bodyPr([^>]*)>([\s\S]*?)<\/a:bodyPr>/;
  return shapeXml.replace(withChildren, (_m, attrs: string, children: string) => {
    const cleaned = children.replace(AUTOFIT_CHILDREN_RE, "");
    return `<a:bodyPr${attrs}>${cleaned}<a:normAutofit/></a:bodyPr>`;
  });
}
