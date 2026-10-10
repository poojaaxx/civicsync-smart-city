import { describe, it, expect } from "vitest";
import { validateAuthConfig } from "./auth-config";
describe("frontend auth configuration guard", () => {
  it("allows no configuration for explicit local demo", () =>
    expect(() => validateAuthConfig(undefined, undefined)).not.toThrow());
  it("accepts a publishable key on HTTPS", () =>
    expect(() =>
      validateAuthConfig(
        "https://example.supabase.co",
        "sb_publishable_test_fixture",
      ),
    ).not.toThrow());
  it("rejects partial configuration", () =>
    expect(() =>
      validateAuthConfig("https://example.supabase.co", undefined),
    ).toThrow("both"));
  it("rejects secret and service-role credentials without echoing them", () => {
    expect(() =>
      validateAuthConfig(
        "https://example.supabase.co",
        "sb_secret_test_fixture",
      ),
    ).toThrow("Only a public");
    const key = `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(() =>
      validateAuthConfig("https://example.supabase.co", key),
    ).toThrow("Only a public");
  });
  it("rejects insecure and credential-bearing URLs", () => {
    expect(() =>
      validateAuthConfig("http://remote.example", "sb_publishable_test"),
    ).toThrow("HTTPS");
    expect(() =>
      validateAuthConfig(
        "https://user:password@example.test",
        "sb_publishable_test",
      ),
    ).toThrow("plain");
  });
});
