import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, outlineVersions } from "@/lib/db/schema";
import { reviseOutline } from "@/lib/outline";

export const runtime = "nodejs";

const reviseSchema = z.object({
  feedback: z.string().min(1).max(4000),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/outline/revise">,
) {
  const { courseId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = reviseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course || !course.currentOutlineVersionId) {
    return NextResponse.json({ error: "Course or outline not found" }, { status: 404 });
  }

  const [current] = await db
    .select()
    .from(outlineVersions)
    .where(eq(outlineVersions.id, course.currentOutlineVersionId));
  if (!current) {
    return NextResponse.json({ error: "Current outline version not found" }, { status: 404 });
  }

  let revised;
  try {
    revised = await reviseOutline(current.modules, parsed.data.feedback);
  } catch (err) {
    console.error("Failed to revise outline", err);
    return NextResponse.json({ error: "Failed to revise outline" }, { status: 502 });
  }

  const [newVersion] = await db
    .insert(outlineVersions)
    .values({
      courseId,
      versionNumber: current.versionNumber + 1,
      parentVersionId: current.id,
      modules: revised.modules,
      appliedFeedback: parsed.data.feedback,
      status: "pending_review",
      createdBy: "ai_revision",
    })
    .returning();

  await db
    .update(outlineVersions)
    .set({ status: "superseded" })
    .where(eq(outlineVersions.id, current.id));

  await db
    .update(courses)
    .set({ currentOutlineVersionId: newVersion.id, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ outlineVersion: newVersion });
}
