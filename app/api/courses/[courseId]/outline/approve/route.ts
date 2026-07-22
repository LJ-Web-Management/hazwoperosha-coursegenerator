import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses, outlineVersions, slides } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/courses/[courseId]/outline/approve">,
) {
  const { courseId } = await ctx.params;
  const db = getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course || !course.currentOutlineVersionId) {
    return NextResponse.json({ error: "Course or outline not found" }, { status: 404 });
  }

  const [version] = await db
    .select()
    .from(outlineVersions)
    .where(eq(outlineVersions.id, course.currentOutlineVersionId));
  if (!version) {
    return NextResponse.json({ error: "Outline version not found" }, { status: 404 });
  }

  // Idempotent: if this version was already approved and flattened, don't duplicate slides.
  const existing = await db.select({ id: slides.id }).from(slides).where(eq(slides.outlineVersionId, version.id));
  if (existing.length === 0) {
    let slideIndex = 0;
    const rows: (typeof slides.$inferInsert)[] = [];
    version.modules.forEach((mod, moduleIndex) => {
      mod.topics.forEach((topic, topicIndex) => {
        for (let i = 0; i < topic.slideCount; i++) {
          rows.push({
            courseId,
            outlineVersionId: version.id,
            moduleIndex,
            topicIndex,
            slideIndex: slideIndex++,
            moduleTitle: mod.title,
            topicTitle: topic.title,
            status: "pending",
          });
        }
      });
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Outline has no slides to generate" }, { status: 400 });
    }

    await db.insert(slides).values(rows);
  }

  await db
    .update(outlineVersions)
    .set({ status: "approved" })
    .where(eq(outlineVersions.id, version.id));

  await db
    .update(courses)
    .set({
      status: "approved",
      approvedOutlineVersionId: version.id,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  return NextResponse.json({ ok: true });
}
