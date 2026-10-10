import { test, expect } from "@playwright/test";
test("project creation, automatic conflict, schedule resolution, persistent citizen lifecycle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer view of your city." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Judge demo cable works");
  await page
    .getByLabel("Department", { exact: true })
    .selectOption("Electricity Department");
  await page
    .getByLabel("Work type", { exact: true })
    .selectOption("Underground cable");
  await page.getByLabel("Contractor", { exact: true }).fill("Demo contractor");
  await page
    .getByLabel("Responsible authority", { exact: true })
    .fill("Demo engineer");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Illustrative cable excavation for the judge walkthrough.");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-16");
  await page
    .getByLabel("Expected completion", { exact: true })
    .fill("2026-10-19");
  await expect(page.getByText("2 potential conflicts")).toBeVisible();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Judge demo cable works" }),
  ).toBeVisible();
  await page.goto("/coordination");
  await expect(page.getByRole("button", { name: "Active (5)" })).toBeVisible();
  const clash = page
    .locator(".conflict-card")
    .filter({ hasText: "Judge demo cable works" })
    .first();
  await clash
    .getByRole("textbox")
    .fill("Move cable work beyond the coordination window.");
  await clash.getByRole("button", { name: "Mark manually resolved" }).click();
  await expect(
    clash.getByText("Manually resolved · still detected"),
  ).toBeVisible();
  await page.goto("/projects");
  await page
    .getByRole("link", { name: "Judge demo cable works", exact: true })
    .click();
  await page.getByRole("link", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-15");
  await page
    .getByLabel("Expected completion", { exact: true })
    .fill("2026-11-19");
  await expect(
    page.getByRole("heading", { name: "No conflicts detected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.goto("/coordination");
  await expect(page.getByRole("button", { name: "Active (3)" })).toBeVisible();
  await page.getByRole("button", { name: "Cleared (2)" }).click();
  await expect(page.getByText("No longer detected").first()).toBeVisible();
  await page.goto("/citizen");
  await page.getByLabel("Demo role").selectOption("Citizen");
  await page
    .getByRole("button", { name: "Report an issue", exact: true })
    .click();
  await page.getByLabel("Location", { exact: true }).fill("Avinashi Road");
  await page
    .getByLabel("What is the issue?")
    .fill("The trench needs barriers near the pedestrian crossing.");
  await page.getByRole("button", { name: "Submit demo report" }).click();
  const message = await page.getByRole("status").textContent();
  const id = message!.match(/REP-[A-Z0-9]{8}/)![0];
  await page.getByLabel("Demo role").selectOption("City Administrator");
  await page.goto("/reports");
  const report = page.locator(".report-card").filter({ hasText: id });
  for (const status of ["Under Review", "In Progress", "Resolved"])
    await report.getByRole("combobox").selectOption(status);
  await page.reload();
  await expect(report.getByRole("combobox")).toHaveValue("Resolved");
  await page.getByLabel("Demo role").selectOption("Citizen");
  await page.goto("/citizen");
  await page
    .getByRole("button", { name: "Track a report", exact: true })
    .click();
  await page.getByLabel("Report reference").fill(id);
  await page.getByRole("button", { name: "Track report", exact: true }).click();
  await expect(page.locator(".report-card .badge")).toHaveText("Resolved");
  expect(errors).toEqual([]);
});
test("map tiles, route refresh and responsive layouts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/map");
  await page.getByLabel("Filter status").selectOption("Completed");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "One city. One map." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer view of your city." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Citizen portal", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your neighbourhood. Your right to know.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/citizen-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("validation, demo permissions, photo persistence, and confirmed deletion", async ({
  page,
}) => {
  await page.goto("/projects/CS-001/edit");
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-30");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Completion date must be on or after start date.",
  );
  await page.getByLabel("Demo role").selectOption("Citizen");
  await expect(
    page.getByText("Project editing is available to demo officers"),
  ).toBeVisible();
  await page.getByLabel("Demo role").selectOption("Department Officer");
  await page.goto("/projects/CS-001");
  await page.getByLabel("Demo role").selectOption("Department Officer");
  await expect(
    page.getByRole("button", { name: "Delete project" }),
  ).toHaveCount(0);
  await page.getByLabel("Demo role").selectOption("City Administrator");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(
    page.getByRole("heading", { name: "Avinashi water main renewal" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(
    page.getByRole("link", {
      name: "Avinashi water main renewal",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/citizen");
  await page
    .getByRole("button", { name: "Report an issue", exact: true })
    .click();
  await page.getByLabel("Location", { exact: true }).fill("D.B. Road");
  await page
    .getByLabel("What is the issue?")
    .fill("A pothole beside the bus stop needs repair.");
  await page.locator("input[type=file]").setInputFiles({
    name: "report.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByAltText("Selected report attachment preview"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit demo report" }).click();
  await expect(page.getByRole("status")).toContainText("Report saved");
  await page.goto("/reports");
  await expect(
    page.getByAltText("Photograph attached to the infrastructure report"),
  ).toBeVisible();
});

test("tile network failure retains usable project map and list", async ({
  page,
}) => {
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/map");
  await expect(page.getByRole("status")).toContainText("Map tiles unavailable");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page
    .getByRole("link", { name: "Avinashi water main renewal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Avinashi water main renewal" }),
  ).toBeVisible();
});
