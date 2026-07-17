import { randomUUID } from "node:crypto";

import type { AuthIdentityStore } from "../identity-store";
import {
  err,
  ok,
  type AuthProvider,
  type AuthResult,
  type AuthSession,
  type AuthenticatedUser,
  type CurrentUserInput,
  type LogoutInput,
  type RequestPhoneOtpInput,
  type VerifyPhoneOtpInput,
} from "../types";

const TEST_PROVIDER = "test_phone";
const FIXED_OTP_CODE = "000000";

export interface TestAuthProviderOptions {
  readonly identityStore: AuthIdentityStore;
}

export interface TestAuthProvider extends AuthProvider {
  /** Fixed OTP code issued by every `requestPhoneOtp` call. Deterministic, dev/test only. */
  readonly fixedOtpCodeForTesting: string;
  /** Directly creates a valid session for a known internal user id, bypassing the OTP flow. */
  seedSessionForTesting(userId: string): string;
}

/**
 * Deterministic, in-memory auth adapter for development and tests. Never
 * sends a real OTP and must never be selected for a production/hosted
 * deployment.
 */
export function createTestAuthProvider(
  options: TestAuthProviderOptions,
): TestAuthProvider {
  const { identityStore } = options;
  const pendingOtpsByPhone = new Map<string, string>();
  const userIdBySessionToken = new Map<string, string>();

  function seedSessionForTesting(userId: string): string {
    const sessionToken = `test-session-${randomUUID()}`;
    userIdBySessionToken.set(sessionToken, userId);
    return sessionToken;
  }

  return {
    fixedOtpCodeForTesting: FIXED_OTP_CODE,
    seedSessionForTesting,

    async requestPhoneOtp(
      input: RequestPhoneOtpInput,
    ): Promise<AuthResult<void>> {
      pendingOtpsByPhone.set(input.phone, FIXED_OTP_CODE);
      return ok(undefined);
    },

    async verifyPhoneOtp(
      input: VerifyPhoneOtpInput,
    ): Promise<AuthResult<AuthSession>> {
      const expectedCode = pendingOtpsByPhone.get(input.phone);
      if (expectedCode === undefined) {
        return err(
          "otp_not_requested",
          `No OTP was requested for ${input.phone}`,
        );
      }
      if (expectedCode !== input.code) {
        return err("invalid_otp", "The provided OTP code is incorrect");
      }
      pendingOtpsByPhone.delete(input.phone);

      let identity = await identityStore.findIdentity(
        TEST_PROVIDER,
        input.phone,
      );
      if (!identity) {
        identity = await identityStore.createUserWithIdentity({
          provider: TEST_PROVIDER,
          subject: input.phone,
          phone: input.phone,
        });
      }

      const sessionToken = seedSessionForTesting(identity.userId);
      return ok({ userId: identity.userId, sessionToken });
    },

    async logout(input: LogoutInput): Promise<AuthResult<void>> {
      userIdBySessionToken.delete(input.sessionToken);
      return ok(undefined);
    },

    async getCurrentUser(
      input: CurrentUserInput,
    ): Promise<AuthResult<AuthenticatedUser | null>> {
      const userId = userIdBySessionToken.get(input.sessionToken);
      return ok(userId ? { id: userId } : null);
    },
  };
}
