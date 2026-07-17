import { randomUUID } from "node:crypto";

import type { AuthIdentityStore } from "../identity-store";
import { normalizeE164Phone } from "../phone";
import {
  err,
  ok,
  type AuthProvider,
  type AuthResult,
  type AuthSession,
  type AuthenticatedUser,
  type CurrentUserInput,
  type LogoutInput,
  type RefreshSessionInput,
  type RequestPhoneOtpInput,
  type VerifyPhoneOtpInput,
} from "../types";

const TEST_PROVIDER = "test_phone";
const FIXED_OTP_CODE = "000000";
const TEST_EXPIRES_AT = 4_102_444_800;

export interface TestAuthProviderOptions {
  readonly identityStore: AuthIdentityStore;
}

export interface TestAuthProvider extends AuthProvider {
  /** Fixed OTP code issued by every `requestPhoneOtp` call. Deterministic, dev/test only. */
  readonly fixedOtpCodeForTesting: string;
  /** Directly creates a valid session for a known internal user id, bypassing the OTP flow. */
  seedSessionForTesting(userId: string): AuthSession;
}

function isIdentityConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "identity_conflict"
  );
}

/** Deterministic auth for development/tests. It never contacts an SMS provider. */
export function createTestAuthProvider(
  options: TestAuthProviderOptions,
): TestAuthProvider {
  const { identityStore } = options;
  const pendingOtpsByPhone = new Map<string, string>();
  const userIdByAccessToken = new Map<string, string>();
  const userIdByRefreshToken = new Map<string, string>();

  function seedSessionForTesting(userId: string): AuthSession {
    const session: AuthSession = {
      accessToken: `test-access-${randomUUID()}`,
      expiresAt: TEST_EXPIRES_AT,
      refreshToken: `test-refresh-${randomUUID()}`,
      userId,
    };
    userIdByAccessToken.set(session.accessToken, userId);
    userIdByRefreshToken.set(session.refreshToken, userId);
    return session;
  }

  return {
    fixedOtpCodeForTesting: FIXED_OTP_CODE,
    seedSessionForTesting,

    async requestPhoneOtp(
      input: RequestPhoneOtpInput,
    ): Promise<AuthResult<void>> {
      const phone = normalizeE164Phone(input.phone);
      if (!phone) {
        return err("invalid_phone", "Phone number must use E.164 format");
      }
      pendingOtpsByPhone.set(phone, FIXED_OTP_CODE);
      return ok(undefined);
    },

    async verifyPhoneOtp(
      input: VerifyPhoneOtpInput,
    ): Promise<AuthResult<AuthSession>> {
      const phone = normalizeE164Phone(input.phone);
      if (!phone) {
        return err("invalid_phone", "Phone number must use E.164 format");
      }

      const expectedCode = pendingOtpsByPhone.get(phone);
      if (expectedCode === undefined) {
        return err("otp_not_requested", "No OTP was requested for this phone");
      }
      if (expectedCode !== input.code) {
        return err("invalid_otp", "The provided OTP code is incorrect");
      }
      pendingOtpsByPhone.delete(phone);

      try {
        let identity = await identityStore.findIdentity(TEST_PROVIDER, phone);
        if (!identity) {
          try {
            identity = await identityStore.createUserWithIdentity({
              phone,
              provider: TEST_PROVIDER,
              subject: phone,
            });
          } catch (error) {
            if (!isIdentityConflict(error)) throw error;
            identity = await identityStore.findIdentity(TEST_PROVIDER, phone);
            if (!identity) throw error;
          }
        }

        return ok(seedSessionForTesting(identity.userId));
      } catch {
        return err("provider_error", "Identity store unavailable");
      }
    },

    async refreshSession(
      input: RefreshSessionInput,
    ): Promise<AuthResult<AuthSession>> {
      const userId = userIdByRefreshToken.get(input.refreshToken);
      if (!userId) {
        return err("invalid_session", "The session is no longer valid");
      }
      userIdByRefreshToken.delete(input.refreshToken);
      return ok(seedSessionForTesting(userId));
    },

    async logout(input: LogoutInput): Promise<AuthResult<void>> {
      userIdByAccessToken.delete(input.accessToken);
      userIdByRefreshToken.delete(input.refreshToken);
      return ok(undefined);
    },

    async getCurrentUser(
      input: CurrentUserInput,
    ): Promise<AuthResult<AuthenticatedUser | null>> {
      const userId = userIdByAccessToken.get(input.accessToken);
      return ok(userId ? { id: userId } : null);
    },
  };
}
