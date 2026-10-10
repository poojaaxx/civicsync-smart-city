import { useState, type FormEvent } from "react";
import { useStore } from "./store";
import { requireClient } from "./supabase";
export function CatalogEditor() {
  const { data, refresh } = useStore();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const submit = async (
    e: FormEvent<HTMLFormElement>,
    kind: "road" | "department",
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const record =
      kind === "department"
        ? { id: crypto.randomUUID(), name: String(fields.get("name")).trim() }
        : {
            id: crypto.randomUUID(),
            name: String(fields.get("name")).trim(),
            verified: fields.get("verified") === "on",
            isIllustrative: fields.get("illustrative") === "on",
            coordinates: [
              [Number(fields.get("lat1")), Number(fields.get("lng1"))],
              [Number(fields.get("lat2")), Number(fields.get("lng2"))],
            ],
          };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await requireClient().rpc("add_civic_catalog", {
        kind,
        record,
      });
      if (error) throw new Error(error.message);
      form.reset();
      setMessage("Catalog record saved.");
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save catalog record",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card form-card">
      <h2>Shared department & road catalog</h2>
      <p>
        {data.departments.length} departments · {data.roads.length} road
        segments stored in Supabase. Add your actual locations here; no sample
        road is required to create a project.
      </p>
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="form-row">
        <form onSubmit={(e) => void submit(e, "department")}>
          <h3>Add department</h3>
          <label>
            Department name
            <input name="name" required maxLength={100} />
          </label>
          <button className="button secondary" disabled={busy}>
            Save department
          </button>
        </form>
        <form onSubmit={(e) => void submit(e, "road")}>
          <h3>Add road segment</h3>
          <label>
            Road segment name
            <input name="name" required maxLength={200} />
          </label>
          <div className="form-row">
            <label>
              Start latitude
              <input
                name="lat1"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
              />
            </label>
            <label>
              Start longitude
              <input
                name="lng1"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              End latitude
              <input
                name="lat2"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
              />
            </label>
            <label>
              End longitude
              <input
                name="lng2"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
              />
            </label>
          </div>
          <label className="checkbox">
            <input name="verified" type="checkbox" />I have verified the
            identity of this road segment
          </label>
          <label className="checkbox">
            <input name="illustrative" type="checkbox" />
            This is illustrative/sample geometry
          </label>
          <button className="button secondary" disabled={busy}>
            Save road segment
          </button>
        </form>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Stored road</th>
              <th>Verification</th>
              <th>Provenance</th>
            </tr>
          </thead>
          <tbody>
            {data.roads.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {r.verified ? "Verified by administrator" : "Unverified"}
                </td>
                <td>{r.isIllustrative ? "Illustrative" : "User-supplied"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
