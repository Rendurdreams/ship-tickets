import { and, eq, sql } from "drizzle-orm";

import type { ShipTicketsDatabase } from "../client";
import { authIdentities, users } from "../schema";

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

export class AuthIdentityConflictError extends Error {
  readonly code = "identity_conflict";

  constructor(provider: string) {
    super(`An identity already exists for provider "${provider}"`);
    this.name = "AuthIdentityConflictError";
  }
}

export interface AuthIdentityRepository {
  findIdentity(
    provider: string,
    subject: string,
  ): Promise<AuthIdentityRecord | null>;
  createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord>;
}

export function createAuthIdentityRepository(
  database: ShipTicketsDatabase,
): AuthIdentityRepository {
  return {
    async findIdentity(provider, subject) {
      const rows = await database
        .select({
          provider: authIdentities.provider,
          subject: authIdentities.subject,
          userId: authIdentities.userId,
        })
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.subject, subject),
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    },
    createUserWithIdentity(input) {
      return database.transaction(async (transaction) => {
        await transaction.execute(
          sql`
            select pg_advisory_xact_lock(
              hashtextextended(${input.provider} || chr(31) || ${input.subject}, 0)
            )
          `,
        );

        const existing = await transaction
          .select({ userId: authIdentities.userId })
          .from(authIdentities)
          .where(
            and(
              eq(authIdentities.provider, input.provider),
              eq(authIdentities.subject, input.subject),
            ),
          )
          .limit(1);

        if (existing[0]) {
          throw new AuthIdentityConflictError(input.provider);
        }

        const createdUsers = await transaction
          .insert(users)
          .values({ email: input.email, phone: input.phone })
          .returning({ id: users.id });
        const createdUser = createdUsers[0];

        if (!createdUser) {
          throw new Error("Failed to create internal user");
        }

        const createdIdentities = await transaction
          .insert(authIdentities)
          .values({
            provider: input.provider,
            subject: input.subject,
            userId: createdUser.id,
          })
          .returning({
            provider: authIdentities.provider,
            subject: authIdentities.subject,
            userId: authIdentities.userId,
          });
        const createdIdentity = createdIdentities[0];

        if (!createdIdentity) {
          throw new Error("Failed to create authentication identity");
        }

        return createdIdentity;
      });
    },
  };
}
