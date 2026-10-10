import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Database, Role } from "./model";
import { repository } from "./repository";
import { detectConflicts } from "./engine";
import { useIdentity } from "./auth";
import { loadCloud, saveCloud } from "./cloud";
interface Store {
  data: Database;
  role: Role;
  department: string | null;
  isDemo: boolean;
  setRole: (r: Role) => void;
  commit: (next: Database) => Promise<boolean>;
  refresh: () => Promise<void>;
  saving: boolean;
  error: string;
  clearError: () => void;
}
const Context = createContext<Store | null>(null);
const empty: Database = {
  version: 1,
  departments: [],
  roads: [],
  projects: [],
  complaints: [],
  coordination: {},
  windowDays: 7,
};
export function Provider({ children }: { children: ReactNode }) {
  const { isDemo, profile } = useIdentity();
  const [data, setData] = useState(() => (isDemo ? repository.load() : empty));
  const [demoRole, setRole] = useState<Role>("City Administrator");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(!isDemo),
    [saving, setSaving] = useState(false);
  const busy = useRef(false),
    mounted = useRef(true);
  const role = isDemo ? demoRole : profile?.role || "Citizen",
    department = profile?.department || null;
  const refresh = async () => {
    if (isDemo) return;
    try {
      const loaded = await loadCloud();
      if (mounted.current) {
        setData(loaded);
        setError("");
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not load workspace");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (!isDemo) {
      loadCloud()
        .then((loaded) => {
          if (!cancelled) {
            setData(loaded);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(
              e instanceof Error ? e.message : "Could not load workspace",
            );
            setLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [isDemo, profile?.id]);
  const commit = async (next: Database) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    let written = false;
    try {
      const coordination = { ...next.coordination };
      if (isDemo || role !== "Citizen")
        for (const conflict of [
          ...detectConflicts(data.projects, data.roads, data.windowDays),
          ...detectConflicts(next.projects, next.roads, next.windowDays),
        ]) {
          if (
            !isDemo &&
            role === "Department Officer" &&
            !conflict.projectIds.some((id) =>
              [...data.projects, ...next.projects].some(
                (p) => p.id === id && p.department === department,
              ),
            )
          )
            continue;
          const prior = coordination[conflict.id];
          coordination[conflict.id] = prior
            ? { ...prior, conflict }
            : { id: conflict.id, conflict, status: "Detected", notes: [] };
        }
      const saved = { ...next, coordination };
      if (isDemo) {
        repository.save(saved);
        setData(saved);
      } else {
        await saveCloud(data, saved);
        written = true;
        const loaded = await loadCloud();
        if (mounted.current) setData(loaded);
      }
      if (mounted.current) setError("");
      return true;
    } catch (e) {
      if (mounted.current)
        setError(
          isDemo
            ? "Could not save. Browser storage may be full or disabled. Your previous data is unchanged."
            : written
              ? "Saved to the server, but refreshing failed. Refresh the workspace before making another change."
              : e instanceof Error
                ? e.message
                : "Could not save to the server. Please retry.",
        );
      return written;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  if (loading)
    return (
      <div className="auth-loading" role="status">
        Loading your shared workspace…
      </div>
    );
  return (
    <Context.Provider
      value={{
        data,
        role,
        department,
        isDemo,
        setRole: (r) => {
          if (isDemo) setRole(r);
        },
        commit,
        refresh,
        saving,
        error,
        clearError: () => setError(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Store unavailable");
  return value;
}
