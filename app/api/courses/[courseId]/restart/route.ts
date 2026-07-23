import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides, courseExports } from "@/lib/db/schema";
import { forceReleaseCourse } from "@/lib/lock";

export const runtime = "nodejs";

/** Resets a course back to a pre-generation state so it can be regenerated from scratch. */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/restart">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  await forceReleaseCourse(courseId);

  await db
    .update(slides)
    .set({
      status: "pending",
      attemptCount: 0,
      errorMessage: null,
      title: null,
      bullets: null,
      exampleText: null,
      imagePrompt: null,
      imageBlobUrl: null,
      imageFallbackTextOnly: false,
      updatedAt: new Date(),
    })
    .where(eq(slides.courseId, courseId));

  await db.delete(courseExports).where(eq(courseExports.courseId, courseId));

  await db
    .update(courses)
    .set({
      status: "approved",
      beautifyResponseId: null,
      beautifyStatus: null,
      beautifyError: null,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ ok: true });
}
