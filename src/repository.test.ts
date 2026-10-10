import { beforeEach, describe, it, expect, vi } from "vitest";
import { LocalRepository, STORAGE_KEY } from "./repository";
import { seedDatabase } from "./seed";
describe("local persistence", () => {
  beforeEach(() => localStorage.clear());
  it("loads illustrative seed data on first use", () =>
    expect(new LocalRepository().load().projects).toHaveLength(10));
  it("persists edits and report status across repository instances", () => {
    const data = seedDatabase();
    data.projects[0].name = "Saved project";
    data.complaints[0].status = "Resolved";
    new LocalRepository().save(data);
    expect(new LocalRepository().load()).toEqual(data);
  });
  it("does not silently overwrite invalid saved data", () => {
    localStorage.setItem(STORAGE_KEY, '{"version":99}');
    expect(() => new LocalRepository().load()).toThrow("incompatible");
    expect(localStorage.getItem(STORAGE_KEY)).toContain("99");
  });
  it("propagates quota errors", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    expect(() => new LocalRepository().save(seedDatabase())).toThrow("Full");
    spy.mockRestore();
  });
});
