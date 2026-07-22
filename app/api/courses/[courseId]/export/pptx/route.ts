import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides, courseExports } from "@/lib/db/schema";
import { buildPptx } from "@/lib/pptx";
import { uploadBuffer } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/export/pptx">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const slideRows = await db
    .select()
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(asc(slides.slideIndex));

  if (slideRows.length === 0 || slideRows.some((s) => s.status !== "complete")) {
    return NextResponse.json(
      { error: "All slides must be generated before exporting" },
      { status: 409 },
    );
  }

  const buf = await buildPptx(course, slideRows);
  const url = await uploadBuffer(
    `courses/${courseId}/export/course.pptx`,
    buf,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );

  await db.insert(courseExports).values({
    courseId,
    type: "pptx",
    blobUrl: url,
    fileSizeBytes: buf.byteLength,
  });

  return NextResponse.json({ url });
}
