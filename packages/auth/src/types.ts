export interface AuthenticatedUser {
  readonly id: string;
}

export type AuthErrorCode =
  | "otp_not_requested"
  | "otp_request_failed"
  | "invalid_otp"
  | "invalid_phone"
  | "invalid_session"
  | "otp_verification_failed"
  | "rate_limited"
  | "identity_conflict"
  | "identity_not_linked"
  | "provider_error";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export type AuthResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AuthError };

export function ok<T>(value: T): AuthResult<T> {
  return { ok: true, value };
}

export function err<T>(code: AuthErrorCode, message: string): AuthResult<T> {
  return { ok: false, error: new AuthError(code, message) };
}

export interface RequestPhoneOtpInput {
  readonly captchaToken?: string;
  readonly phone: string;
}

export interface VerifyPhoneOtpInput {
  readonly phone: string;
  readonly code: string;
}

export interface LogoutInput {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface CurrentUserInput {
  readonly accessToken: string;
}

export interface RefreshSessionInput {
  readonly refreshToken: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly expiresAt: number | null;
  readonly refreshToken: string;
  readonly userId: string;
}

export interface AuthProvider {
  requestPhoneOtp(input: RequestPhoneOtpInput): Promise<AuthResult<void>>;
  verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<AuthResult<AuthSession>>;
  refreshSession(input: RefreshSessionInput): Promise<AuthResult<AuthSession>>;
  logout(input: LogoutInput): Promise<AuthResult<void>>;
  getCurrentUser(
    input: CurrentUserInput,
  ): Promise<AuthResult<AuthenticatedUser | null>>;
}
