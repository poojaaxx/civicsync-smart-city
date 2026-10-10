import { createContext, useContext, useState, type ReactNode } from "react";
import type { Database, Role } from "./model";
import { repository } from "./repository";
import { detectConflicts } from "./engine";
import { roads } from "./seed";
interface Store {
  data: Database;
  role: Role;
  setRole: (r: Role) => void;
  commit: (next: Database) => boolean;
  error: string;
  clearError: () => void;
}
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(() => repository.load());
  const [role, setRole] = useState<Role>("City Administrator");
  const [error, setError] = useState("");
  const commit = (next: Database) => {
    try {
      const coordination = { ...next.coordination };
      for (const conflict of [
        ...detectConflicts(data.projects, roads, data.windowDays),
        ...detectConflicts(next.projects, roads, next.windowDays),
      ]) {
        const prior = coordination[conflict.id];
        coordination[conflict.id] = prior
          ? { ...prior, conflict }
          : { id: conflict.id, conflict, status: "Detected", notes: [] };
      }
      const saved = { ...next, coordination };
      repository.save(saved);
      setData(saved);
      setError("");
      return true;
    } catch {
      setError(
        "Could not save. Browser storage may be full or disabled. Remove large photographs or enable storage, then retry. Your previous data is unchanged.",
      );
      return false;
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        role,
        setRole,
        commit,
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
