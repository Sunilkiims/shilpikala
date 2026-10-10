/**
 * Imports data from the old file-based storage (storage/*.json[l] and
 * public/images/products) into the database named by DATABASE_URL
 * (or the local embedded database when unset).
 *
 *   npm run db:import-legacy
 */
import { getDb, getDbKind } from "../src/lib/db";
import { importLegacyData } from "../src/lib/db/legacyImport";

(async () => {
  const db = await getDb();
  console.log(`Importing legacy data into ${getDbKind()} database…`);
  const report = await importLegacyData(db, process.cwd());
  console.log(report);
  if (report.missingImages.length) {
    console.warn(`\n${report.missingImages.length} product photo(s) were not found on disk and were skipped:`);
    for (const src of report.missingImages) console.warn("  ", src);
    console.warn("Re-upload them from the admin product page.");
  }
  process.exit(0);
})().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
