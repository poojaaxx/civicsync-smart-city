import { describe, it, expect } from "vitest";
import {
  dateValue,
  detectConflicts,
  haversine,
  validateProject,
} from "./engine";
import { roads, seedDatabase } from "./seed";
const base = seedDatabase().projects[0];
const other = {
  ...base,
  id: "second",
  department: "Electricity Department",
  type: "Underground cable" as const,
};
describe("explainable coordination engine", () => {
  it("detects exact inclusive overlap as critical across excavation departments", () => {
    const [c] = detectConflicts([base, other], roads);
    expect(c.severity).toBe("Critical");
    expect(c.type).toBe("Overlapping excavation");
  });
  it("treats touching dates as overlap", () =>
    expect(
      detectConflicts(
        [base, { ...other, start: base.end, end: "2026-10-20" }],
        roads,
      ),
    ).toHaveLength(1));
  it("does not flag schedules beyond the coordination window", () =>
    expect(
      detectConflicts(
        [base, { ...other, start: "2026-10-26", end: "2026-10-30" }],
        roads,
      ),
    ).toHaveLength(0));
  it("does not infer the same road from nearby coordinates", () =>
    expect(
      detectConflicts(
        [base, { ...other, roadId: "other-road", roadName: "Unrelated road" }],
        roads,
      ),
    ).toHaveLength(0));
  it("does not merge distinct verified IDs even with identical names and coordinates", () =>
    expect(
      detectConflicts([base, { ...other, roadId: roads[1].id }], roads),
    ).toHaveLength(0));
  it("flags repeated excavation within seven days", () =>
    expect(
      detectConflicts(
        [base, { ...other, start: "2026-10-25", end: "2026-10-27" }],
        roads,
      )[0].type,
    ).toBe("Repeated excavation"));
  it("respects a configurable zero-day window", () =>
    expect(
      detectConflicts(
        [base, { ...other, start: "2026-10-19", end: "2026-10-20" }],
        roads,
        0,
      ),
    ).toHaveLength(0));
  it("does not compare a project with itself", () =>
    expect(detectConflicts([base, base], roads)).toHaveLength(0));
  it("skips invalid or inverted dates", () => {
    for (const start of ["invalid", "2026-02-30", "2026-11-20"])
      expect(detectConflicts([base, { ...other, start }], roads)).toHaveLength(
        0,
      );
    expect(dateValue("2026-02-30")).toBeNaN();
  });
  it("uses a verified segment without coordinates", () =>
    expect(
      detectConflicts(
        [{ ...base, lat: undefined, lng: undefined }, other],
        roads,
      ),
    ).toHaveLength(1));
  it("skips unverified locations with missing coordinates", () =>
    expect(
      detectConflicts(
        [
          { ...base, roadId: "", lat: undefined },
          { ...other, roadId: "" },
        ],
        roads,
      ),
    ).toHaveLength(0));
  it("labels road-name + proximity matches only as low-severity review", () => {
    const [c] = detectConflicts(
      [
        { ...base, roadId: "" },
        { ...other, roadId: "" },
      ],
      roads,
    );
    expect(c.severity).toBe("Low");
    expect(c.type).toBe("Location review");
  });
  it("excludes completed projects", () =>
    expect(
      detectConflicts([base, { ...other, status: "Completed" }], roads),
    ).toHaveLength(0));
  it("flags potential duplicates", () =>
    expect(
      detectConflicts(
        [base, { ...base, id: "dup", start: "2026-10-22", end: "2026-10-23" }],
        roads,
      )[0].type,
    ).toBe("Potential duplicate work"));
  it("produces stable IDs regardless of input order", () =>
    expect(detectConflicts([base, other], roads)).toEqual(
      detectConflicts([other, base], roads),
    ));
  it("calculates Haversine metres and validates coordinates", () => {
    expect(
      haversine({ ...base, lat: 0, lng: 0 }, { ...other, lat: 0, lng: 1 }),
    ).toBeCloseTo(111194.9, 0);
    expect(haversine({ ...base, lat: NaN }, other)).toBeUndefined();
  });
  it("validates required fields, completion progress and delay reasons", () => {
    expect(validateProject(base)).toEqual([]);
    expect(validateProject({ ...base, status: "Completed" })).toContain(
      "Completed projects must have 100% progress.",
    );
    expect(
      validateProject({ ...base, status: "Delayed", delayReason: "" }),
    ).toContain("A delay reason is required.");
    expect(validateProject({ ...base, lat: undefined })).toContain(
      "Valid latitude and longitude are required.",
    );
  });
});
