import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray, asc, sql as drizzleSql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides } from "@/lib/db/schema";
import { renewLock } from "@/lib/lock";
import { generateSlideText, generateSlideImage } from "@/lib/slide-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;

const slideRequestSchema = z.object({
  lockToken: z.string().uuid(),
  slideId: z.string().uuid().optional(), // explicit override for manual per-slide retry
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/slide">,
) {
  const { courseId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = slideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "lockToken required" }, { status: 400 });
  }
  const { lockToken, slideId } = parsed.data;

  const renewed = await renewLock(courseId, lockToken);
  if (!renewed) {
    return NextResponse.json(
      { error: "Lock lost — generation was reclaimed or expired. Stop and resume." },
      { status: 409 },
    );
  }

  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let target;
  if (slideId) {
    const [row] = await db.select().from(slides).where(eq(slides.id, slideId));
    target = row;
  } else {
    const rows = await db
      .select()
      .from(slides)
      .where(
        and(
          eq(slides.courseId, courseId),
          inArray(slides.status, ["pending", "failed"]),
          drizzleSql`${slides.attemptCount} < ${MAX_ATTEMPTS}`,
        ),
      )
      .orderBy(asc(slides.slideIndex))
      .limit(1);
    target = rows[0];
  }

  if (!target) {
    const remaining = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(slides)
      .where(and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed"])));
    const total = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(slides)
      .where(eq(slides.courseId, courseId));
    const totalCount = Number(total[0]?.count ?? 0);
    const remainingCount = Number(remaining[0]?.count ?? 0);
    return NextResponse.json({
      done: true,
      completed: totalCount - remainingCount,
      total: totalCount,
    });
  }

  // Reset if this is a manual retry override on a permanently-failed slide.
  if (slideId && target.attemptCount >= MAX_ATTEMPTS) {
    await db
      .update(slides)
      .set({ attemptCount: 0, errorMessage: null })
      .where(eq(slides.id, target.id));
    target.attemptCount = 0;
  }

  await db
    .update(slides)
    .set({ attemptCount: target.attemptCount + 1, updatedAt: new Date() })
    .where(eq(slides.id, target.id));

  const neighboring = await db
    .select({ title: slides.topicTitle })
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(asc(slides.slideIndex));
  const neighboringTitles = neighboring
    .slice(Math.max(0, target.slideIndex - 2), target.slideIndex + 2)
    .map((n) => n.title)
    .filter((t) => t !== target.topicTitle);

  try {
    const text = await generateSlideText({
      courseName: course.name,
      moduleTitle: target.moduleTitle,
      topicTitle: target.topicTitle,
      neighboringTitles,
    });

    const image = await generateSlideImage(courseId, target.slideIndex, text.imagePrompt);

    await db
      .update(slides)
      .set({
        title: text.title,
        bullets: text.bullets,
        exampleText: text.example,
        imagePrompt: text.imagePrompt,
        imageBlobUrl: image.blobUrl,
        imageFallbackTextOnly: image.fallbackTextOnly,
        status: "complete",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(slides.id, target.id));

    const remaining = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(slides)
      .where(and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed"])));
    const total = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(slides)
      .where(eq(slides.courseId, courseId));
    const totalCount = Number(total[0]?.count ?? 0);
    const remainingCount = Number(remaining[0]?.count ?? 0);

    return NextResponse.json({
      done: false,
      completed: totalCount - remainingCount,
      total: totalCount,
      slide: { id: target.id, slideIndex: target.slideIndex, title: text.title },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Slide ${target.slideIndex} generation failed`, err);
    await db
      .update(slides)
      .set({ status: "failed", errorMessage: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(slides.id, target.id));

    return NextResponse.json({
      done: false,
      retryable: target.attemptCount + 1 < MAX_ATTEMPTS,
      slide: { id: target.id, slideIndex: target.slideIndex, error: message },
    });
  }
}
