import { getDb } from "./client";
import { generationLocks } from "./schema";
import { MAX_CONCURRENT_COURSES } from "@/lib/lock";

async function main() {
  const db = getDb();
  const slotIds = Array.from({ length: MAX_CONCURRENT_COURSES }, (_, i) => i + 1);
  await db
    .insert(generationLocks)
    .values(slotIds.map((id) => ({ id })))
    .onConflictDoNothing({ target: generationLocks.id });
  console.log(`Seeded ${slotIds.length} generation_locks slot(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
