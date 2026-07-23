import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { courses, outlineVersions } from "@/lib/db/schema";
import { generateInitialOutline } from "@/lib/outline";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  durationMinutes: z.number().int().min(5).max(480),
});

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(courses).orderBy(desc(courses.createdAt));
  return NextResponse.json({ courses: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, durationMinutes } = parsed.data;

  const db = getDb();
  const [course] = await db
    .insert(courses)
    .values({ name, requestedDurationMinutes: durationMinutes, status: "draft" })
    .returning();

  try {
    const outline = await generateInitialOutline(name, durationMinutes);
    const [version] = await db
      .insert(outlineVersions)
      .values({
        courseId: course.id,
        versionNumber: 1,
        modules: outline.modules,
        status: "pending_review",
        createdBy: "ai_initial",
      })
      .returning();

    await db
      .update(courses)
      .set({
        status: "outline_review",
        currentOutlineVersionId: version.id,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, course.id));

    return NextResponse.json({ courseId: course.id }, { status: 201 });
  } catch (err) {
    await db
      .update(courses)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(courses.id, course.id));
    console.error("Failed to generate initial outline", err);
    return NextResponse.json(
      { error: "Failed to generate outline", courseId: course.id },
      { status: 502 },
    );
  }
}
