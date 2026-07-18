import { describe, expect, it } from "vitest";

import { InMemoryAuthIdentityStore } from "../src/identity-store";
import { createTestAuthProvider } from "../src/adapters/test-adapter";

describe("createTestAuthProvider", () => {
  it("requires a phone OTP to be requested before it can be verified", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "000000",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "otp_not_requested" },
    });
  });

  it("issues a deterministic, fixed OTP code with no external SMS send", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const requested = await provider.requestPhoneOtp({ phone: "+15551230000" });

    expect(requested).toEqual({ ok: true, value: undefined });
  });

  it("rejects verification with an incorrect code", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    await provider.requestPhoneOtp({ phone: "+15551230000" });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: "wrong-code",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_otp" } });
  });

  it("verifies the correct code, resolves an internal user id, and returns a session", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });
    await provider.requestPhoneOtp({ phone: "+15551230000" });

    const result = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: provider.fixedOtpCodeForTesting,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.userId).toEqual(expect.any(String));
    expect(result.value.accessToken).toEqual(expect.any(String));
    expect(result.value.refreshToken).toEqual(expect.any(String));

    const linked = await identityStore.findIdentity(
      "test_phone",
      "+15551230000",
    );
    expect(linked?.userId).toBe(result.value.userId);
  });

  it("resolves the same internal user id on repeat logins for the same phone number", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });

    await provider.requestPhoneOtp({ phone: "+15551230000" });
    const first = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: provider.fixedOtpCodeForTesting,
    });

    await provider.requestPhoneOtp({ phone: "+15551230000" });
    const second = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: provider.fixedOtpCodeForTesting,
    });

    if (!first.ok || !second.ok) throw new Error("expected success");
    expect(second.value.userId).toBe(first.value.userId);
  });

  it("rotates refresh tokens and invalidates the previous token", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });
    await provider.requestPhoneOtp({ phone: "+1 (555) 555-0000" });
    const verified = await provider.verifyPhoneOtp({
      code: provider.fixedOtpCodeForTesting,
      phone: "+15555550000",
    });
    if (!verified.ok) throw new Error("expected success");

    const refreshed = await provider.refreshSession({
      refreshToken: verified.value.refreshToken,
    });
    const replayed = await provider.refreshSession({
      refreshToken: verified.value.refreshToken,
    });

    expect(refreshed).toMatchObject({
      ok: true,
      value: { userId: verified.value.userId },
    });
    expect(replayed).toMatchObject({
      ok: false,
      error: { code: "invalid_session" },
    });
    await expect(
      identityStore.findIdentity("test_phone", "+15555550000"),
    ).resolves.toMatchObject({ userId: verified.value.userId });
  });

  it("looks up the current user for a valid session token", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });
    await provider.requestPhoneOtp({ phone: "+15551230000" });
    const verified = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: provider.fixedOtpCodeForTesting,
    });
    if (!verified.ok) throw new Error("expected success");

    const current = await provider.getCurrentUser({
      accessToken: verified.value.accessToken,
    });

    expect(current).toEqual({ ok: true, value: { id: verified.value.userId } });
  });

  it("returns null for an unknown or expired session token", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const current = await provider.getCurrentUser({
      accessToken: "not-a-real-token",
    });

    expect(current).toEqual({ ok: true, value: null });
  });

  it("invalidates the session on logout so the current user lookup returns null afterward", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });
    await provider.requestPhoneOtp({ phone: "+15551230000" });
    const verified = await provider.verifyPhoneOtp({
      phone: "+15551230000",
      code: provider.fixedOtpCodeForTesting,
    });
    if (!verified.ok) throw new Error("expected success");

    const logoutResult = await provider.logout({
      accessToken: verified.value.accessToken,
    });
    const current = await provider.getCurrentUser({
      accessToken: verified.value.accessToken,
    });

    expect(logoutResult).toEqual({ ok: true, value: undefined });
    expect(current).toEqual({ ok: true, value: null });
  });

  it("logs out one access-token session without invalidating another", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    const first = provider.seedSessionForTesting("user-a");
    const second = provider.seedSessionForTesting("user-b");

    const result = await provider.logout({ accessToken: first.accessToken });

    expect(result).toEqual({ ok: true, value: undefined });
    await expect(
      provider.getCurrentUser({ accessToken: first.accessToken }),
    ).resolves.toEqual({ ok: true, value: null });
    await expect(
      provider.getCurrentUser({ accessToken: second.accessToken }),
    ).resolves.toEqual({ ok: true, value: { id: "user-b" } });
  });

  it("revokes every rotated credential when logging out with a prior access token", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    const initial = provider.seedSessionForTesting("user-a");
    const refreshed = await provider.refreshSession({
      refreshToken: initial.refreshToken,
    });
    if (!refreshed.ok) throw new Error("expected refresh success");

    const result = await provider.logout({ accessToken: initial.accessToken });

    expect(result).toEqual({ ok: true, value: undefined });
    await expect(
      provider.getCurrentUser({ accessToken: refreshed.value.accessToken }),
    ).resolves.toEqual({ ok: true, value: null });
    await expect(
      provider.refreshSession({ refreshToken: refreshed.value.refreshToken }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_session" },
    });
  });

  it("allows tests to seed a session directly without going through the OTP flow", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const provider = createTestAuthProvider({ identityStore });
    const identity = await identityStore.createUserWithIdentity({
      provider: "test_phone",
      subject: "+15559998888",
    });

    const session = provider.seedSessionForTesting(identity.userId);
    const current = await provider.getCurrentUser({
      accessToken: session.accessToken,
    });

    expect(current).toEqual({ ok: true, value: { id: identity.userId } });
  });
});
