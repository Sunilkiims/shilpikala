import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test-support/setup.ts"],
    // Each test file boots an embedded Postgres (WASM); under parallel load that can exceed 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
