export {
  AuthError,
  type AuthErrorCode,
  type AuthProvider,
  type AuthResult,
  type AuthSession,
  type AuthenticatedUser,
  type CurrentUserInput,
  type LogoutInput,
  type RequestPhoneOtpInput,
  type VerifyPhoneOtpInput,
} from "./types";

export {
  InMemoryAuthIdentityStore,
  type AuthIdentityRecord,
  type AuthIdentityStore,
  type CreateUserWithIdentityInput,
} from "./identity-store";

export {
  createTestAuthProvider,
  type TestAuthProvider,
  type TestAuthProviderOptions,
} from "./adapters/test-adapter";

export {
  createSupabaseAuthProvider,
  type SupabaseAuthClient,
  type SupabaseAuthProviderOptions,
} from "./adapters/supabase-adapter";

export { loadAuthConfig, type AuthConfig } from "./config";
