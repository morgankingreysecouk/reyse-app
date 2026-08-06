import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// First test runner in this repo (npm run lint / npm run build were
// previously the only checks) -- introduced alongside DM Automation,
// scoped to that feature's highest-risk, purest logic rather than an
// attempt at broad coverage. The @/ alias mirrors tsconfig.json's paths
// mapping so test files can import the same way app code does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
