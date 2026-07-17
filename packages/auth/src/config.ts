import { z } from "zod";

const AuthConfigInputSchema = z.object({
  AUTH_PROVIDER: z.enum(["mock", "supabase_phone"]),
  DEPLOYMENT_MODE: z
    .enum(["development", "self_hosted", "mixt_hosted"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
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
    if (parsed.DEPLOYMENT_MODE !== "development") {
      throw new Error(
        "AUTH_PROVIDER=mock is allowed only when DEPLOYMENT_MODE=development",
      );
    }
    if (
      parsed.NODE_ENV === "production" ||
      parsed.VERCEL_ENV === "production"
    ) {
      throw new Error("AUTH_PROVIDER=mock is not allowed in production");
    }

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

  let parsedSupabaseUrl: URL;

  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }

  if (
    parsedSupabaseUrl.protocol !== "http:" &&
    parsedSupabaseUrl.protocol !== "https:"
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS");
  }

  return { provider: "supabase_phone", supabaseUrl, supabasePublishableKey };
}
