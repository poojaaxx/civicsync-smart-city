import type { Conflict, Project, RoadSegment } from "./model";
const DAY = 86400000;
export function dateValue(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const n = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
    ? n
    : NaN;
}
export function haversine(a: Project, b: Project): number | undefined {
  if (
    ![a.lat, a.lng, b.lat, b.lng].every(
      (v) => typeof v === "number" && Number.isFinite(v),
    ) ||
    Math.abs(a.lat!) > 90 ||
    Math.abs(b.lat!) > 90 ||
    Math.abs(a.lng!) > 180 ||
    Math.abs(b.lng!) > 180
  )
    return undefined;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat! - a.lat!),
    dLng = rad(b.lng! - a.lng!);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat!)) * Math.cos(rad(b.lat!)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function detectConflicts(
  projects: Project[],
  roads: RoadSegment[],
  windowDays = 7,
): Conflict[] {
  const result: Conflict[] = [];
  const window = Math.max(0, Number.isFinite(windowDays) ? windowDays : 7);
  // Database IDs are unique; defensive deduplication also protects imported/demo data.
  const seen = new Set<string>();
  const valid = projects
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .filter(
      (p) =>
        p.status !== "Completed" &&
        Number.isFinite(dateValue(p.start)) &&
        Number.isFinite(dateValue(p.end)) &&
        dateValue(p.start) <= dateValue(p.end),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < valid.length; i++)
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i],
        b = valid[j];
      if (a.id === b.id) continue;
      const distance = haversine(a, b);
      const sameSegment =
        !!a.roadId &&
        a.roadId === b.roadId &&
        roads.some((r) => r.id === a.roadId && r.verified);
      // Distinct segment IDs are authoritative. Name + proximity is only a review candidate.
      const candidate =
        !sameSegment &&
        !(a.roadId && b.roadId) &&
        !!a.roadName.trim() &&
        a.roadName.trim().toLowerCase() === b.roadName.trim().toLowerCase() &&
        distance !== undefined &&
        distance <= 150;
      if (!sameSegment && !candidate) continue;
      const gap =
        (Math.max(dateValue(a.start), dateValue(b.start)) -
          Math.min(dateValue(a.end), dateValue(b.end))) /
        DAY;
      const overlap = gap <= 0,
        repeated =
          a.excavation &&
          b.excavation &&
          a.department !== b.department &&
          gap > 0 &&
          gap <= window;
      const duplicate = a.type === b.type && gap <= window;
      if (!overlap && !repeated && !duplicate) continue;
      const type = candidate
        ? "Location review"
        : overlap
          ? a.excavation && b.excavation
            ? "Overlapping excavation"
            : "Schedule overlap"
          : repeated
            ? "Repeated excavation"
            : "Potential duplicate work";
      const severity = candidate
        ? "Low"
        : overlap &&
            a.excavation &&
            b.excavation &&
            a.department !== b.department
          ? "Critical"
          : repeated || duplicate
            ? "High"
            : "Medium";
      result.push({
        id: `CF:${a.id}:${b.id}`,
        projectIds: [a.id, b.id],
        type,
        severity,
        distance,
        evidence: sameSegment
          ? roads.find((r) => r.id === a.roadId)?.isIllustrative
            ? "Matching verified illustrative road segment"
            : "Matching verified road segment"
          : "Matching road name + distance <=150 m; segment unverified",
        explanation: `${a.name} and ${b.name} ${overlap ? "have inclusive date ranges that overlap" : `are scheduled ${gap} day(s) apart`} on ${a.roadName}.${duplicate ? " Their work types also match; review potential duplication." : ""}${candidate ? " Proximity is not proof of a shared road; verify the segment before acting." : ""}`,
        recommendation: candidate
          ? "Verify road segment assignments with the responsible officers."
          : `Agree a joint work plan before reinstatement, or move one start date to at least ${window + 1} days after the other end date.`,
      });
    }
  return result;
}
export function validateProject(p: Project): string[] {
  const errors: string[] = [];
  for (const [label, value] of Object.entries({
    Name: p.name,
    Department: p.department,
    Contractor: p.contractor,
    Authority: p.authority,
    Description: p.description,
    Road: p.roadName,
  }))
    if (!value.trim()) errors.push(`${label} is required.`);
  if (
    !Number.isFinite(dateValue(p.start)) ||
    !Number.isFinite(dateValue(p.end))
  )
    errors.push("Enter valid start and completion dates.");
  else if (dateValue(p.start) > dateValue(p.end))
    errors.push("Completion date must be on or after start date.");
  if (
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    Math.abs(p.lat!) > 90 ||
    Math.abs(p.lng!) > 180
  )
    errors.push("Valid latitude and longitude are required.");
  if (!Number.isFinite(p.progress) || p.progress < 0 || p.progress > 100)
    errors.push("Progress must be between 0 and 100.");
  if (p.status === "Completed" && p.progress !== 100)
    errors.push("Completed projects must have 100% progress.");
  if (p.status === "Delayed" && !p.delayReason.trim())
    errors.push("A delay reason is required.");
  return errors;
}
