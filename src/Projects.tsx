import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, ArrowLeft, Pencil, MapPin, Trash2 } from "lucide-react";
import { useStore } from "./store";
import { statuses, types, type Project } from "./model";
import { detectConflicts, validateProject } from "./engine";
import { CityMap } from "./CityMap";
import {
  Badge,
  PageHeading,
  ProjectTable,
  Progress,
  useFilters,
  Empty,
} from "./ui";
export function Projects({ map = false }: { map?: boolean }) {
  const { data, role } = useStore();
  const { filtered, filters } = useFilters(data.projects);
  return (
    <>
      <PageHeading
        eyebrow={map ? "GEOSPATIAL VIEW" : "CITY WORKS REGISTER"}
        title={map ? "One city. One map." : "Projects, with a purpose."}
        description="Explore public works and the people accountable for them. Sample projects are explicitly labeled."
        action={
          role !== "Citizen" && (
            <Link className="button" to="/projects/new">
              <Plus size={17} />
              New project
            </Link>
          )
        }
      />
      {filters}
      {map && (
        <section className="card large-map">
          <CityMap
            projects={filtered}
            conflicted={detectConflicts(
              data.projects,
              data.roads,
              data.windowDays,
            ).flatMap((c) => c.projectIds)}
          />
        </section>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>{filtered.length} projects</h2>
          <small>Coimbatore project register</small>
        </div>
        <ProjectTable projects={filtered} />
      </section>
    </>
  );
}
export function ProjectDetail() {
  const { id } = useParams();
  const { data, role, commit, isDemo, department, saving } = useStore();
  const navigate = useNavigate();
  const p = data.projects.find((x) => x.id === id);
  if (!p)
    return (
      <Empty>
        Project not found. <Link to="/projects">Return to projects</Link>
      </Empty>
    );
  const remove = async () => {
    if (
      role === "City Administrator" &&
      window.confirm(
        `Delete ${p.name}? This removes its timeline. Citizen reports will retain their references.`,
      ) &&
      (await commit({
        ...data,
        projects: data.projects.filter((x) => x.id !== p.id),
      }))
    )
      navigate("/projects");
  };
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={16} />
        All projects
      </Link>
      <PageHeading
        eyebrow={`${p.id} / ${p.isIllustrative ? "ILLUSTRATIVE PROJECT" : "PROJECT RECORD"}`}
        title={p.name}
        description={p.roadName}
        action={
          role !== "Citizen" &&
          (isDemo ||
            role === "City Administrator" ||
            department === p.department) && (
            <Link className="button" to={`/projects/${p.id}/edit`}>
              <Pencil size={16} />
              Edit project
            </Link>
          )
        }
      />
      <div className="detail-grid">
        <section className="card detail-card">
          <div className="actions">
            <Badge>{p.status}</Badge>
            <span className="muted">{p.type}</span>
          </div>
          <p>{p.description}</p>
          <Progress value={p.progress} />
          <dl>
            {Object.entries({
              Department: p.department,
              Contractor: p.contractor,
              "Responsible authority": p.authority,
              "Start date": p.start,
              "Expected completion": p.end,
              Excavation: p.excavation ? "Yes" : "No",
              Coordinates: `${p.lat ?? "Missing"}, ${p.lng ?? "Missing"}`,
              "Road segment": p.roadId || "Unverified",
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {p.delayReason && (
            <div className="notice warning">
              <strong>Delay explanation</strong>
              <p>{p.delayReason}</p>
            </div>
          )}
          <p>
            <strong>Latest update</strong>
            <br />
            {p.updates.at(-1)?.description || "No updates recorded."}
          </p>
          {role === "City Administrator" && (
            <button
              className="button danger"
              disabled={saving}
              onClick={remove}
            >
              <Trash2 size={16} />
              Delete project
            </button>
          )}
        </section>
        <section className="card">
          <CityMap projects={[p]} />
          <div className="card-heading">
            <h2>Public transparency timeline</h2>
          </div>
          <ol className="timeline">
            {[...p.updates]
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((u) => (
                <li key={u.id}>
                  <time>{new Date(u.at).toLocaleString()}</time>
                  <strong>{u.description}</strong>
                  <small>{u.department}</small>
                </li>
              ))}
          </ol>
        </section>
      </div>
    </>
  );
}
export function ProjectForm() {
  const { id } = useParams();
  const { data, role, commit, isDemo, department, saving } = useStore();
  const roads = data.roads,
    departments = data.departments.map((d) => d.name);
  const navigate = useNavigate();
  const existing = data.projects.find((p) => p.id === id);
  const [project, setProject] = useState<Project>(() =>
    existing
      ? { ...existing }
      : {
          id: `CS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          name: "",
          department:
            !isDemo && role === "Department Officer"
              ? department || departments[0] || ""
              : departments[0] || "",
          contractor: "",
          authority: "",
          description: "",
          roadId: roads[0]?.id || "",
          roadName: roads[0]?.name || "",
          lat: roads[0]?.coordinates[0]?.[0],
          lng: roads[0]?.coordinates[0]?.[1],
          start: isDemo ? "2026-10-15" : new Date().toISOString().slice(0, 10),
          end: isDemo ? "2026-10-18" : new Date().toISOString().slice(0, 10),
          status: "Planned",
          type: "Pipeline",
          excavation: true,
          isIllustrative: isDemo,
          progress: 0,
          delayReason: "",
          updates: [],
        },
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [update, setUpdate] = useState("");
  const change = <K extends keyof Project>(key: K, value: Project[K]) =>
    setProject((p) => ({ ...p, [key]: value }));
  if (role === "Citizen")
    return (
      <Empty>
        {isDemo
          ? "Project editing is available to demo officers and administrators. Use the demo role switcher."
          : "Only authorized department officers and administrators can edit projects."}
      </Empty>
    );
  if (id && !existing) return <Empty>Project not found.</Empty>;
  if (
    !isDemo &&
    role === "Department Officer" &&
    existing &&
    existing.department !== department
  )
    return (
      <Empty>You can edit only projects assigned to your department.</Empty>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const issues = validateProject(project);
    setErrors(issues);
    if (issues.length) return;
    const changes = existing
      ? [
          existing.start !== project.start || existing.end !== project.end
            ? `Schedule changed from ${existing.start}–${existing.end} to ${project.start}–${project.end}.`
            : "",
          existing.progress !== project.progress
            ? `Progress updated to ${project.progress}%.`
            : "",
          existing.status !== project.status
            ? `Status changed to ${project.status}.`
            : "",
          project.status === "Delayed"
            ? `Delay reported: ${project.delayReason}`
            : "",
          update.trim(),
        ]
          .filter(Boolean)
          .join(" ")
      : "Project announced. " + update.trim();
    const saved = {
      ...project,
      updates: [
        ...project.updates,
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          department: project.department,
          description: isDemo
            ? changes || "Project details updated."
            : update.trim(),
        },
      ],
    };
    const next = {
      ...data,
      projects: existing
        ? data.projects.map((p) => (p.id === id ? saved : p))
        : [...data.projects, saved],
    };
    if (await commit(next)) navigate(`/projects/${saved.id}`);
  };
  const preview = detectConflicts(
    [...data.projects.filter((p) => p.id !== project.id), project],
    data.roads,
    data.windowDays,
  ).filter((c) => c.projectIds.includes(project.id));
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={16} />
        All projects
      </Link>
      <PageHeading
        eyebrow="PROJECT MANAGEMENT"
        title={existing ? "Update the plan." : "Plan better public works."}
        description="The coordination engine checks your schedule as you edit."
      />
      <form onSubmit={submit} className="form-layout">
        <section className="card form-card">
          <h2>Project information</h2>
          {errors.length > 0 && (
            <div className="notice error" role="alert">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <label>
            Project name
            <input
              required
              maxLength={120}
              value={project.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              Department
              <select
                disabled={!isDemo && role === "Department Officer"}
                aria-label="Department"
                value={project.department}
                onChange={(e) => change("department", e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Work type
              <select
                aria-label="Work type"
                value={project.type}
                onChange={(e) =>
                  change("type", e.target.value as Project["type"])
                }
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Contractor
              <input
                required
                maxLength={100}
                value={project.contractor}
                onChange={(e) => change("contractor", e.target.value)}
              />
            </label>
            <label>
              Responsible authority
              <input
                required
                maxLength={100}
                value={project.authority}
                onChange={(e) => change("authority", e.target.value)}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              required
              maxLength={2000}
              value={project.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <h2>
            <MapPin size={19} /> Location & schedule
          </h2>
          <label>
            Road segment
            <select
              value={project.roadId}
              onChange={(e) => {
                const r = roads.find((r) => r.id === e.target.value);
                if (r)
                  setProject((p) => ({
                    ...p,
                    roadId: r.id,
                    roadName: r.name,
                    lat: r.coordinates[0][0],
                    lng: r.coordinates[0][1],
                  }));
                else setProject((p) => ({ ...p, roadId: "", roadName: "" }));
              }}
            >
              {roads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="">Custom location (unverified)</option>
            </select>
          </label>
          {!project.roadId && (
            <label>
              Road name
              <input
                required
                value={project.roadName}
                onChange={(e) => change("roadName", e.target.value)}
              />
            </label>
          )}
          <div className="form-row">
            <label>
              Latitude
              <input
                required
                type="number"
                step="any"
                min="-90"
                max="90"
                value={project.lat ?? ""}
                onChange={(e) =>
                  change(
                    "lat",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                step="any"
                min="-180"
                max="180"
                value={project.lng ?? ""}
                onChange={(e) =>
                  change(
                    "lng",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Start date
              <input
                required
                type="date"
                value={project.start}
                onChange={(e) => change("start", e.target.value)}
              />
            </label>
            <label>
              Expected completion
              <input
                required
                type="date"
                value={project.end}
                onChange={(e) => change("end", e.target.value)}
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={project.isIllustrative || false}
              onChange={(e) => change("isIllustrative", e.target.checked)}
            />
            Label as illustrative/sample project
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={project.excavation}
              onChange={(e) => change("excavation", e.target.checked)}
            />
            This work requires excavation
          </label>
          <div className="form-row">
            <label>
              Status
              <select
                value={project.status}
                onChange={(e) =>
                  change("status", e.target.value as Project["status"])
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Progress (%)
              <input
                required
                type="number"
                min="0"
                max="100"
                value={project.progress}
                onChange={(e) => change("progress", Number(e.target.value))}
              />
            </label>
          </div>
          {project.status === "Delayed" && (
            <label>
              Delay reason
              <textarea
                required
                maxLength={1000}
                value={project.delayReason}
                onChange={(e) => change("delayReason", e.target.value)}
              />
            </label>
          )}
          <label>
            Public timeline update (optional)
            <textarea
              maxLength={1000}
              value={update}
              onChange={(e) => setUpdate(e.target.value)}
              placeholder="Explain what changed for residents…"
            />
          </label>
          <div className="actions">
            <button className="button" disabled={saving} type="submit">
              Save project
            </button>
            <Link
              className="button secondary"
              to={existing ? `/projects/${id}` : "/projects"}
            >
              Cancel
            </Link>
          </div>
        </section>
        <aside className="card preview-panel">
          <div className="eyebrow">LIVE SCHEDULE CHECK</div>
          <h2>
            {preview.length
              ? `${preview.length} potential conflict${preview.length > 1 ? "s" : ""}`
              : "No conflicts detected"}
          </h2>
          <p>
            Checked against stored projects using a {data.windowDays}-day
            coordination window. Unsaved preview.
          </p>
          {preview.map((c) => (
            <div className="preview-conflict" key={c.id}>
              <Badge>{c.severity}</Badge>
              <h3>{c.type}</h3>
              <p>{c.explanation}</p>
              <small>{c.recommendation}</small>
            </div>
          ))}
          <p className="muted">
            Road identity comes from the stored catalog. Illustrative segments
            are sample geometry, not municipal GIS verification.
          </p>
        </aside>
      </form>
    </>
  );
}
