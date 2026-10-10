import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  Map,
  FolderKanban,
  GitMerge,
  MessageSquare,
  Users,
  ChevronDown,
  ShieldCheck,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Provider, useStore } from "./store";
const Dashboard = lazy(() =>
  import("./Dashboard").then((module) => ({ default: module.Dashboard })),
);
import { Projects, ProjectDetail, ProjectForm } from "./Projects";
import { CoordinationCenter } from "./Coordination";
import { CitizenPortal, Reports } from "./Citizen";
import type { Role } from "./model";
import { detectConflicts } from "./engine";
import { roads } from "./seed";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>CivicSync needs a moment.</h1>
        <p>{this.state.error}</p>
        <p>Your saved data has not been reset. Try reloading first.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const navigation = [
  ["/", LayoutDashboard, "Overview"],
  ["/map", Map, "City map"],
  ["/projects", FolderKanban, "Projects"],
  ["/coordination", GitMerge, "Coordination"],
  ["/reports", MessageSquare, "Citizen reports"],
  ["/citizen", Users, "Citizen portal"],
] as const;
function Shell() {
  const { data, role, setRole, error, clearError } = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const count = detectConflicts(data.projects, roads, data.windowDays).length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Building2 size={25} />
          </span>
          <div>
            Civic<span>Sync</span>
            <small>CITY OPERATIONS PLATFORM</small>
          </div>
        </Link>
        <div className="workspace">
          <span className="city-avatar">C</span>
          <div>
            Coimbatore City<small>Tamil Nadu, India</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([path, Icon, label]) => (
            <NavLink
              key={path}
              end={path === "/"}
              to={path}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === "/coordination" && count > 0 && <b>{count}</b>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <ShieldCheck size={21} />
            <strong>One city. Shared responsibility.</strong>
            <p>
              Transparent works.
              <br />
              Connected departments.
            </p>
            <Link to="/citizen">
              Explore the public portal <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="sidebar-footer">
            <i className="live-dot" />
            Local demo storage<small>BITS AND BYTES 2026</small>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span>
              Workspace <span className="slash">/</span>{" "}
              <strong>
                {navigation.find(([p]) =>
                  p === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(p),
                )?.[2] || "Project details"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <i />
              DEMO ACCESS
            </span>
            <label className="role-select">
              <span className="sr-only">Demo role</span>
              <select
                aria-label="Demo role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {["City Administrator", "Department Officer", "Citizen"].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  ),
                )}
              </select>
            </label>
            <span className="avatar">
              {role === "Citizen"
                ? "CT"
                : role === "Department Officer"
                  ? "DO"
                  : "CA"}
            </span>
          </div>
        </header>
        <div className="demo-notice">
          Illustrative projects & demo access. Data is saved only in this
          browser; no municipal connection.
        </div>
        <main id="main" tabIndex={-1}>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button className="text-button" onClick={clearError}>
                Dismiss
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="empty" role="status">
                Loading city workspace…
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={role === "Citizen" ? <CitizenPortal /> : <Dashboard />}
              />
              <Route path="/map" element={<Projects map />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<ProjectForm />} />
              <Route path="/projects/:id/edit" element={<ProjectForm />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/coordination" element={<CoordinationCenter />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/citizen" element={<CitizenPortal />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Page not found</h1>
                    <Link to="/">Return to CivicSync</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
          <footer className="page-footer">
            <span>CivicSync · One City. One Map. Smarter Public Works.</span>
            <span>Built for a more connected city.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <Provider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
}
