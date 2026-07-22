import JSZip from "jszip";
import { renderManifest } from "@/lib/scorm/manifest";
import { SCORM_API_JS, VIEWER_CSS, VIEWER_HTML, VIEWER_JS } from "@/lib/scorm/templates";
import { fetchAsBuffer } from "@/lib/blob";
import type { CourseRow, SlideRow } from "@/lib/pptx";

interface SlidesJsonEntry {
  moduleTitle: string;
  title: string;
  bullets: string[];
  exampleText: string | null;
  imagePath: string | null;
}

export async function buildScormZip(course: CourseRow, slideRows: SlideRow[]): Promise<Buffer> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images")!;
  const imageFileNames: string[] = [];

  const slidesJson: SlidesJsonEntry[] = [];
  for (const slide of slideRows) {
    let imagePath: string | null = null;
    if (slide.imageBlobUrl && !slide.imageFallbackTextOnly) {
      const fileName = `slide-${slide.slideIndex}.png`;
      const bytes = await fetchAsBuffer(slide.imageBlobUrl);
      imagesFolder.file(fileName, bytes);
      imageFileNames.push(fileName);
      imagePath = `images/${fileName}`;
    }

    slidesJson.push({
      moduleTitle: slide.moduleTitle,
      title: slide.title ?? slide.topicTitle,
      bullets: slide.bullets ?? [],
      exampleText: slide.exampleText,
      imagePath,
    });
  }

  zip.file("imsmanifest.xml", renderManifest(course, imageFileNames));
  zip.file("viewer.html", VIEWER_HTML);
  zip.file("viewer.js", VIEWER_JS);
  zip.file("viewer.css", VIEWER_CSS);
  zip.file("scorm-api.js", SCORM_API_JS);
  zip.file("slides.json", JSON.stringify({ courseTitle: course.name, slides: slidesJson }));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
