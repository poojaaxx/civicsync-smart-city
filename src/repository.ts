import type { Database } from "./model";
import { seedDatabase } from "./seed";
export interface DataRepository {
  load(): Database;
  save(data: Database): void;
}
export const STORAGE_KEY = "civicsync-demo-v1";
// Replace this boundary with authenticated server operations before enabling a shared backend.
export class LocalRepository implements DataRepository {
  load(): Database {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDatabase();
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Array.isArray(data.projects) ||
      !Array.isArray(data.complaints) ||
      !data.coordination ||
      !Number.isFinite(data.windowDays) ||
      data.projects.some(
        (p: { updates?: unknown }) => !Array.isArray(p.updates),
      )
    )
      throw new Error(
        "Saved demo data is incompatible or damaged. Export or clear this site’s storage to start again.",
      );
    return data as Database;
  }
  save(data: Database): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
export const repository: DataRepository = new LocalRepository();
