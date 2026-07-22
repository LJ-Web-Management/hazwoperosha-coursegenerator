import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazily initialized so `next build` (which imports route modules to collect
// their config) doesn't fail in environments without DATABASE_URL set yet.
let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    cached = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return cached;
}
