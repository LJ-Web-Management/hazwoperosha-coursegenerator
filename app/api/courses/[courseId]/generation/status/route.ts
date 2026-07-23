import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/status">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db
    .select({ status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId));

  const rows = await db
    .select({
      id: slides.id,
      slideIndex: slides.slideIndex,
      title: slides.title,
      moduleTitle: slides.moduleTitle,
      topicTitle: slides.topicTitle,
      status: slides.status,
      attemptCount: slides.attemptCount,
      errorMessage: slides.errorMessage,
      updatedAt: slides.updatedAt,
    })
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(asc(slides.slideIndex));

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "complete").length;
  // A slide can also get stuck at in_progress with attempt_count already maxed out — e.g. its
  // last attempt was killed by a server timeout before it could mark itself failed. It's no
  // longer reclaimable by the normal worker loop, so treat it the same as a failed slide.
  const permanentlyFailed = rows.filter(
    (r) => (r.status === "failed" || r.status === "in_progress") && r.attemptCount >= 3,
  ).length;

  return NextResponse.json({
    courseStatus: course?.status ?? null,
    slides: rows,
    total,
    completed,
    permanentlyFailed,
  });
}
