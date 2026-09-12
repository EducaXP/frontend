import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 12000 },
  use: {
    baseURL: "http://127.0.0.1:4185",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      channel:
        process.env.PLAYWRIGHT_CHANNEL ||
        (process.platform === "win32" ? "msedge" : undefined),
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/serve-backend.mjs",
      url: "http://127.0.0.1:4319/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run preview -- --port 4185",
      url: "http://127.0.0.1:4185",
      env: { API_PROXY_TARGET: "http://127.0.0.1:4319" },
      reuseExistingServer: false,
    },
  ],
});
