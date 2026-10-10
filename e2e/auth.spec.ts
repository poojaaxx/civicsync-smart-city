import { test, expect } from "@playwright/test";
test("real account entry is the default and unconfigured auth never pretends to work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to CivicSync." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Demo role")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create citizen account", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Explore local demo" }).click();
  await expect(page.getByLabel("Demo role")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Demo role")).toBeVisible();
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to CivicSync." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
