import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    include: [
      "tests/**/*.test.js",
    ],

    setupFiles: [
      "./tests/setup.js",
    ],

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    testTimeout: 15000,
    hookTimeout: 15000,

    reporters: ["default"],
  },
});
