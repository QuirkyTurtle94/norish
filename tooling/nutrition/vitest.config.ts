import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 5 defaults this to true; kept off so the upgrade changes no test.
    clearMocks: false,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
