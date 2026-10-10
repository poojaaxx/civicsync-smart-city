import { useState, type FormEvent } from "react";
import { useStore } from "./store";
import { useIdentity } from "./auth";
import { requireClient } from "./supabase";
import { CatalogEditor } from "./CatalogEditor";
import { type Role } from "./model";
import { PageHeading, Empty } from "./ui";
import { seedDatabase } from "./seed";
export function Accounts() {
  const { role, isDemo, data, refresh } = useStore();
  const departments = data.departments.map((d) => d.name);
  const { profile } = useIdentity();
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [assignedRole, setAssignedRole] = useState<Role>("Department Officer");
  if (isDemo)
    return (
      <Empty>
        Account management requires a configured Supabase project. Local demo
        roles do not create accounts.
      </Empty>
    );
  if (role !== "City Administrator")
    return <Empty>Administrator access is required to manage accounts.</Empty>;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const values = new FormData(e.currentTarget);
    try {
      const { error } = await requireClient().rpc("assign_civic_role", {
        account_email: String(values.get("email")),
        assigned_role: assignedRole,
        assigned_department:
          assignedRole === "Department Officer"
            ? String(values.get("department"))
            : null,
      });
      if (error) throw new Error(error.message);
      setMessage(
        "Account access updated. The user can refresh or sign in again to load their assigned role.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign access");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT ADMINISTRATION"
        title="The right access for every person."
        description="Only administrators can assign department and administrator privileges."
      />
      <section className="card form-card citizen-form">
        <h2>Assign account access</h2>
        <p>
          The person must register and confirm their email first. You cannot
          change your own access (
          {profile?.display_name || "current administrator"}).
        </p>
        {message && (
          <div role="status" className="notice success">
            {message}
          </div>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Registered email
            <input required name="email" type="email" />
          </label>
          <label>
            Assigned role
            <select
              aria-label="Assigned role"
              value={assignedRole}
              onChange={(e) => setAssignedRole(e.target.value as Role)}
            >
              {["Citizen", "Department Officer", "City Administrator"].map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          {assignedRole === "Department Officer" && (
            <label>
              Assigned department
              <select name="department">
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Saving access…" : "Assign access"}
          </button>
        </form>
      </section>
      <CatalogEditor />
      {data.projects.length === 0 && (
        <section className="card form-card citizen-form">
          <h2>Optional illustrative project portfolio</h2>
          <p>
            Your shared database starts empty. You can add your own projects, or
            import the ten clearly fictional projects for demonstrations. Sample
            complaints are not imported.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "Import ten fictional projects and their illustrative roads into this shared workspace?",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                const seed = seedDatabase();
                const { error } = await requireClient().rpc(
                  "import_civic_demo",
                  { sample_projects: seed.projects, sample_roads: seed.roads },
                );
                if (error) throw new Error(error.message);
                await refresh();
                setMessage("Illustrative portfolio imported.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Import illustrative projects
          </button>
        </section>
      )}
    </>
  );
}
