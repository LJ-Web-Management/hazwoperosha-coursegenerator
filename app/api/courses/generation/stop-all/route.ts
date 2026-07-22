import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { courses } from "@/lib/db/schema";
import { forceReleaseAll } from "@/lib/lock";

export const runtime = "nodejs";

/** Force-stops every currently-generating course, across all users/devices. */
export async function POST() {
  const db = getDb();
  const stoppedCourseIds = await forceReleaseAll();

  if (stoppedCourseIds.length > 0) {
    await db
      .update(courses)
      .set({ status: "approved" })
      .where(inArray(courses.id, stoppedCourseIds));
  }

  return NextResponse.json({ ok: true, stoppedCount: stoppedCourseIds.length });
}
