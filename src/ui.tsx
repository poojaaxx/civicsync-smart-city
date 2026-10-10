import { useStore } from "./store";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import type { Project } from "./model";
import { statuses, types } from "./model";
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={`badge ${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-group">
      <div className="progress">
        <span style={{ width: `${value}%` }} />
      </div>
      <small>{value}%</small>
    </div>
  );
}
export function ProjectTable({ projects }: { projects: Project[] }) {
  return projects.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Project / location</th>
            <th>Department</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Completion</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="project-title" to={`/projects/${p.id}`}>
                  {p.name}
                </Link>
                <small>
                  {p.roadName}
                  {p.isIllustrative ? " - Illustrative" : ""}
                </small>
              </td>
              <td>{p.department}</td>
              <td>
                <Badge>{p.status}</Badge>
              </td>
              <td>
                <Progress value={p.progress} />
              </td>
              <td>{p.end}</td>
              <td>
                <Link aria-label={`View ${p.name}`} to={`/projects/${p.id}`}>
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No projects match these filters.</Empty>
  );
}
export function useFilters(projects: Project[]) {
  const { data } = useStore();
  const departments = data.departments.map((d) => d.name);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [department, setDepartment] = useState(""),
    [type, setType] = useState(""),
    [date, setDate] = useState("");
  const filtered = projects.filter(
    (p) =>
      `${p.name} ${p.roadName} ${p.id}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || p.status === status) &&
      (!department || p.department === department) &&
      (!type || p.type === type) &&
      (!date || (p.start <= date && p.end >= date)),
  );
  const filters = (
    <div className="filters">
      <label className="search">
        <Search size={17} />
        <input
          aria-label="Search projects"
          placeholder="Search projects or locations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <select
        aria-label="Filter status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        {statuses.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <select
        aria-label="Filter department"
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
      >
        <option value="">All departments</option>
        {departments.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <select
        aria-label="Filter project type"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">All work types</option>
        {types.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <label className="date-filter">
        Active on
        <input
          aria-label="Active on date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button
        className="text-button"
        onClick={() => {
          setSearch("");
          setStatus("");
          setDepartment("");
          setType("");
          setDate("");
        }}
      >
        Clear
      </button>
    </div>
  );
  return { filtered, filters };
}
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
