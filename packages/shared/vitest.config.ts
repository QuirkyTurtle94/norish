import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 5 defaults this to true; kept off so the upgrade changes no test.
    clearMocks: false,
    environment: "jsdom",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
