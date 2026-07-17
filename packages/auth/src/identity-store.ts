import { randomUUID } from "node:crypto";

import { AuthError } from "./types";

export interface AuthIdentityRecord {
  readonly userId: string;
  readonly provider: string;
  readonly subject: string;
}

export interface CreateUserWithIdentityInput {
  readonly provider: string;
  readonly subject: string;
  readonly phone?: string;
  readonly email?: string;
}

/**
 * Provider-neutral port for resolving a `(provider, subject)` pair to an
 * internal Ship Tickets user id. The Postgres-backed implementation (issue #6)
 * must resolve `findIdentity` through a parameterized query against the
 * `auth_identities_provider_subject_unique` index so provider/subject values
 * are always compared as exact, opaque strings — never interpolated or
 * pattern-matched, and never used to merge users by email or phone.
 */
export interface AuthIdentityStore {
  findIdentity(
    provider: string,
    subject: string,
  ): Promise<AuthIdentityRecord | null>;
  createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord>;
}

function identityKey(provider: string, subject: string): string {
  return JSON.stringify([provider, subject]);
}

export class InMemoryAuthIdentityStore implements AuthIdentityStore {
  private readonly identitiesByKey = new Map<string, AuthIdentityRecord>();

  async findIdentity(
    provider: string,
    subject: string,
  ): Promise<AuthIdentityRecord | null> {
    return this.identitiesByKey.get(identityKey(provider, subject)) ?? null;
  }

  async createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord> {
    const key = identityKey(input.provider, input.subject);

    if (this.identitiesByKey.has(key)) {
      throw new AuthError(
        "identity_conflict",
        `An identity already exists for provider "${input.provider}"`,
      );
    }

    const record: AuthIdentityRecord = {
      userId: randomUUID(),
      provider: input.provider,
      subject: input.subject,
    };
    this.identitiesByKey.set(key, record);

    return record;
  }
}
