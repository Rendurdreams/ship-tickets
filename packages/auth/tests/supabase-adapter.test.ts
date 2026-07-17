import { describe, expect, it, vi } from "vitest";

import { InMemoryAuthIdentityStore } from "../src/identity-store";
import { createSupabaseAuthProvider } from "../src/adapters/supabase-adapter";
import type { SupabaseAuthClient } from "../src/adapters/supabase-adapter";

function createFakeSupabaseClient(
  overrides: Partial<SupabaseAuthClient["auth"]> = {},
): SupabaseAuthClient {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn(),
      refreshSession: vi.fn(),
      setSession: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn(),
      ...overrides,
    },
  };
}

describe("createSupabaseAuthProvider", () => {
  it("requests a phone OTP through the injected Supabase client", async () => {
    const client = createFakeSupabaseClient();
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({ phone: "+15551230000" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+15551230000",
    });
  });

  it("surfaces a typed error when Supabase refuses to send the OTP", async () => {
    const client = createFakeSupabaseClient({
      signInWithOtp: vi
        .fn()
        .mockResolvedValue({ error: { message: "rate limited" } }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({ phone: "+15551230000" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "otp_request_failed" },
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.error.message).not.toContain("rate limited");
  });

  it("normalizes E.164 phones and forwards a CAPTCHA token", async () => {
    const client = createFakeSupabaseClient();
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({
      captchaToken: "turnstile-token",
      phone: "+1 (555) 555-0000",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      options: { captchaToken: "turnstile-token" },
      phone: "+15555550000",
    });
  });

  it("rejects an invalid phone without calling Supabase", async () => {
    const client = createFakeSupabaseClient();
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({ phone: "555-0000" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_phone" },
    });
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("classifies provider rate limits without exposing provider text", async () => {
    const client = createFakeSupabaseClient({
      signInWithOtp: vi.fn().mockResolvedValue({
        error: {
          code: "over_request_rate_limit",
          message: "provider-internal rate text",
          status: 429,
        },
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({ phone: "+15555550000" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "rate_limited" },
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.error.message).not.toContain("provider-internal");
  });

  it("returns provider_error when the SDK throws", async () => {
    const client = createFakeSupabaseClient({
      signInWithOtp: vi.fn().mockRejectedValue(new Error("network details")),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.requestPhoneOtp({ phone: "+15555550000" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "provider_error" },
    });
  });

  it("verifies the OTP, links the Supabase subject through the identity store, and returns an internal user id", async () => {
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: "supabase-user-1" },
          session: {
            access_token: "supabase-jwt-1",
            expires_at: 1_900_000_000,
            refresh_token: "supabase-refresh-1",
          },
        },
        error: null,
      }),
    });
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createSupabaseAuthProvider({ client, identityStore });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "123456",
    });

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+15551230000",
      token: "123456",
      type: "sms",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toMatchObject({
      accessToken: "supabase-jwt-1",
      expiresAt: 1_900_000_000,
      refreshToken: "supabase-refresh-1",
    });

    const linked = await identityStore.findIdentity(
      "supabase_phone",
      "supabase-user-1",
    );
    expect(linked?.userId).toBe(result.value.userId);
  });

  it("resolves the same internal user id for repeat verifications of the same Supabase subject", async () => {
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: "supabase-user-2" },
          session: {
            access_token: "supabase-jwt-2",
            expires_at: 1_900_000_000,
            refresh_token: "supabase-refresh-2",
          },
        },
        error: null,
      }),
    });
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createSupabaseAuthProvider({ client, identityStore });

    const first = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "123456",
    });
    const second = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "123456",
    });

    if (!first.ok || !second.ok) throw new Error("expected success");
    expect(second.value.userId).toBe(first.value.userId);
  });

  it("returns a typed error when Supabase rejects the OTP code", async () => {
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "invalid token" },
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "000000",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_otp" } });
  });

  it("distinguishes provider OTP failures from invalid codes", async () => {
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { code: "unexpected_failure", message: "internal outage" },
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.verifyPhoneOtp({
      code: "000000",
      phone: "+15555550000",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "otp_verification_failed" },
    });
    if (result.ok) throw new Error("expected failure");
    expect(result.error.message).not.toContain("internal outage");
  });

  it("looks up the current user for a valid Supabase session token via the linked identity", async () => {
    const client = createFakeSupabaseClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "supabase-user-3" } },
        error: null,
      }),
    });
    const identityStore = new InMemoryAuthIdentityStore();
    await identityStore.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "supabase-user-3",
    });
    const provider = createSupabaseAuthProvider({ client, identityStore });

    const result = await provider.getCurrentUser({
      accessToken: "supabase-jwt-3",
    });

    expect(client.auth.getUser).toHaveBeenCalledWith("supabase-jwt-3");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value?.id).toEqual(expect.any(String));
  });

  it("returns null for the current user when Supabase reports no session", async () => {
    const client = createFakeSupabaseClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.getCurrentUser({ accessToken: "stale-jwt" });

    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null only for an explicitly invalid session", async () => {
    const client = createFakeSupabaseClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { code: "bad_jwt", message: "invalid JWT" },
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    await expect(
      provider.getCurrentUser({ accessToken: "invalid-jwt" }),
    ).resolves.toEqual({ ok: true, value: null });
  });

  it("returns provider_error when current-user lookup is unavailable", async () => {
    const client = createFakeSupabaseClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { code: "unexpected_failure", message: "database outage" },
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.getCurrentUser({ accessToken: "valid-jwt" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "provider_error" },
    });
  });

  it("returns a typed error when a Supabase session has no linked internal identity yet", async () => {
    const client = createFakeSupabaseClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "supabase-user-unlinked" } },
        error: null,
      }),
    });
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.getCurrentUser({ accessToken: "some-jwt" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "identity_not_linked" },
    });
  });

  it("logs out through the injected Supabase client", async () => {
    const client = createFakeSupabaseClient();
    const provider = createSupabaseAuthProvider({
      client,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.logout({
      accessToken: "supabase-jwt-1",
      refreshToken: "supabase-refresh-1",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: "supabase-jwt-1",
      refresh_token: "supabase-refresh-1",
    });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("treats a SQL-injection-shaped Supabase user id as an exact opaque subject", async () => {
    const maliciousId = "1' OR '1'='1";
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: maliciousId },
          session: {
            access_token: "supabase-jwt-injection",
            expires_at: 1_900_000_000,
            refresh_token: "supabase-refresh-injection",
          },
        },
        error: null,
      }),
    });
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createSupabaseAuthProvider({ client, identityStore });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "123456",
    });

    if (!result.ok) throw new Error("expected success");
    const linked = await identityStore.findIdentity(
      "supabase_phone",
      maliciousId,
    );
    expect(linked?.userId).toBe(result.value.userId);
  });
});
