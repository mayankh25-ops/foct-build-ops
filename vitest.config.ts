import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // localStorage-backed stores are imported by some modules under test;
    // jsdom is not needed because the pure functions never touch it, but a
    // stub keeps module-level `typeof window` guards honest.
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.d.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
