import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { slides } from "@/lib/db/schema";

export const runtime = "nodejs";

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
        eq(slides.status, "failed"),
      ),
    );

  return NextResponse.json({ ok: true });
}
