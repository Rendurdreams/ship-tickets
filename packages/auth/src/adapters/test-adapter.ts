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

interface TestSessionRecord {
  readonly sessionId: string;
  readonly userId: string;
}

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
  const sessionByAccessToken = new Map<string, TestSessionRecord>();
  const sessionByRefreshToken = new Map<string, TestSessionRecord>();

  function issueSession(userId: string, sessionId: string): AuthSession {
    const session: AuthSession = {
      accessToken: `test-access-${randomUUID()}`,
      expiresAt: TEST_EXPIRES_AT,
      refreshToken: `test-refresh-${randomUUID()}`,
      userId,
    };
    const record = { sessionId, userId };
    sessionByAccessToken.set(session.accessToken, record);
    sessionByRefreshToken.set(session.refreshToken, record);
    return session;
  }

  function seedSessionForTesting(userId: string): AuthSession {
    return issueSession(userId, randomUUID());
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
      const session = sessionByRefreshToken.get(input.refreshToken);
      if (!session) {
        return err("invalid_session", "The session is no longer valid");
      }
      sessionByRefreshToken.delete(input.refreshToken);
      return ok(issueSession(session.userId, session.sessionId));
    },

    async logout(input: LogoutInput): Promise<AuthResult<void>> {
      const session = sessionByAccessToken.get(input.accessToken);
      if (!session) {
        return err("invalid_session", "The session is no longer valid");
      }
      for (const [token, candidate] of sessionByAccessToken) {
        if (candidate.sessionId === session.sessionId) {
          sessionByAccessToken.delete(token);
        }
      }
      for (const [token, candidate] of sessionByRefreshToken) {
        if (candidate.sessionId === session.sessionId) {
          sessionByRefreshToken.delete(token);
        }
      }
      return ok(undefined);
    },

    async getCurrentUser(
      input: CurrentUserInput,
    ): Promise<AuthResult<AuthenticatedUser | null>> {
      const session = sessionByAccessToken.get(input.accessToken);
      return ok(session ? { id: session.userId } : null);
    },
  };
}
