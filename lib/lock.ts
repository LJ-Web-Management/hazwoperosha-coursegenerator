import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

const STALE_SECONDS = 90;
export const MAX_CONCURRENT_COURSES = 3;

export interface LockClaim {
  lockToken: string;
}

export class LockHeldError extends Error {
  constructor(public readonly heldByCourseIds: string[]) {
    super("Generation lock slots are all held");
    this.name = "LockHeldError";
  }
}

/**
 * Atomically claims one of the MAX_CONCURRENT_COURSES generation slots for a course.
 * Tries each slot in turn — each attempt is a single atomic UPDATE, so this is safe
 * under concurrent claims from different courses. Throws LockHeldError if all slots
 * are held by other (non-stale) courses.
 */
export async function claimLock(courseId: string): Promise<LockClaim> {
  const db = getDb();

  for (let slot = 1; slot <= MAX_CONCURRENT_COURSES; slot++) {
    const rows = await db.execute<{ lock_token: string }>(sql`
      UPDATE generation_locks
      SET locked_course_id = ${courseId},
          lock_token = gen_random_uuid(),
          locked_at = now(),
          heartbeat_at = now()
      WHERE id = ${slot}
        AND (
          locked_course_id IS NULL
          OR locked_course_id = ${courseId}
          OR heartbeat_at < now() - make_interval(secs => ${STALE_SECONDS})
        )
      RETURNING lock_token
    `);
    if (rows.rows.length > 0) {
      return { lockToken: rows.rows[0].lock_token };
    }
  }

  const active = await db.execute<{ locked_course_id: string }>(
    sql`SELECT locked_course_id FROM generation_locks WHERE locked_course_id IS NOT NULL`,
  );
  throw new LockHeldError(active.rows.map((r) => r.locked_course_id));
}

/** Renews the heartbeat for a held slot. Returns false if the slot was reclaimed by someone else. */
export async function renewLock(courseId: string, lockToken: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(sql`
    UPDATE generation_locks
    SET heartbeat_at = now()
    WHERE locked_course_id = ${courseId} AND lock_token = ${lockToken}
    RETURNING lock_token
  `);
  return rows.rows.length > 0;
}

/** Best-effort release. Safe to call even if the slot was already reclaimed. */
export async function releaseLock(courseId: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE generation_locks
    SET locked_course_id = NULL, lock_token = NULL, locked_at = NULL, heartbeat_at = NULL
    WHERE locked_course_id = ${courseId} AND lock_token = ${lockToken}
  `);
}

/** Force-releases whichever slot (if any) is held by this course, regardless of token. */
export async function forceReleaseCourse(courseId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(sql`
    UPDATE generation_locks
    SET locked_course_id = NULL, lock_token = NULL, locked_at = NULL, heartbeat_at = NULL
    WHERE locked_course_id = ${courseId}
    RETURNING id
  `);
  return rows.rows.length > 0;
}

/** Force-releases every held slot. Returns the course IDs that were stopped. */
export async function forceReleaseAll(): Promise<string[]> {
  const db = getDb();
  const rows = await db.execute<{ locked_course_id: string }>(sql`
    UPDATE generation_locks
    SET locked_course_id = NULL, lock_token = NULL, locked_at = NULL, heartbeat_at = NULL
    WHERE locked_course_id IS NOT NULL
    RETURNING locked_course_id
  `);
  return rows.rows.map((r) => r.locked_course_id);
}
