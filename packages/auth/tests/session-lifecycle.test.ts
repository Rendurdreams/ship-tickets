import { describe, expect, it, vi } from "vitest";

import { createSupabaseAuthProvider } from "../src/adapters/supabase-adapter";
import type {
  SupabaseAuthClient,
  SupabaseAuthProviderOptions,
} from "../src/adapters/supabase-adapter";
import {
  InMemoryAuthIdentityStore,
  type AuthIdentityStore,
} from "../src/identity-store";

function createSessionClient() {
  return {
    auth: {
      getUser: vi.fn(),
      refreshSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: "supabase-session-user" },
          session: {
            access_token: "renewed-access-token",
            expires_at: 2_000_000_000,
            refresh_token: "renewed-refresh-token",
          },
        },
        error: null,
      }),
      setSession: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          user: { id: "supabase-session-user" },
          session: {
            access_token: "initial-access-token",
            expires_at: 1_900_000_000,
            refresh_token: "initial-refresh-token",
          },
        },
        error: null,
      }),
    },
  };
}

describe("Supabase session lifecycle", () => {
  it("returns a refreshable session after OTP verification", async () => {
    const client = createSessionClient();
    const provider = createSupabaseAuthProvider({
      client: client as unknown as SupabaseAuthClient,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.verifyPhoneOtp({
      code: "123456",
      phone: "+1 (555) 555-0100",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "initial-access-token",
        expiresAt: 1_900_000_000,
        refreshToken: "initial-refresh-token",
        userId: expect.any(String),
      },
    });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+15555550100",
      token: "123456",
      type: "sms",
    });
  });

  it("binds the supplied token pair before signing out only that session", async () => {
    const client = createSessionClient();
    const provider = createSupabaseAuthProvider({
      client: client as unknown as SupabaseAuthClient,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.logout({
      accessToken: "access-to-revoke",
      refreshToken: "refresh-to-revoke",
    } as never);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-to-revoke",
      refresh_token: "refresh-to-revoke",
    });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("isolates concurrent logout state in separate Supabase clients", async () => {
    const firstClient = createSessionClient();
    const secondClient = createSessionClient();
    const clientFactory = vi
      .fn()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const options: SupabaseAuthProviderOptions = {
      client: firstClient as unknown as SupabaseAuthClient,
      clientFactory,
      identityStore: new InMemoryAuthIdentityStore(),
    };
    const provider = createSupabaseAuthProvider(options);

    await Promise.all([
      provider.logout({ accessToken: "access-a", refreshToken: "refresh-a" }),
      provider.logout({ accessToken: "access-b", refreshToken: "refresh-b" }),
    ]);

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(firstClient.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-a",
      refresh_token: "refresh-a",
    });
    expect(secondClient.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-b",
      refresh_token: "refresh-b",
    });
  });

  it("refreshes an existing session without leaking Supabase types", async () => {
    const client = createSessionClient();
    const identityStore = new InMemoryAuthIdentityStore();
    const identity = await identityStore.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "supabase-session-user",
    });
    const provider = createSupabaseAuthProvider({
      client: client as unknown as SupabaseAuthClient,
      identityStore,
    });

    const result = await provider.refreshSession({
      refreshToken: "initial-refresh-token",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: "renewed-access-token",
        expiresAt: 2_000_000_000,
        refreshToken: "renewed-refresh-token",
        userId: identity.userId,
      },
    });
    expect(client.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: "initial-refresh-token",
    });
  });

  it("recovers the identity created by a concurrent first login", async () => {
    const winner = {
      provider: "supabase_phone",
      subject: "supabase-session-user",
      userId: "internal-race-winner",
    };
    let lookups = 0;
    const identityStore: AuthIdentityStore = {
      async findIdentity() {
        lookups += 1;
        return lookups === 1 ? null : winner;
      },
      async createUserWithIdentity() {
        throw Object.assign(new Error("identity already exists"), {
          code: "identity_conflict",
        });
      },
    };
    const provider = createSupabaseAuthProvider({
      client: createSessionClient() as unknown as SupabaseAuthClient,
      identityStore,
    });

    const result = await provider.verifyPhoneOtp({
      code: "123456",
      phone: "+15555550100",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { userId: winner.userId },
    });
    expect(lookups).toBe(2);
  });
});
