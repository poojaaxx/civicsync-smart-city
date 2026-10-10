import { act, render, screen, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  listener: (_event: string, _session: unknown) => {
    void _event;
    void _session;
  },
  user: { id: "user-a" },
  profile: () =>
    Promise.resolve({
      data: { id: "user-a", role: "Citizen", department: null },
      error: null,
    }),
}));
vi.mock("./supabase", () => {
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-a" } } },
        error: null,
      }),
      getUser: async () => ({ data: { user: state.user }, error: null }),
      onAuthStateChange: (listener: typeof state.listener) => {
        state.listener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => state.profile() }) }),
    }),
  };
  return { supabase: client, requireClient: () => client, isConfigured: true };
});
import { AuthGate } from "./auth";
afterEach(cleanup);
it("removes the previous private workspace immediately when the session user changes", async () => {
  render(
    <AuthGate>
      <p>Private user data</p>
    </AuthGate>,
  );
  await screen.findByText("Private user data");
  state.user = { id: "user-b" };
  state.profile = () => new Promise(() => {});
  await act(async () =>
    state.listener("SIGNED_IN", { user: { id: "user-b" } }),
  );
  expect(screen.queryByText("Private user data")).not.toBeInTheDocument();
});
