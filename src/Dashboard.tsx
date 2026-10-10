import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCheck,
  FolderKanban,
  MessageSquare,
  TriangleAlert,
  Clock,
  Download,
  Plus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { useStore } from "./store";
import { detectConflicts } from "./engine";
import { CityMap, colors } from "./CityMap";
import { Badge, PageHeading, ProjectTable, download, Empty } from "./ui";
import { statuses } from "./model";
export function Dashboard() {
  const { data, role, isDemo } = useStore();
  const departments = data.departments.map((d) => d.name);
  const monthKeys = [
    ...new Set(
      data.projects.flatMap((p) => [p.start.slice(0, 7), p.end.slice(0, 7)]),
    ),
  ].sort();
  const conflicts = detectConflicts(data.projects, data.roads, data.windowDays);
  const cleared = Object.keys(data.coordination).filter(
    (id) => !conflicts.some((c) => c.id === id),
  ).length;
  const active = data.projects.filter(
    (p) => p.status === "Ongoing" || p.status === "Delayed",
  );
  const metrics = [
    ["Total projects", data.projects.length, FolderKanban, "Across the city"],
    ["Active projects", active.length, Activity, "Work in progress"],
    [
      "Delayed projects",
      data.projects.filter((p) => p.status === "Delayed").length,
      Clock,
      "Require attention",
    ],
    [
      "Detected conflicts",
      conflicts.length,
      TriangleAlert,
      "Live scheduling checks",
    ],
    ["Resolved conflicts", cleared, CheckCheck, "No longer detected"],
    [
      "Citizen reports",
      data.complaints.length,
      MessageSquare,
      "Community feedback",
    ],
  ] as const;
  const activity = data.projects
    .flatMap((p) => p.updates.map((u) => ({ ...u, project: p })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="CITY OPERATIONS / OVERVIEW"
        title="A clearer view of your city."
        description="Every project. Every department. Working better together."
        action={
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => download("civicsync-report.json", data)}
            >
              <Download size={16} />
              Export data
            </button>
            {role !== "Citizen" && (
              <Link className="button" to="/projects/new">
                <Plus size={17} />
                New project
              </Link>
            )}
          </div>
        }
      />
      <div className="city-strip">
        <span>
          <i className="live-dot" />
          Coimbatore, Tamil Nadu
        </span>
        <span>
          {isDemo ? "Illustrative local demo" : "Shared Supabase portfolio"} -{" "}
          {data.projects.filter((p) => p.isIllustrative).length} sample projects
        </span>
      </div>
      <div className="kpi-grid">
        {metrics.map(([label, value, Icon, sub]) => (
          <div className="kpi" key={label}>
            <div className="kpi-top">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>City works, in one view</h2>
              <p>Explore the work shaping our neighbourhoods</p>
            </div>
            <Link to="/map">
              Explore map <ArrowRight size={15} />
            </Link>
          </div>
          <CityMap
            projects={data.projects}
            conflicted={conflicts.flatMap((c) => c.projectIds)}
          />
        </section>
        <section className="card attention">
          <div className="card-heading">
            <div>
              <div className="eyebrow orange">COORDINATION INTELLIGENCE</div>
              <h2>
                A little planning.
                <br />
                Less disruption.
              </h2>
            </div>
            <TriangleAlert size={25} />
          </div>
          <p>
            {conflicts.length} potential clashes identified from the current
            project schedules.
          </p>
          {conflicts.slice(0, 3).map((c) => (
            <Link to="/coordination" className="alert-preview" key={c.id}>
              <div>
                <Badge>{c.severity}</Badge>
                <span>{c.type}</span>
              </div>
              <strong>
                {data.projects.find((p) => p.id === c.projectIds[0])?.roadName}
              </strong>
              <small>
                2 projects · Review recommendation <ArrowRight size={13} />
              </small>
            </Link>
          ))}
          {!conflicts.length && (
            <Empty>No scheduling conflicts detected.</Empty>
          )}
          <Link className="button dark full" to="/coordination">
            Open Coordination Center <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="chart-grid">
        <section className="card">
          <div className="card-heading">
            <h2>Projects by department</h2>
            <span className="muted">Portfolio</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={departments.map((d) => ({
                name: d
                  .replace(" Department", "")
                  .replace("Municipal Corporation", "Municipal")
                  .replace("Roads & Highways", "Roads"),
                projects: data.projects.filter((p) => p.department === d)
                  .length,
              }))}
              margin={{ left: -25, right: 15 }}
            >
              <CartesianGrid vertical={false} stroke="#edf0f4" />
              <XAxis
                dataKey="name"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                dataKey="projects"
                fill="#377fea"
                radius={[5, 5, 0, 0]}
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>Project status</h2>
          </div>
          <div className="donut-layout">
            <ResponsiveContainer width="52%" height={205}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={statuses.map((s) => ({
                    name: s,
                    value: data.projects.filter((p) => p.status === s).length,
                  }))}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  {statuses.map((s) => (
                    <Cell key={s} fill={colors[s]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div>
              {statuses.map((s) => (
                <div className="legend-row" key={s}>
                  <i style={{ background: colors[s] }} />
                  {s}
                  <b>{data.projects.filter((p) => p.status === s).length}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Projects needing attention</h2>
            <p>Delays and coordination risks across departments</p>
          </div>
          <Link to="/projects">
            All projects <ArrowRight size={15} />
          </Link>
        </div>
        <ProjectTable
          projects={data.projects.filter(
            (p) =>
              p.status === "Delayed" ||
              conflicts.some((c) => c.projectIds.includes(p.id)),
          )}
        />
      </section>
      <div className="chart-grid bottom-grid">
        <section className="card">
          <div className="card-heading">
            <h2>Monthly project activity</h2>
            <small>Scheduled activity by start/end month</small>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart
              data={monthKeys.map((month) => {
                return {
                  month,
                  projects: data.projects.filter(
                    (p) => p.start <= `${month}-31` && p.end >= `${month}-01`,
                  ).length,
                };
              })}
              margin={{ left: -25, right: 25 }}
            >
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area
                isAnimationActive={false}
                dataKey="projects"
                stroke="#18a58e"
                fill="#dff4ef"
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>Conflict severity</h2>
          </div>
          <div className="severity-grid">
            {["Critical", "High", "Medium", "Low"].map((s) => (
              <div key={s}>
                <Badge>{s}</Badge>
                <strong>
                  {conflicts.filter((c) => c.severity === s).length}
                </strong>
              </div>
            ))}
          </div>
          <div className="card-heading">
            <h2>Upcoming construction</h2>
          </div>
          {data.projects
            .filter(
              (p) =>
                p.status === "Planned" &&
                p.start >= new Date().toISOString().slice(0, 10),
            )
            .sort((a, b) => a.start.localeCompare(b.start))
            .slice(0, 3)
            .map((p) => (
              <Link className="list-line" key={p.id} to={`/projects/${p.id}`}>
                <span>{p.name}</span>
                <small>{p.start}</small>
              </Link>
            ))}
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>Recent activity</h2>
          <small>Recorded project updates</small>
        </div>
        <div className="activity-grid">
          {activity.map((u) => (
            <Link
              to={`/projects/${u.project.id}`}
              className="activity-item"
              key={u.id}
            >
              <span className="activity-dot" />
              <div>
                <strong>{u.project.name}</strong>
                <p>{u.description}</p>
                <small>
                  {new Date(u.at).toLocaleString()} · {u.department}
                </small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
