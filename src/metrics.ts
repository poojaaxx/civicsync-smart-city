import type { Project } from "./model";
import { dateValue } from "./engine";
export function monthlyActivity(projects: Project[]) {
  const valid = projects.filter(
    (p) =>
      Number.isFinite(dateValue(p.start)) &&
      Number.isFinite(dateValue(p.end)) &&
      p.start <= p.end,
  );
  if (!valid.length) return [];
  const monthIndex = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const first = Math.min(...valid.map((p) => monthIndex(p.start))),
    last = Math.max(...valid.map((p) => monthIndex(p.end)));
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const index = first + offset;
    const month =
      String(Math.floor(index / 12)).padStart(4, "0") +
      "-" +
      String((index % 12) + 1).padStart(2, "0");
    return {
      month,
      projects: valid.filter(
        (p) => monthIndex(p.start) <= index && monthIndex(p.end) >= index,
      ).length,
    };
  });
}
