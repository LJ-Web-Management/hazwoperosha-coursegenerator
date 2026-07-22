import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

const STALE_SECONDS = 90;

export interface LockClaim {
  lockToken: string;
}

export class LockHeldError extends Error {
  constructor(public readonly heldByCourseId: string | null) {
    super("Generation lock is held by another course");
    this.name = "LockHeldError";
  }
}

/** Atomically claims the single global generation lock for a course. Throws LockHeldError if unavailable. */
export async function claimLock(courseId: string): Promise<LockClaim> {
  const db = getDb();
  const rows = await db.execute<{ lock_token: string }>(sql`
    UPDATE generation_locks
    SET locked_course_id = ${courseId},
        lock_token = gen_random_uuid(),
        locked_at = now(),
        heartbeat_at = now()
    WHERE id = 1
      AND (locked_course_id IS NULL OR heartbeat_at < now() - make_interval(secs => ${STALE_SECONDS}))
    RETURNING lock_token
  `);

  if (rows.rows.length === 0) {
    const current = await db.execute<{ locked_course_id: string | null }>(
      sql`SELECT locked_course_id FROM generation_locks WHERE id = 1`,
    );
    throw new LockHeldError(current.rows[0]?.locked_course_id ?? null);
  }

  return { lockToken: rows.rows[0].lock_token };
}

/** Renews the heartbeat for a held lock. Returns false if the lock was reclaimed by someone else. */
export async function renewLock(courseId: string, lockToken: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(sql`
    UPDATE generation_locks
    SET heartbeat_at = now()
    WHERE id = 1 AND locked_course_id = ${courseId} AND lock_token = ${lockToken}
    RETURNING lock_token
  `);
  return rows.rows.length > 0;
}

/** Best-effort release. Safe to call even if the lock was already reclaimed. */
export async function releaseLock(courseId: string, lockToken: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE generation_locks
    SET locked_course_id = NULL, lock_token = NULL, locked_at = NULL, heartbeat_at = NULL
    WHERE id = 1 AND locked_course_id = ${courseId} AND lock_token = ${lockToken}
  `);
}
