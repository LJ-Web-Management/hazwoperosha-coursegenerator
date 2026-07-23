import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, or, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { slides } from "@/lib/db/schema";

export const runtime = "nodejs";

const STALE_IN_PROGRESS_MINUTES = 3;

const bodySchema = z.object({ slideId: z.string().uuid() });

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/reset-slide">,
) {
  const { courseId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "slideId required" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(slides)
    .set({ status: "pending", attemptCount: 0, errorMessage: null, updatedAt: new Date() })
    .where(
      and(
        eq(slides.id, parsed.data.slideId),
        eq(slides.courseId, courseId),
        or(
          eq(slides.status, "failed"),
          // Only a stuck (stale) in_progress slide, not one an active worker might still be
          // generating right now.
          and(
            eq(slides.status, "in_progress"),
            lt(slides.updatedAt, sql`now() - make_interval(mins => ${STALE_IN_PROGRESS_MINUTES})`),
          ),
        ),
      ),
    );

  return NextResponse.json({ ok: true });
}
