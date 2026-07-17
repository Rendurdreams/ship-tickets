export interface AuthenticatedUser {
  readonly id: string;
}

export type AuthErrorCode =
  | "otp_not_requested"
  | "otp_request_failed"
  | "invalid_otp"
  | "otp_verification_failed"
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
  readonly phone: string;
}

export interface VerifyPhoneOtpInput {
  readonly phone: string;
  readonly code: string;
}

export interface LogoutInput {
  readonly sessionToken: string;
}

export interface CurrentUserInput {
  readonly sessionToken: string;
}

export interface AuthSession {
  readonly userId: string;
  readonly sessionToken: string;
}

export interface AuthProvider {
  requestPhoneOtp(input: RequestPhoneOtpInput): Promise<AuthResult<void>>;
  verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<AuthResult<AuthSession>>;
  logout(input: LogoutInput): Promise<AuthResult<void>>;
  getCurrentUser(
    input: CurrentUserInput,
  ): Promise<AuthResult<AuthenticatedUser | null>>;
}
