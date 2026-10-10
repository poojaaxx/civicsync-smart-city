import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Send, Search } from "lucide-react";
import { useStore } from "./store";
import { categories, complaintStatuses, type Complaint } from "./model";
import { Badge, Empty, PageHeading, ProjectTable, useFilters } from "./ui";
export function ReportCard({
  report,
  admin = false,
}: {
  report: Complaint;
  admin?: boolean;
}) {
  const { data, role, commit } = useStore();
  return (
    <article className="card report-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">{report.id}</span>
          <h2>{report.category}</h2>
        </div>
        <Badge>{report.status}</Badge>
      </div>
      <p>
        <MapPin size={15} />
        {report.location}
      </p>
      <p>{report.description}</p>
      {report.photo && (
        <img
          className="complaint-photo"
          src={report.photo}
          alt="Photograph attached to the infrastructure report"
        />
      )}
      {report.projectId && (
        <p>
          <Link to={`/projects/${report.projectId}`}>Linked project →</Link>
        </p>
      )}
      <div className="report-steps">
        {complaintStatuses.map((s, i) => (
          <span
            key={s}
            className={
              i <= complaintStatuses.indexOf(report.status) ? "done" : ""
            }
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div className="report-history">
        {report.updates.map((u, i) => (
          <small key={i}>
            {new Date(u.at).toLocaleString()} — {u.status}
          </small>
        ))}
      </div>
      {admin && role !== "Citizen" && (
        <label>
          Update report status
          <select
            aria-label={`Status for ${report.id}`}
            value={report.status}
            onChange={(e) => {
              const status = e.target.value as Complaint["status"];
              commit({
                ...data,
                complaints: data.complaints.map((c) =>
                  c.id === report.id
                    ? {
                        ...c,
                        status,
                        updates: [
                          ...c.updates,
                          { at: new Date().toISOString(), status },
                        ],
                      }
                    : c,
                ),
              });
            }}
          >
            {complaintStatuses.map((s, i) => (
              <option
                key={s}
                disabled={
                  i < complaintStatuses.indexOf(report.status) ||
                  i > complaintStatuses.indexOf(report.status) + 1
                }
              >
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
    </article>
  );
}
export function CitizenPortal() {
  const { data, commit } = useStore();
  const { filtered, filters } = useFilters(data.projects);
  const [tab, setTab] = useState("Explore works");
  const [reference, setReference] = useState("");
  const [lookup, setLookup] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [nearby, setNearby] = useState<[number, number] | null>(null);
  const report = data.complaints.find((c) => c.id === lookup);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    const form = new FormData(e.currentTarget);
    const description = String(form.get("description") || "").trim(),
      location = String(form.get("location") || "").trim();
    if (description.length < 10 || location.length < 3) {
      setError(
        "Please enter a location and a description of at least 10 characters.",
      );
      return;
    }
    const at = new Date().toISOString(),
      id = `REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    if (
      commit({
        ...data,
        complaints: [
          ...data.complaints,
          {
            id,
            category: String(form.get("category")),
            description,
            location,
            projectId: String(form.get("projectId")),
            photo,
            status: "Submitted",
            createdAt: at,
            updates: [{ at, status: "Submitted" }],
          },
        ],
      })
    ) {
      setSuccess(id);
      setReference(id);
      setLookup(id);
      setPhoto(undefined);
      setError("");
      e.currentTarget.reset();
    }
  };
  const nearbyProjects = nearby
    ? filtered.filter(
        (p) =>
          p.lat !== undefined &&
          p.lng !== undefined &&
          Math.hypot((p.lat - nearby[0]) * 111, (p.lng - nearby[1]) * 109) < 5,
      )
    : filtered;
  return (
    <>
      <div className="citizen-hero">
        <div className="eyebrow">CIVICSYNC / FOR RESIDENTS</div>
        <h1>
          Your neighbourhood.
          <br />
          Your right to know.
        </h1>
        <p>
          See what’s being built, understand the schedule,
          <br />
          and help make your streets better.
        </p>
        <span>
          <MapPin size={15} />
          Coimbatore · Demonstration portal
        </span>
      </div>
      <div className="notice">
        Reports stay in this browser. They are not sent to a municipality. All
        projects are fictional.
      </div>
      <div className="tabs">
        {["Explore works", "Report an issue", "Track a report"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Explore works" && (
        <>
          {filters}
          <div className="actions nearby">
            <button
              className="button secondary"
              onClick={() => {
                setError("");
                if (!navigator.geolocation) {
                  setError(
                    "Geolocation is unavailable. Search by road name instead.",
                  );
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (p) => setNearby([p.coords.latitude, p.coords.longitude]),
                  () =>
                    setError(
                      "Location unavailable or permission declined. Search by road name instead.",
                    ),
                  { timeout: 10000 },
                );
              }}
            >
              <MapPin size={16} />
              Within 5 km of me
            </button>
            {nearby && (
              <button className="text-button" onClick={() => setNearby(null)}>
                Show entire city
              </button>
            )}
            <Link to="/map">
              Open city map <ArrowRight size={14} />
            </Link>
          </div>
          <section className="card">
            <ProjectTable projects={nearbyProjects} />
          </section>
        </>
      )}
      {tab === "Report an issue" && (
        <form className="card form-card citizen-form" onSubmit={submit}>
          <h2>Tell us what needs attention</h2>
          <p className="muted">
            A small report can make a big difference. Avoid including private
            information.
          </p>
          {success && (
            <div role="status" className="notice success">
              Report saved. Your tracking reference: <strong>{success}</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setTab("Track a report")}
              >
                Track this report →
              </button>
            </div>
          )}
          <div className="form-row">
            <label>
              Category
              <select name="category">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Related project (optional)
              <select name="projectId">
                <option value="">No linked project</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Location
            <input
              name="location"
              required
              minLength={3}
              maxLength={200}
              placeholder="Road name, neighbourhood, or landmark"
            />
          </label>
          <label>
            What is the issue?
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              placeholder="Describe the issue and how it affects residents…"
            />
          </label>
          <label>
            Photograph (optional, JPEG / PNG / WebP, up to 1 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setPhoto(undefined);
                setError("");
                const f = e.target.files?.[0];
                if (!f) return;
                if (
                  f.size > 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(f.type)
                ) {
                  setError(
                    "Choose a JPEG, PNG, or WebP image of at most 1 MB.",
                  );
                  e.target.value = "";
                  return;
                }
                setLoading(true);
                const reader = new FileReader();
                reader.onload = () => {
                  setPhoto(String(reader.result));
                  setLoading(false);
                };
                reader.onerror = () => {
                  setError("Could not read the image. Please try again.");
                  setLoading(false);
                };
                reader.readAsDataURL(f);
              }}
            />
          </label>
          {photo && (
            <img
              className="complaint-photo"
              src={photo}
              alt="Selected report attachment preview"
            />
          )}
          <button className="button" disabled={loading} type="submit">
            <Send size={16} />
            {loading ? "Reading photograph…" : "Submit demo report"}
          </button>
        </form>
      )}
      {tab === "Track a report" && (
        <>
          <form
            className="tracking-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLookup(reference.trim().toUpperCase());
            }}
          >
            <label>
              Report reference
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="REP-XXXXXXXX"
              />
            </label>
            <button className="button">
              <Search size={16} />
              Track report
            </button>
          </form>
          {lookup &&
            (report ? (
              <ReportCard report={report} />
            ) : (
              <Empty>
                No report found in this browser for “{lookup}”. Check the
                reference and the browser used to submit it.
              </Empty>
            ))}
        </>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
export function Reports() {
  const { data, role } = useStore();
  const [status, setStatus] = useState("");
  if (role === "Citizen") return <CitizenPortal />;
  const reports = data.complaints.filter((c) => !status || c.status === status);
  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY FEEDBACK"
        title="Listen. Respond. Follow through."
        description="A transparent path from a resident’s report to a resolved issue."
      />
      <div className="filters">
        <label>
          Report status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All reports</option>
            {complaintStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <Link className="button secondary" to="/citizen">
          Open Citizen Portal
        </Link>
      </div>
      {reports.length ? (
        reports.map((r) => <ReportCard key={r.id} report={r} admin />)
      ) : (
        <Empty>No reports match this status.</Empty>
      )}
    </>
  );
}
