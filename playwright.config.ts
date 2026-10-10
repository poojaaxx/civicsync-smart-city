import { defineConfig } from "@playwright/test";
const targetUrl = process.env.CIVICSYNC_TEST_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: targetUrl || "http://127.0.0.1:5180",
    headless: true,
    channel: "msedge",
  },
  reporter: "list",
  webServer: targetUrl
    ? undefined
    : {
        command: "npm run dev -- --port 5180 --strictPort",
        url: "http://127.0.0.1:5180",
        reuseExistingServer: false,
        env: {
          VITE_SUPABASE_URL: " ",
          VITE_SUPABASE_PUBLISHABLE_KEY: " ",
          VITE_SUPABASE_ANON_KEY: " ",
        },
      },
  timeout: 60000,
});
