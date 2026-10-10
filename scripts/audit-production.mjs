/* global console, process, document, innerWidth, URL */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = "https://civicsync-smart-city.vercel.app";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  failedAssets = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && r.url().startsWith(origin))
    failedAssets.push({ path: new URL(r.url()).pathname, status: r.status() });
});
const report = {
  checkedAt: new Date().toISOString(),
  routes: [],
  errors,
  failedAssets,
};
try {
  for (const path of [
    "/",
    "/projects",
    "/map",
    "/coordination",
    "/reports",
    "/accounts",
    "/auth/reset",
  ]) {
    const response = await page.goto(origin + path, {
      waitUntil: "networkidle",
    });
    const reset = path === "/auth/reset";
    const heading = page.getByRole("heading", {
      name: reset ? "Choose a new password." : "Welcome to CivicSync.",
      exact: true,
    });
    await heading.waitFor();
    report.routes.push({
      path,
      status: response.status(),
      authGateVisible: await heading.isVisible(),
    });
  }
  await page.goto(origin, { waitUntil: "networkidle" });
  report.loginEnabled = await page
    .getByRole("button", { name: "Sign in", exact: true })
    .isEnabled();
  report.demoEntryVisible =
    (await page.getByRole("button", { name: "Explore local demo" }).count()) >
    0;
  const scripts = await page
    .locator("script[src]")
    .evaluateAll((nodes) => nodes.map((n) => n.src));
  report.assets = scripts.map((s) => new URL(s).pathname);
  let bundle = "";
  for (const url of scripts)
    bundle += await (await page.request.get(url)).text();
  const backend = bundle.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0];
  const publicKey = bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
  report.publicBackendConfigured = Boolean(backend && publicKey);
  report.secretKeyPatternPresent = /sb_secret_[A-Za-z0-9_-]{20,}/.test(bundle);
  if (backend && publicKey) {
    const settings = await page.request.get(backend + "/auth/v1/settings", {
      headers: { apikey: publicKey },
    });
    report.authServiceStatus = settings.status();
    const denied = await page.request.post(
      backend + "/rest/v1/rpc/civic_snapshot",
      { headers: { apikey: publicKey }, data: {} },
    );
    report.anonymousSnapshotStatus = denied.status();
    report.anonymousSnapshotCode = (await denied.json()).code;
  }
  mkdirSync("test-results/production-audit", { recursive: true });
  await page.screenshot({
    path: "test-results/production-audit/login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  report.mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  await page.screenshot({
    path: "test-results/production-audit/login-mobile.png",
    fullPage: true,
  });
  writeFileSync(
    "test-results/production-audit/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (
    errors.length ||
    failedAssets.length ||
    report.mobileOverflow ||
    !report.loginEnabled ||
    report.demoEntryVisible ||
    report.secretKeyPatternPresent
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
