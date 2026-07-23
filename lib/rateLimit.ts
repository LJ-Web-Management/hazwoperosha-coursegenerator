const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function prune(now: number): void {
  for (const [key, entry] of failedAttempts) {
    if (entry.resetAt <= now) failedAttempts.delete(key);
  }
}

/** Returns seconds to wait if `key` is currently rate-limited, or null if it may proceed. */
export function isRateLimited(key: string): number | null {
  const entry = failedAttempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) return null;
  if (entry.count < MAX_ATTEMPTS) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  prune(now);
  const entry = failedAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string): void {
  failedAttempts.delete(key);
}
