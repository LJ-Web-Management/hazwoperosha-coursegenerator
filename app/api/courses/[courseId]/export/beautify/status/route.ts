import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, courseExports } from "@/lib/db/schema";
import { checkBeautify } from "@/lib/beautify";
import { uploadBuffer } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/export/beautify/status">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (!course.beautifyStatus || course.beautifyStatus === "idle") {
    return NextResponse.json({ status: "idle" });
  }

  if (course.beautifyStatus === "completed") {
    const [latest] = await db
      .select()
      .from(courseExports)
      .where(and(eq(courseExports.courseId, courseId), eq(courseExports.type, "pptx_beautified")))
      .orderBy(desc(courseExports.createdAt))
      .limit(1);
    return NextResponse.json({ status: "completed", url: latest?.blobUrl });
  }

  if (course.beautifyStatus === "failed") {
    return NextResponse.json({ status: "failed", error: course.beautifyError });
  }

  // status === "running" — actually poll OpenAI
  if (!course.beautifyResponseId) {
    return NextResponse.json({ status: "failed", error: "Missing response id" });
  }

  const result = await checkBeautify(courseId, course.beautifyResponseId);

  if (result.status === "running") {
    return NextResponse.json({ status: "running" });
  }

  if (result.status === "failed") {
    await db
      .update(courses)
      .set({ beautifyStatus: "failed", beautifyError: result.error.slice(0, 500), updatedAt: new Date() })
      .where(eq(courses.id, courseId));
    return NextResponse.json({ status: "failed", error: result.error });
  }

  const url = await uploadBuffer(
    `courses/${courseId}/export/course-beautified.pptx`,
    result.buffer,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );

  await db.insert(courseExports).values({
    courseId,
    type: "pptx_beautified",
    blobUrl: url,
    fileSizeBytes: result.buffer.byteLength,
  });

  await db
    .update(courses)
    .set({ beautifyStatus: "completed", beautifyError: null, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ status: "completed", url });
}
