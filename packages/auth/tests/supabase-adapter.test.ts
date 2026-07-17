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
  });

  it("verifies the OTP, links the Supabase subject through the identity store, and returns an internal user id", async () => {
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: "supabase-user-1" },
          session: { access_token: "supabase-jwt-1" },
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
    expect(result.value.sessionToken).toBe("supabase-jwt-1");

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
          session: { access_token: "supabase-jwt-2" },
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
      sessionToken: "supabase-jwt-3",
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

    const result = await provider.getCurrentUser({ sessionToken: "stale-jwt" });

    expect(result).toEqual({ ok: true, value: null });
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

    const result = await provider.getCurrentUser({ sessionToken: "some-jwt" });

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

    const result = await provider.logout({ sessionToken: "supabase-jwt-1" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it("treats a SQL-injection-shaped Supabase user id as an exact opaque subject", async () => {
    const maliciousId = "1' OR '1'='1";
    const client = createFakeSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: maliciousId },
          session: { access_token: "supabase-jwt-injection" },
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
