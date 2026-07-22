import { NextResponse } from "next/server";
import { eq, and, inArray, sql as drizzleSql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides } from "@/lib/db/schema";
import { claimLock, LockHeldError } from "@/lib/lock";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/start">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.status !== "approved" && course.status !== "generating") {
    return NextResponse.json(
      { error: `Course is not ready for generation (status: ${course.status})` },
      { status: 409 },
    );
  }

  let claim;
  try {
    claim = await claimLock(courseId);
  } catch (err) {
    if (err instanceof LockHeldError) {
      let heldByName: string | null = null;
      if (err.heldByCourseId) {
        const [held] = await db
          .select({ name: courses.name })
          .from(courses)
          .where(eq(courses.id, err.heldByCourseId));
        heldByName = held?.name ?? null;
      }
      return NextResponse.json(
        { error: "Another course is currently generating", heldByCourseName: heldByName },
        { status: 409 },
      );
    }
    throw err;
  }

  await db
    .update(courses)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  const total = await db
    .select({ count: drizzleSql<number>`count(*)` })
    .from(slides)
    .where(eq(slides.courseId, courseId));

  const remaining = await db
    .select({ count: drizzleSql<number>`count(*)` })
    .from(slides)
    .where(and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed"])));

  return NextResponse.json({
    lockToken: claim.lockToken,
    totalSlides: Number(total[0]?.count ?? 0),
    remainingSlides: Number(remaining[0]?.count ?? 0),
  });
}
