import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray, sql as drizzleSql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, slides } from "@/lib/db/schema";
import { releaseLock } from "@/lib/lock";

export const runtime = "nodejs";

const releaseSchema = z.object({ lockToken: z.string().uuid() });

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/generation/release">,
) {
  const { courseId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "lockToken required" }, { status: 400 });
  }

  await releaseLock(courseId, parsed.data.lockToken);

  const db = getDb();
  const remaining = await db
    .select({ count: drizzleSql<number>`count(*)` })
    .from(slides)
    .where(and(eq(slides.courseId, courseId), inArray(slides.status, ["pending", "failed"])));

  const allDone = Number(remaining[0]?.count ?? 0) === 0;
  await db
    .update(courses)
    .set({ status: allDone ? "completed" : "approved", updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ ok: true, completed: allDone });
}
