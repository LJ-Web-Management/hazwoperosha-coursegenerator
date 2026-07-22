import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses } from "@/lib/db/schema";
import { forceReleaseCourse } from "@/lib/lock";

export const runtime = "nodejs";

/**
 * Force-stops generation for this course, regardless of which browser/tab (if any)
 * is currently driving it. Any in-flight /generation/slide calls holding the old
 * lock token will fail their next renewLock check and stop themselves.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/stop">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  await forceReleaseCourse(courseId);

  if (course.status === "generating") {
    await db
      .update(courses)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(courses.id, courseId));
  }

  return NextResponse.json({ ok: true });
}
