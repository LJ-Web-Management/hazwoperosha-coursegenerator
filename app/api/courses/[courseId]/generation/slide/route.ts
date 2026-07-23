import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray, sql as drizzleSql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides } from "@/lib/db/schema";
import { renewLock } from "@/lib/lock";
import { generateSlideText, generateSlideImage } from "@/lib/slide-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const STALE_IN_PROGRESS_MINUTES = 3;

interface RawSlideRow {
  [key: string]: unknown;
  id: string;
  slide_index: number;
  module_title: string;
  topic_title: string;
  attempt_count: number;
}

const slideRequestSchema = z.object({
  lockToken: z.string().uuid(),
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
  const { lockToken } = parsed.data;

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

  // Atomic claim: a single UPDATE...WHERE id=(SELECT...FOR UPDATE SKIP LOCKED) so
  // multiple concurrent workers for the same course never claim the same slide.
  const claimed = await db.execute<RawSlideRow>(drizzleSql`
    UPDATE slides
    SET status = 'in_progress', attempt_count = attempt_count + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM slides
      WHERE course_id = ${courseId}
        AND (
          status IN ('pending', 'failed')
          OR (status = 'in_progress' AND updated_at < now() - make_interval(mins => ${STALE_IN_PROGRESS_MINUTES}))
        )
        AND attempt_count < ${MAX_ATTEMPTS}
      ORDER BY slide_index
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, slide_index, module_title, topic_title, attempt_count
  `);
  const target = claimed.rows[0];

  if (!target) {
    const remaining = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(slides)
      .where(
        and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed", "in_progress"])),
      );
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

  const neighboring = await db
    .select({ title: slides.topicTitle })
    .from(slides)
    .where(eq(slides.courseId, courseId))
    .orderBy(slides.slideIndex);
  const neighboringTitles = neighboring
    .slice(Math.max(0, target.slide_index - 2), target.slide_index + 2)
    .map((n) => n.title)
    .filter((t) => t !== target!.topic_title);

  try {
    const text = await generateSlideText({
      courseId,
      courseName: course.name,
      moduleTitle: target.module_title,
      topicTitle: target.topic_title,
      neighboringTitles,
    });

    const image = await generateSlideImage(courseId, target.slide_index, text.imagePrompt);

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
      .where(
        and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed", "in_progress"])),
      );
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
      slide: { id: target.id, slideIndex: target.slide_index, title: text.title },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Slide ${target.slide_index} generation failed`, err);
    await db
      .update(slides)
      .set({ status: "failed", errorMessage: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(slides.id, target.id));

    return NextResponse.json({
      done: false,
      retryable: target.attempt_count < MAX_ATTEMPTS,
      slide: { id: target.id, slideIndex: target.slide_index, error: message },
    });
  }
}