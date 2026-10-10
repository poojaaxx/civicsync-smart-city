import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Building2, LockKeyhole, ArrowRight } from "lucide-react";
import { isConfigured, requireClient, supabase } from "./supabase";
import type { Role } from "./model";
export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  department: string | null;
}
interface Identity {
  user: User | null;
  profile: Profile | null;
  isDemo: boolean;
  signOut: () => Promise<void>;
}
const Context = createContext<Identity>({
  user: null,
  profile: null,
  isDemo: true,
  signOut: async () => {},
});
export const useIdentity = () => useContext(Context);
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(!isConfigured),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState(
      window.location.pathname === "/auth/reset",
    ),
    [demo, setDemo] = useState(
      () =>
        !isConfigured &&
        sessionStorage.getItem("civicsync-demo-access") === "true",
    );
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (!next) {
        setProfile(null);
        setReady(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        setSession(data.session);
        if (!data.session) setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(
            "Unable to connect to authentication. Check your connection and reload.",
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    async function verify() {
      try {
        const client = requireClient();
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
        if (authError || !user)
          throw new Error("Your session has expired. Please sign in again.");
        const { data, error } = await client
          .from("profiles")
          .select("id,display_name,role,department")
          .eq("id", user.id)
          .single();
        if (error)
          throw new Error(
            "Your account profile could not be loaded. Check the database migration and your connection.",
          );
        if (active) {
          setProfile(data as Profile);
          setError("");
          setReady(true);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Account unavailable");
          setProfile(null);
          setReady(true);
        }
      }
    }
    void verify();
    const refresh = () => void verify();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [session]);
  const signOut = async () => {
    const { error } = await requireClient().auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    setProfile(null);
    setSession(null);
    setRecovery(false);
    setError("");
    window.history.replaceState(null, "", "/");
  };
  if (demo && !isConfigured)
    return (
      <Context.Provider
        value={{
          user: null,
          profile: null,
          isDemo: true,
          signOut: async () => {
            sessionStorage.removeItem("civicsync-demo-access");
            setDemo(false);
          },
        }}
      >
        {children}
      </Context.Provider>
    );
  if (!ready)
    return (
      <div className="auth-loading" role="status">
        Verifying your account…
      </div>
    );
  if (!session || !profile || recovery)
    return (
      <AuthScreen
        error={error}
        recovery={recovery}
        signedIn={!!session}
        onRecovered={() => {
          setRecovery(false);
          window.history.replaceState(null, "", "/");
        }}
        onDemo={() => {
          sessionStorage.setItem("civicsync-demo-access", "true");
          setDemo(true);
        }}
        onSignOut={signOut}
      />
    );
  return (
    <Context.Provider
      key={`${profile.id}:${profile.role}:${profile.department}`}
      value={{ user: session.user, profile, isDemo: false, signOut }}
    >
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
function AuthScreen({
  error: externalError,
  recovery,
  signedIn,
  onRecovered,
  onDemo,
  onSignOut,
}: {
  error: string;
  recovery: boolean;
  signedIn: boolean;
  onRecovered: () => void;
  onDemo: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const values = new FormData(e.currentTarget);
    const email = String(values.get("email") || "").trim(),
      password = String(values.get("password") || "");
    try {
      const auth = requireClient().auth;
      if (recovery) {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
        onRecovered();
      } else if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(values.get("name") || "").trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage(
          data.session
            ? "Account created. Loading your workspace…"
            : "Check your email to confirm your account. If you already have an account, sign in or reset your password.",
        );
      } else {
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage(
          "If this email has an account, a password reset link will be sent.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to complete this request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const title = recovery
    ? "Choose a new password."
    : mode === "signup"
      ? "Join your city’s workspace."
      : mode === "forgot"
        ? "Let’s get you back in."
        : "Welcome to CivicSync.";
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <Building2 size={32} />
          Civic<span>Sync</span>
        </div>
        <div>
          <div className="eyebrow">ONE CITY. SHARED RESPONSIBILITY.</div>
          <h1>
            Better public works
            <br />
            start with connection.
          </h1>
          <p>
            Follow projects. Report issues. Coordinate across departments—with
            an account that belongs to you.
          </p>
        </div>
        <span>
          <LockKeyhole size={17} />
          Account-based access · Department permissions
        </span>
      </section>
      <section className="auth-panel">
        <div className="eyebrow">YOUR CITY WORKSPACE</div>
        <h1>{title}</h1>
        <p>
          {recovery
            ? "Use at least 12 characters."
            : mode === "signup"
              ? "Create a citizen account. Officer access is assigned by an administrator."
              : "Sign in to access your projects and reports across devices."}
        </p>
        {!isConfigured && (
          <div className="notice warning">
            <strong>Connect Supabase to enable real accounts</strong>
            <p>
              The application owner must add the project URL and public
              publishable key, then apply the database migration. Account
              actions stay disabled until configuration is present.
            </p>
            <small>Setup instructions: AUTH_SETUP.md in the project.</small>
          </div>
        )}
        {(error || externalError) && (
          <div className="notice error" role="alert">
            {error || externalError}
          </div>
        )}
        {message && (
          <div className="notice success" role="status">
            {message}
          </div>
        )}
        {signedIn && !recovery ? (
          <button className="button" onClick={() => void onSignOut()}>
            Sign out and retry
          </button>
        ) : (
          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && !recovery && (
              <label>
                Full name
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            {!recovery && (
              <label>
                Email address
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </label>
            )}
            {(mode !== "forgot" || recovery) && (
              <label>
                Password
                <input
                  name="password"
                  required
                  type="password"
                  minLength={mode === "signup" || recovery ? 12 : 1}
                  maxLength={128}
                  autoComplete={
                    mode === "signup" || recovery
                      ? "new-password"
                      : "current-password"
                  }
                />
              </label>
            )}
            <button
              className="button full"
              disabled={!isConfigured || busy}
              type="submit"
            >
              {busy
                ? "Please wait…"
                : recovery
                  ? "Update password"
                  : mode === "signup"
                    ? "Create citizen account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        {!recovery && !signedIn && (
          <div className="auth-links">
            {(["login", "signup", "forgot"] as const)
              .filter((m) => m !== mode)
              .map((m) => (
                <button
                  className="text-button"
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setMessage("");
                  }}
                >
                  {m === "login"
                    ? "Back to sign in"
                    : m === "signup"
                      ? "Create an account"
                      : "Forgot password?"}
                </button>
              ))}
          </div>
        )}
        {!isConfigured && (
          <div className="auth-demo">
            <p>Want to explore while account setup is pending?</p>
            <button className="button secondary full" onClick={onDemo}>
              Explore local demo
            </button>
            <small>
              Fictional data and simulated roles. No account is created.
            </small>
          </div>
        )}
        <p className="auth-footnote">
          CivicSync is an independent project. Reports are shared within this
          platform, not automatically sent to a municipality.
        </p>
      </section>
    </main>
  );
}
