import { createClient } from "@supabase/supabase-js";

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

const SUPABASE_PHONE_PROVIDER = "supabase_phone";

interface SupabaseAuthUser {
  readonly id: string;
}

interface SupabaseAuthSession {
  readonly access_token: string;
  readonly expires_at?: number;
  readonly refresh_token: string;
}

interface SupabaseAuthApiError {
  readonly code?: string;
  readonly message: string;
  readonly status?: number;
}

/**
 * The narrow slice of the official `@supabase/supabase-js` client this
 * adapter depends on. The real `SupabaseClient` satisfies this structurally,
 * so tests can inject a fake client without mocking the SDK module itself.
 */
export interface SupabaseAuthClient {
  auth: {
    signInWithOtp(params: {
      phone: string;
      options?: { captchaToken?: string };
    }): Promise<{ error: SupabaseAuthApiError | null }>;
    verifyOtp(params: { phone: string; token: string; type: "sms" }): Promise<{
      data: {
        user: SupabaseAuthUser | null;
        session: SupabaseAuthSession | null;
      };
      error: SupabaseAuthApiError | null;
    }>;
    refreshSession(params: { refresh_token: string }): Promise<{
      data: {
        user: SupabaseAuthUser | null;
        session: SupabaseAuthSession | null;
      };
      error: SupabaseAuthApiError | null;
    }>;
    setSession(params: {
      access_token: string;
      refresh_token: string;
    }): Promise<{ error: SupabaseAuthApiError | null }>;
    signOut(params: {
      scope: "local";
    }): Promise<{ error: SupabaseAuthApiError | null }>;
    getUser(jwt: string): Promise<{
      data: { user: SupabaseAuthUser | null };
      error: SupabaseAuthApiError | null;
    }>;
  };
}

export interface SupabaseAuthProviderOptions {
  readonly identityStore: AuthIdentityStore;
  /** Injected single client for unit tests. Production should use the default factory. */
  readonly client?: SupabaseAuthClient;
  /** Optional factory for testing request isolation. Defaults to a fresh real client per operation. */
  readonly clientFactory?: () => SupabaseAuthClient;
  readonly supabaseUrl?: string;
  readonly supabasePublishableKey?: string;
}

function isIdentityConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "identity_conflict"
  );
}

function isRateLimited(error: SupabaseAuthApiError): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

function isInvalidSession(error: SupabaseAuthApiError): boolean {
  return (
    error.code === "bad_jwt" ||
    error.code === "jwt_expired" ||
    error.code === "session_not_found" ||
    error.code === "refresh_token_not_found" ||
    error.code === "refresh_token_already_used"
  );
}

function isInvalidOtp(error: SupabaseAuthApiError): boolean {
  return (
    error.code === "otp_expired" ||
    /invalid.*(?:otp|token)|(?:otp|token).*invalid/i.test(error.message)
  );
}

function toAuthSession(
  userId: string,
  session: SupabaseAuthSession,
): AuthSession {
  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    refreshToken: session.refresh_token,
    userId,
  };
}

async function resolveOrCreateIdentity(
  identityStore: AuthIdentityStore,
  subject: string,
  phone: string,
) {
  let identity = await identityStore.findIdentity(
    SUPABASE_PHONE_PROVIDER,
    subject,
  );

  if (identity) return identity;

  try {
    return await identityStore.createUserWithIdentity({
      phone,
      provider: SUPABASE_PHONE_PROVIDER,
      subject,
    });
  } catch (error) {
    if (!isIdentityConflict(error)) throw error;

    identity = await identityStore.findIdentity(
      SUPABASE_PHONE_PROVIDER,
      subject,
    );
    if (!identity) throw error;

    return identity;
  }
}

async function resolveInternalUser(
  identityStore: AuthIdentityStore,
  subject: string,
): Promise<{ userId: string } | null> {
  const identity = await identityStore.findIdentity(
    SUPABASE_PHONE_PROVIDER,
    subject,
  );
  return identity ? { userId: identity.userId } : null;
}

/**
 * Canonical MVP login/session provider (ADR 0003). Every domain use case
 * only ever sees the internal Ship Tickets user id resolved here — the raw
 * Supabase `auth.users` id never leaves this adapter.
 */
export function createSupabaseAuthProvider(
  options: SupabaseAuthProviderOptions,
): AuthProvider {
  const { identityStore } = options;
  let clientFactory: () => SupabaseAuthClient;

  if (options.clientFactory) {
    clientFactory = options.clientFactory;
  } else if (options.client) {
    clientFactory = () => options.client as SupabaseAuthClient;
  } else {
    const supabaseUrl = requireOption(options.supabaseUrl, "supabaseUrl");
    const supabasePublishableKey = requireOption(
      options.supabasePublishableKey,
      "supabasePublishableKey",
    );
    clientFactory = () =>
      createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      }) as unknown as SupabaseAuthClient;
  }

  return {
    async requestPhoneOtp(
      input: RequestPhoneOtpInput,
    ): Promise<AuthResult<void>> {
      const phone = normalizeE164Phone(input.phone);
      if (!phone) {
        return err("invalid_phone", "Phone number must use E.164 format");
      }

      try {
        const client = clientFactory();
        const { error } = await client.auth.signInWithOtp({
          phone,
          ...(input.captchaToken
            ? { options: { captchaToken: input.captchaToken } }
            : {}),
        });
        if (error) {
          if (isRateLimited(error)) {
            return err("rate_limited", "Too many authentication attempts");
          }
          return err("otp_request_failed", "Could not request a phone code");
        }
        return ok(undefined);
      } catch {
        return err("provider_error", "Authentication provider unavailable");
      }
    },

    async verifyPhoneOtp(
      input: VerifyPhoneOtpInput,
    ): Promise<AuthResult<AuthSession>> {
      const phone = normalizeE164Phone(input.phone);
      if (!phone) {
        return err("invalid_phone", "Phone number must use E.164 format");
      }

      try {
        const client = clientFactory();
        const { data, error } = await client.auth.verifyOtp({
          phone,
          token: input.code,
          type: "sms",
        });
        if (error) {
          if (isRateLimited(error)) {
            return err("rate_limited", "Too many authentication attempts");
          }
          if (isInvalidOtp(error)) {
            return err("invalid_otp", "The phone code is invalid or expired");
          }
          return err(
            "otp_verification_failed",
            "Could not verify the phone code",
          );
        }
        if (!data.user || !data.session) {
          return err("invalid_otp", "The phone code is invalid or expired");
        }

        const identity = await resolveOrCreateIdentity(
          identityStore,
          data.user.id,
          phone,
        );
        return ok(toAuthSession(identity.userId, data.session));
      } catch {
        return err("provider_error", "Authentication provider unavailable");
      }
    },

    async refreshSession(
      input: RefreshSessionInput,
    ): Promise<AuthResult<AuthSession>> {
      try {
        const client = clientFactory();
        const { data, error } = await client.auth.refreshSession({
          refresh_token: input.refreshToken,
        });
        if (error) {
          if (isRateLimited(error)) {
            return err("rate_limited", "Too many authentication attempts");
          }
          if (isInvalidSession(error)) {
            return err("invalid_session", "The session is no longer valid");
          }
          return err("provider_error", "Authentication provider unavailable");
        }
        if (!data.user || !data.session) {
          return err("invalid_session", "The session is no longer valid");
        }

        const internalUser = await resolveInternalUser(
          identityStore,
          data.user.id,
        );
        if (!internalUser) {
          return err(
            "identity_not_linked",
            "Supabase session has no linked internal Ship Tickets user",
          );
        }

        return ok(toAuthSession(internalUser.userId, data.session));
      } catch {
        return err("provider_error", "Authentication provider unavailable");
      }
    },

    async logout(input: LogoutInput): Promise<AuthResult<void>> {
      try {
        const client = clientFactory();
        const { error: sessionError } = await client.auth.setSession({
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
        });
        if (sessionError) {
          return err("invalid_session", "The session is no longer valid");
        }

        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) {
          return err("provider_error", "Could not end the session");
        }
        return ok(undefined);
      } catch {
        return err("provider_error", "Authentication provider unavailable");
      }
    },

    async getCurrentUser(
      input: CurrentUserInput,
    ): Promise<AuthResult<AuthenticatedUser | null>> {
      try {
        const client = clientFactory();
        const { data, error } = await client.auth.getUser(input.accessToken);
        if (error) {
          if (isInvalidSession(error)) return ok(null);
          return err("provider_error", "Authentication provider unavailable");
        }
        if (!data.user) return ok(null);

        const internalUser = await resolveInternalUser(
          identityStore,
          data.user.id,
        );
        if (!internalUser) {
          return err(
            "identity_not_linked",
            "Supabase session has no linked internal Ship Tickets user",
          );
        }

        return ok({ id: internalUser.userId });
      } catch {
        return err("provider_error", "Authentication provider unavailable");
      }
    },
  };
}

function requireOption(
  value: string | undefined,
  name: "supabaseUrl" | "supabasePublishableKey",
): string {
  if (!value) {
    throw new Error(
      `createSupabaseAuthProvider requires "${name}" when no client is injected`,
    );
  }
  return value;
}
