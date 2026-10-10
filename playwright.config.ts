import { defineConfig } from "@playwright/test";
const targetUrl = process.env.CIVICSYNC_TEST_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: targetUrl || "http://127.0.0.1:5173",
    headless: true,
    channel: "msedge",
  },
  reporter: "list",
  webServer: targetUrl
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
  timeout: 60000,
});
