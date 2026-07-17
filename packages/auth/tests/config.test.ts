import { describe, expect, it } from "vitest";

import { loadAuthConfig } from "../src/config";

describe("loadAuthConfig", () => {
  it("defaults to the deterministic mock adapter", () => {
    const config = loadAuthConfig({});

    expect(config).toEqual({ provider: "mock" });
  });

  it("selects the Supabase phone adapter with valid public config", () => {
    const config = loadAuthConfig({
      AUTH_PROVIDER: "supabase_phone",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-placeholder-key",
    });

    expect(config).toEqual({
      provider: "supabase_phone",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-placeholder-key",
    });
  });

  it("rejects the Supabase phone adapter without a configured Supabase URL", () => {
    expect(() =>
      loadAuthConfig({
        AUTH_PROVIDER: "supabase_phone",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-placeholder-key",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects the Supabase phone adapter without a configured publishable key", () => {
    expect(() =>
      loadAuthConfig({
        AUTH_PROVIDER: "supabase_phone",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("rejects a Supabase URL that is not a valid URL", () => {
    expect(() =>
      loadAuthConfig({
        AUTH_PROVIDER: "supabase_phone",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-placeholder-key",
      }),
    ).toThrow(/valid URL/);
  });

  it("rejects an unknown AUTH_PROVIDER value", () => {
    expect(() =>
      loadAuthConfig({ AUTH_PROVIDER: "unknown_provider" }),
    ).toThrow();
  });
});
