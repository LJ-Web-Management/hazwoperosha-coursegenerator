import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, outlineVersions, slides, courseExports } from "@/lib/db/schema";
import { forceReleaseCourse } from "@/lib/lock";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: RouteContext<"/api/courses/[courseId]">) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const outlineVersionRows = await db
    .select()
    .from(outlineVersions)
    .where(eq(outlineVersions.courseId, courseId));

  const slideRows = await db
    .select({
      id: slides.id,
      slideIndex: slides.slideIndex,
      moduleTitle: slides.moduleTitle,
      topicTitle: slides.topicTitle,
      title: slides.title,
      status: slides.status,
      attemptCount: slides.attemptCount,
      errorMessage: slides.errorMessage,
      imageFallbackTextOnly: slides.imageFallbackTextOnly,
    })
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(slides.slideIndex);

  const exportRows = await db
    .select()
    .from(courseExports)
    .where(eq(courseExports.courseId, courseId))
    .orderBy(desc(courseExports.createdAt));

  return NextResponse.json({
    course,
    outlineVersions: outlineVersionRows,
    slides: slideRows,
    exports: exportRows,
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/courses/[courseId]">) {
  const { courseId } = await ctx.params;
  const db = getDb();

  await forceReleaseCourse(courseId);

  const deleted = await db.delete(courses).where(eq(courses.id, courseId)).returning({ id: courses.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
