import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "hz_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(expiresAtMs: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(String(expiresAtMs)).digest("base64url");
}

export function createSessionCookieValue(): string {
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  return `${expiresAtMs}.${sign(expiresAtMs)}`;
}

export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  if (!expStr || !sig) return false;
  const expiresAtMs = Number(expStr);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

  const expected = sign(expiresAtMs);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPassword(submitted: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
