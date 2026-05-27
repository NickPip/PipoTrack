import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Only run tests, not source files that happen to live next to them.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Don't try to bundle Next.js server-only modules.
    globals: false,
  },
});
