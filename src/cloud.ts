import type { Database } from "./model";
import { requireClient } from "./supabase";
export interface Operation {
  kind: "projects" | "complaints" | "coordination" | "settings";
  id: string;
  before: unknown;
  after: unknown;
}
export function changesBetween(before: Database, after: Database): Operation[] {
  const operations: Operation[] = [];
  for (const kind of ["projects", "complaints", "coordination"] as const) {
    const a =
        kind === "coordination" ? Object.values(before[kind]) : before[kind],
      b = kind === "coordination" ? Object.values(after[kind]) : after[kind];
    const previous = new Map(a.map((x) => [x.id, x])),
      next = new Map(b.map((x) => [x.id, x]));
    for (const id of new Set([...previous.keys(), ...next.keys()])) {
      const old = previous.get(id) || null,
        value = next.get(id) || null;
      if (JSON.stringify(old) !== JSON.stringify(value))
        operations.push({ kind, id, before: old, after: value });
    }
  }
  if (before.windowDays !== after.windowDays)
    operations.push({
      kind: "settings",
      id: "city",
      before: { windowDays: before.windowDays },
      after: { windowDays: after.windowDays },
    });
  return operations;
}
export async function loadCloud(): Promise<Database> {
  const { data, error } = await requireClient().rpc("civic_snapshot");
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Database setup is incomplete. Apply both CivicSync migrations in Supabase, then refresh."
        : error.message,
    );
  if (
    !data ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.departments) ||
    !Array.isArray(data.roads)
  )
    throw new Error(
      "Incompatible database schema. Apply the latest CivicSync migration.",
    );
  return data as Database;
}
export async function saveCloud(
  before: Database,
  after: Database,
): Promise<void> {
  const operations = changesBetween(before, after);
  if (!operations.length) return;
  const { error } = await requireClient().rpc("civic_commit", { operations });
  if (error) throw new Error(error.message);
}
