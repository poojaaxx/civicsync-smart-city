import { expect, it } from "vitest";
import { monthlyActivity } from "./metrics";
import { seedDatabase } from "./seed";
it("includes intervening months and correctly crosses year boundaries", () => {
  const p = seedDatabase().projects[0];
  expect(
    monthlyActivity([{ ...p, start: "2026-11-30", end: "2027-02-01" }]),
  ).toEqual([
    { month: "2026-11", projects: 1 },
    { month: "2026-12", projects: 1 },
    { month: "2027-01", projects: 1 },
    { month: "2027-02", projects: 1 },
  ]);
  expect(monthlyActivity([])).toEqual([]);
  expect(monthlyActivity([{ ...p, start: "2026-02-30" }])).toEqual([]);
});
