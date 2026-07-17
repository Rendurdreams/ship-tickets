import { createClient } from "@supabase/supabase-js";

import type { AuthIdentityStore } from "../identity-store";
import {
  err,
  ok,
  type AuthProvider,
  type AuthResult,
  type AuthSession,
  type AuthenticatedUser,
  type CurrentUserInput,
  type RequestPhoneOtpInput,
  type VerifyPhoneOtpInput,
} from "../types";

const SUPABASE_PHONE_PROVIDER = "supabase_phone";

interface SupabaseAuthUser {
  readonly id: string;
}

interface SupabaseAuthSession {
  readonly access_token: string;
}

interface SupabaseAuthApiError {
  readonly message: string;
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
    }): Promise<{ error: SupabaseAuthApiError | null }>;
    verifyOtp(params: { phone: string; token: string; type: "sms" }): Promise<{
      data: {
        user: SupabaseAuthUser | null;
        session: SupabaseAuthSession | null;
      };
      error: SupabaseAuthApiError | null;
    }>;
    signOut(): Promise<{ error: SupabaseAuthApiError | null }>;
    getUser(jwt: string): Promise<{
      data: { user: SupabaseAuthUser | null };
      error: SupabaseAuthApiError | null;
    }>;
  };
}

export interface SupabaseAuthProviderOptions {
  readonly identityStore: AuthIdentityStore;
  /** Injected for testing; defaults to a real client built from `supabaseUrl`/`supabasePublishableKey`. */
  readonly client?: SupabaseAuthClient;
  readonly supabaseUrl?: string;
  readonly supabasePublishableKey?: string;
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
  const client: SupabaseAuthClient =
    options.client ??
    createClient(
      requireOption(options.supabaseUrl, "supabaseUrl"),
      requireOption(options.supabasePublishableKey, "supabasePublishableKey"),
    );

  return {
    async requestPhoneOtp(
      input: RequestPhoneOtpInput,
    ): Promise<AuthResult<void>> {
      const { error } = await client.auth.signInWithOtp({
        phone: input.phone,
      });
      if (error) {
        return err("otp_request_failed", error.message);
      }
      return ok(undefined);
    },

    async verifyPhoneOtp(
      input: VerifyPhoneOtpInput,
    ): Promise<AuthResult<AuthSession>> {
      const { data, error } = await client.auth.verifyOtp({
        phone: input.phone,
        token: input.code,
        type: "sms",
      });
      if (error || !data.user || !data.session) {
        return err("invalid_otp", error?.message ?? "OTP verification failed");
      }

      const subject = data.user.id;
      let identity = await identityStore.findIdentity(
        SUPABASE_PHONE_PROVIDER,
        subject,
      );
      if (!identity) {
        identity = await identityStore.createUserWithIdentity({
          provider: SUPABASE_PHONE_PROVIDER,
          subject,
          phone: input.phone,
        });
      }

      return ok({
        userId: identity.userId,
        sessionToken: data.session.access_token,
      });
    },

    async logout(): Promise<AuthResult<void>> {
      const { error } = await client.auth.signOut();
      if (error) {
        return err("provider_error", error.message);
      }
      return ok(undefined);
    },

    async getCurrentUser(
      input: CurrentUserInput,
    ): Promise<AuthResult<AuthenticatedUser | null>> {
      const { data, error } = await client.auth.getUser(input.sessionToken);
      if (error || !data.user) {
        return ok(null);
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

      return ok({ id: internalUser.userId });
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
