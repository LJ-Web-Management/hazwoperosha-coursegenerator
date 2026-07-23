import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides, courseExports } from "@/lib/db/schema";
import { buildPptx } from "@/lib/pptx";
import { startBeautify } from "@/lib/beautify";
import { uploadBuffer } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/export/beautify/start">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.beautifyStatus === "running") {
    return NextResponse.json({ error: "A beautify job is already running for this course" }, { status: 409 });
  }

  const slideRows = await db
    .select()
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(asc(slides.slideIndex));

  if (slideRows.length === 0 || slideRows.some((s) => s.status !== "complete")) {
    return NextResponse.json(
      { error: "All slides must be generated before beautifying" },
      { status: 409 },
    );
  }

  const pptxBuffer = await buildPptx(course, slideRows);

  // Persist the unstyled original as a fallback export in case the AI redesign fails.
  const rawUrl = await uploadBuffer(
    `courses/${courseId}/export/course.pptx`,
    pptxBuffer,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  await db.insert(courseExports).values({
    courseId,
    type: "pptx",
    blobUrl: rawUrl,
    fileSizeBytes: pptxBuffer.byteLength,
  });

  let responseId: string;
  try {
    const started = await startBeautify(pptxBuffer);
    responseId = started.responseId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(courses)
      .set({ beautifyStatus: "failed", beautifyError: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(courses.id, courseId));
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await db
    .update(courses)
    .set({
      beautifyResponseId: responseId,
      beautifyStatus: "running",
      beautifyError: null,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ status: "running" });
}
