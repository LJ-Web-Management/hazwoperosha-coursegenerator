import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { slides } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/status">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();
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
    })
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(asc(slides.slideIndex));

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "complete").length;
  const permanentlyFailed = rows.filter((r) => r.status === "failed" && r.attemptCount >= 3).length;

  return NextResponse.json({ slides: rows, total, completed, permanentlyFailed });
}
