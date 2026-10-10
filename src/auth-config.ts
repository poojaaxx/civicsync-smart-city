// Shared by Vite and the browser; reject privileged keys before bundling.
export function validateAuthConfig(
  url: string | undefined,
  key: string | undefined,
): void {
  if (!url && !key) return;
  if (!url || !key)
    throw new Error(
      "Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid project URL.");
  }
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  )
    throw new Error("Supabase requires HTTPS outside localhost.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error(
      "Use a plain Supabase project URL without credentials or query parameters.",
    );
  if (key.startsWith("sb_publishable_")) return;
  // Support the legacy anon key, but never its service_role counterpart.
  try {
    const part = key.split(".")[1];
    const payload = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role === "anon") return;
  } catch {
    /* Rejected below without printing the key. */
  }
  throw new Error(
    "Only a public Supabase publishable key or legacy anon key is allowed. Secret/service-role keys must never enter the frontend.",
  );
}
