import { defineConfig, devices } from "@playwright/test";
import { envConfig } from "./src/config/env.config.js";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["junit", { outputFile: "reports/junit.xml" }],
    ["allure-playwright", { outputFolder: "allure-results" }],
  ],

  use: {
    baseURL: envConfig.apiUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      fullyParallel: false,
      workers: 1,
      use: {
        baseURL: envConfig.apiUrl,
      },
    },
    {
      name: "web-chromium",
      testDir: "./tests/web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: envConfig.webUrl,
      },
    },
    {
      name: "web-firefox",
      testDir: "./tests/web",
      use: {
        ...devices["Desktop Firefox"],
        baseURL: envConfig.webUrl,
      },
    },
    {
      name: "mobile-chrome",
      testDir: "./tests/web",
      use: {
        ...devices["Pixel 7"],
        baseURL: envConfig.webUrl,
      },
    },
    {
      name: "mobile-native",
      testDir: "./tests/mobile",
    },
  ],
});

