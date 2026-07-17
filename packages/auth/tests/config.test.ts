import { describe, expect, it } from "vitest";

import { loadAuthConfig } from "../src/config";

describe("loadAuthConfig", () => {
  it("selects the deterministic mock adapter only when explicitly configured", () => {
    const config = loadAuthConfig({ AUTH_PROVIDER: "mock" });

    expect(config).toEqual({ provider: "mock" });
  });

  it("fails closed when AUTH_PROVIDER is omitted", () => {
    expect(() => loadAuthConfig({})).toThrow(/AUTH_PROVIDER/);
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

  it.each(["self_hosted", "mixt_hosted"])(
    "rejects deterministic mock auth in %s mode",
    (deploymentMode) => {
      expect(() =>
        loadAuthConfig({
          AUTH_PROVIDER: "mock",
          DEPLOYMENT_MODE: deploymentMode,
        }),
      ).toThrow(/mock.*development/i);
    },
  );

  it("does not silently default to mock auth in hosted mode", () => {
    expect(() => loadAuthConfig({ DEPLOYMENT_MODE: "mixt_hosted" })).toThrow(
      /AUTH_PROVIDER/,
    );
  });

  it.each([
    ["NODE_ENV", "production"],
    ["VERCEL_ENV", "production"],
  ])("rejects mock auth when %s=%s", (name, value) => {
    expect(() =>
      loadAuthConfig({
        AUTH_PROVIDER: "mock",
        DEPLOYMENT_MODE: "development",
        [name]: value,
      }),
    ).toThrow(/mock.*production/i);
  });

  it.each(["javascript:alert(1)", "ftp://example.supabase.co"])(
    "rejects unsupported Supabase URL %s",
    (supabaseUrl) => {
      expect(() =>
        loadAuthConfig({
          AUTH_PROVIDER: "supabase_phone",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-placeholder-key",
          NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        }),
      ).toThrow(/HTTP/i);
    },
  );
});
