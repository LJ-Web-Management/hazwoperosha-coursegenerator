import { getDb } from "./client";
import { generationLocks } from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  await db
    .insert(generationLocks)
    .values({ id: 1 })
    .onConflictDoNothing({ target: generationLocks.id });
  console.log("Seeded generation_locks row.");
  await db.execute(sql`select 1`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
