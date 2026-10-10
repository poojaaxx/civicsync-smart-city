import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
}));
vi.mock("./supabase", () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword: mocks.signIn,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.reset,
      updateUser: mocks.update,
    },
  };
  return { isConfigured: true, supabase: client, requireClient: () => client };
});
import { AuthGate } from "./auth";
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
});
afterEach(cleanup);
async function show() {
  render(
    <AuthGate>
      <p>Private workspace</p>
    </AuthGate>,
  );
  await screen.findByRole("heading", { name: "Welcome to CivicSync." });
}
describe("configured authentication form behavior (mocked provider, not live delivery)", () => {
  it("sends passwords only to the auth service and displays rejected login errors", async () => {
    mocks.signIn.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    await show();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "citizen@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password-only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "citizen@example.test",
      password: "test-password-only",
    });
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Explore local demo")).not.toBeInTheDocument();
  });
  it("registers without any user-controlled role or department", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "A Resident" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "resident@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password-only" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create citizen account" }),
    );
    await screen.findByRole("status");
    expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({
      display_name: "A Resident",
    });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("requests a reset to the same origin with a neutral success response", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "resident@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(mocks.reset).toHaveBeenCalledWith("resident@example.test", {
        redirectTo: `${window.location.origin}/auth/reset`,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "If this email has an account",
    );
  });
});
