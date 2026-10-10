/**
 * Loads .env.local / .env the same way `next dev` does. Standalone
 * scripts (tsx) don't get this for free — without it DATABASE_URL would
 * look unset and the script would use the embedded database.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
