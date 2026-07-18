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
      admin: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
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
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
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

  it("signs out only the session identified by the supplied access token", async () => {
    const client = createSessionClient();
    const provider = createSupabaseAuthProvider({
      client: client as unknown as SupabaseAuthClient,
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.logout({
      accessToken: "access-to-revoke",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.auth.admin.signOut).toHaveBeenCalledWith(
      "access-to-revoke",
      "local",
    );
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
      provider.logout({ accessToken: "access-a" }),
      provider.logout({ accessToken: "access-b" }),
    ]);

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(firstClient.auth.admin.signOut).toHaveBeenCalledWith(
      "access-a",
      "local",
    );
    expect(secondClient.auth.admin.signOut).toHaveBeenCalledWith(
      "access-b",
      "local",
    );
  });

  it("isolates concurrent refresh state in separate Supabase clients", async () => {
    const firstClient = createSessionClient();
    const secondClient = createSessionClient();
    const clientFactory = vi
      .fn()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const identityStore = new InMemoryAuthIdentityStore();
    await identityStore.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "supabase-session-user",
    });
    const provider = createSupabaseAuthProvider({
      clientFactory,
      identityStore,
    });

    await Promise.all([
      provider.refreshSession({ refreshToken: "refresh-a" }),
      provider.refreshSession({ refreshToken: "refresh-b" }),
    ]);

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(firstClient.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: "refresh-a",
    });
    expect(secondClient.auth.refreshSession).toHaveBeenCalledWith({
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
