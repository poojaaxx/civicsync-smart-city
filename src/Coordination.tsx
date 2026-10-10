import { useState } from "react";
import { Link } from "react-router-dom";
import { GitMerge, ArrowRight, CheckCircle2 } from "lucide-react";
import { useStore } from "./store";
import { detectConflicts } from "./engine";
import { Badge, Empty, PageHeading } from "./ui";
import type { Conflict, Coordination } from "./model";
function ConflictCard({
  conflict,
  cleared = false,
}: {
  conflict: Conflict;
  cleared?: boolean;
}) {
  const { data, role, commit, isDemo, department, saving } = useStore();
  const [note, setNote] = useState("");
  const record = data.coordination[conflict.id];
  const projects = conflict.projectIds.map((id) =>
    data.projects.find((p) => p.id === id),
  );
  const write = async (status: Coordination["status"]) => {
    if (role === "Citizen") return;
    const next: Coordination = {
      id: conflict.id,
      conflict,
      status,
      notes: [
        ...(record?.notes || []),
        ...(note.trim()
          ? [{ text: note.trim(), at: new Date().toISOString(), author: role }]
          : []),
      ],
    };
    if (
      await commit({
        ...data,
        coordination: { ...data.coordination, [conflict.id]: next },
      })
    )
      setNote("");
  };
  return (
    <article className={`card conflict-card ${cleared ? "cleared" : ""}`}>
      <div className="conflict-top">
        <div className="actions">
          <Badge>{cleared ? "Cleared" : conflict.severity}</Badge>
          <span className="muted">{conflict.type}</span>
        </div>
        <small>
          {record?.status === "Acknowledged" && !cleared
            ? "Manually resolved · still detected"
            : cleared
              ? "No longer detected"
              : record?.status || "Needs review"}
        </small>
      </div>
      <h2>{projects.find(Boolean)?.roadName || "Archived road conflict"}</h2>
      <div className="schedule-pair">
        {projects.map((p, i) => (
          <div key={conflict.projectIds[i]}>
            <span className="eyebrow">
              {p?.department || "Deleted project"}
            </span>
            <strong>{p?.name || conflict.projectIds[i]}</strong>
            <span>
              {p?.start} <ArrowRight size={13} /> {p?.end}
            </span>
            {p && role !== "Citizen" && (
              <Link to={`/projects/${p.id}/edit`}>Adjust schedule →</Link>
            )}
          </div>
        ))}
      </div>
      <div className="explanation">
        <GitMerge size={19} />
        <div>
          <strong>Why this was flagged</strong>
          <p>{conflict.explanation}</p>
          <small>
            Evidence: {conflict.evidence}
            {conflict.distance !== undefined
              ? ` · ${Math.round(conflict.distance)} m between project points`
              : ""}
          </small>
        </div>
      </div>
      <p className="recommendation">
        <strong>Recommended action</strong>
        <br />
        {conflict.recommendation}
      </p>
      {cleared && (
        <div className="notice success">
          <CheckCircle2 size={17} />
          This pair no longer meets the current rules. Review schedule,
          completion, deletion, and rule changes in the project history.
        </div>
      )}
      {record?.notes.map((n, i) => (
        <div className="coord-note" key={i}>
          <p>{n.text}</p>
          <small>
            {n.author} · {new Date(n.at).toLocaleString()}
          </small>
        </div>
      ))}
      {!cleared &&
        role !== "Citizen" &&
        (isDemo ||
          role === "City Administrator" ||
          projects.some((p) => p?.department === department)) && (
          <div className="coord-actions">
            <label>
              Coordination note
              <textarea
                aria-label={`Coordination note for ${conflict.id}`}
                maxLength={1500}
                value={note}
                onChange={async (e) => setNote(e.target.value)}
                placeholder="Record the agreed next step…"
              />
            </label>
            <div className="actions">
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => write("Under review")}
              >
                Mark under review / save note
              </button>
              <button
                className="button secondary"
                onClick={() => write("Acknowledged")}
              >
                Mark manually resolved
              </button>
            </div>
            <small>
              Manual resolution acknowledges the alert. Only a rule
              recalculation can clear it.
            </small>
          </div>
        )}
    </article>
  );
}
export function CoordinationCenter() {
  const { data, role, commit, isDemo, saving } = useStore();
  const [tab, setTab] = useState("Active");
  const conflicts = detectConflicts(data.projects, data.roads, data.windowDays);
  const cleared = Object.values(data.coordination).filter(
    (r) => !conflicts.some((c) => c.id === r.id),
  );
  return (
    <>
      <PageHeading
        eyebrow="CROSS-DEPARTMENT PLANNING"
        title="Coordinate once. Build better."
        description="Explainable checks that turn overlapping plans into shared action."
      />
      <div className="coord-banner">
        <div className="coord-banner-icon">
          <GitMerge size={30} />
        </div>
        <div>
          <h2>Better coordination starts before the first excavation.</h2>
          <p>
            Verified road segments + inclusive schedules + a configurable
            coordination window.
          </p>
        </div>
        <label>
          Coordination window
          <select
            aria-label="Coordination window"
            disabled={
              saving ||
              role === "Citizen" ||
              (!isDemo && role !== "City Administrator")
            }
            value={data.windowDays}
            onChange={(e) =>
              commit({ ...data, windowDays: Number(e.target.value) })
            }
          >
            {[0, 3, 7, 14, 30].map((n) => (
              <option value={n} key={n}>
                {n} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tabs">
        {["Active", "Cleared", "Methodology"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Active"
              ? ` (${conflicts.length})`
              : t === "Cleared"
                ? ` (${cleared.length})`
                : ""}
          </button>
        ))}
      </div>
      {tab === "Active" &&
        (conflicts.length ? (
          conflicts.map((c) => <ConflictCard key={c.id} conflict={c} />)
        ) : (
          <Empty>
            No active coordination conflicts. All current schedules pass the
            configured checks.
          </Empty>
        ))}
      {tab === "Cleared" &&
        (cleared.length ? (
          cleared.map((r) => (
            <ConflictCard key={r.id} conflict={r.conflict} cleared />
          ))
        ) : (
          <Empty>
            No previously recorded alerts have cleared yet. Change a conflicting
            schedule to see recalculation here.
          </Empty>
        ))}
      {tab === "Methodology" && (
        <section className="card prose">
          <h2>Deterministic, explainable, and connected to real app data.</h2>
          <p>
            Every project save runs a pairwise comparison. Completed projects,
            invalid date ranges, and comparisons with the same project ID are
            excluded.
          </p>
          <ol>
            <li>
              A shared verified demo road segment is the strongest evidence.
              Different segment IDs never match by proximity.
            </li>
            <li>
              Without segment IDs, matching road names and Haversine distance
              within 150 metres produce a low-severity location review, never a
              proven road clash.
            </li>
            <li>
              Inclusive date overlap with excavation by two departments is
              Critical. Repeated excavation across departments within the
              coordination window, or a matching work type, is High. Other
              verified overlaps are Medium.
            </li>
            <li>
              Potential duplicate work means matching work types within the
              window; it requires officer assessment.
            </li>
          </ol>
          <p>
            Cleared means the pair no longer meets the current rules. An
            acknowledgment alone never suppresses detection. This engine
            supports planning; it does not certify engineering feasibility.
          </p>
        </section>
      )}
    </>
  );
}
