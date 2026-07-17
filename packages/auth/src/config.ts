import { z } from "zod";

const AuthConfigInputSchema = z.object({
  AUTH_PROVIDER: z.enum(["mock", "supabase_phone"]).default("mock"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

export interface TestAuthConfig {
  readonly provider: "mock";
}

export interface SupabasePhoneAuthConfig {
  readonly provider: "supabase_phone";
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

export type AuthConfig = TestAuthConfig | SupabasePhoneAuthConfig;

/**
 * Validates only the public, non-secret Supabase config (project URL and
 * anon/publishable key) required to select an adapter. Real values are never
 * placed in the repo — see `.env.example` for the documented placeholders.
 */
export function loadAuthConfig(
  environment: Record<string, string | undefined>,
): AuthConfig {
  const parsed = AuthConfigInputSchema.parse(environment);

  if (parsed.AUTH_PROVIDER === "mock") {
    return { provider: "mock" };
  }

  const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required when AUTH_PROVIDER=supabase_phone",
    );
  }

  const supabasePublishableKey =
    parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabasePublishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required when AUTH_PROVIDER=supabase_phone",
    );
  }

  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }

  return { provider: "supabase_phone", supabaseUrl, supabasePublishableKey };
}
