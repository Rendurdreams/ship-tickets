export interface AuthenticatedUser {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface AuthProvider {
  getCurrentUser(headers: Headers): Promise<AuthenticatedUser | null>;
}
