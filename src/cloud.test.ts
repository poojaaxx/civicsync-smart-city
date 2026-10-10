import { describe, it, expect } from "vitest";
import { changesBetween } from "./cloud";
import { seedDatabase } from "./seed";
describe("shared data mutation adapter", () => {
  it("sends only changed records with previous payloads for concurrency checks", () => {
    const before = seedDatabase(),
      after = structuredClone(before);
    after.projects[0].name = "Updated";
    const ops = changesBetween(before, after);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      kind: "projects",
      id: before.projects[0].id,
      before: before.projects[0],
      after: after.projects[0],
    });
  });
  it("does not replace other users records or infer deletions outside the visible snapshot", () => {
    const before = seedDatabase(),
      after = structuredClone(before);
    after.complaints.push({ ...before.complaints[0], id: "NEW" });
    expect(changesBetween(before, after)).toEqual([
      {
        kind: "complaints",
        id: "NEW",
        before: null,
        after: after.complaints[1],
      },
    ]);
  });
  it("represents explicit deletion and settings updates", () => {
    const before = seedDatabase(),
      after = structuredClone(before);
    after.projects.shift();
    after.windowDays = 14;
    expect(changesBetween(before, after)).toHaveLength(2);
    expect(changesBetween(before, after)[0].after).toBeNull();
  });
});
