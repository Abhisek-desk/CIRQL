import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./tests/e2e",

  fullyParallel: false,

  workers: 1,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  reporter: "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});