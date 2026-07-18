import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { DatabaseConfig } from "./config";
import * as schema from "./schema";

export interface RuntimeSecurityState {
  readonly bypassesRls: boolean;
  readonly canCreateDatabases: boolean;
  readonly canCreatePublic: boolean;
  readonly canCreateRoles: boolean;
  readonly canReplicate: boolean;
  readonly hasForbiddenTablePrivileges: boolean;
  readonly hasRequiredTablePrivileges: boolean;
  readonly hasRoleMemberships: boolean;
  readonly hasRoleOverride: boolean;
  readonly isSuperuser: boolean;
  readonly ownsApplicationTables: boolean;
  readonly role: string;
}

export function assertRuntimeSecurityState(state: RuntimeSecurityState): void {
  const unsafeCapabilities = [
    state.isSuperuser && "is a superuser",
    state.bypassesRls && "has BYPASSRLS",
    state.canCreateDatabases && "has CREATEDB",
    state.canCreateRoles && "has CREATEROLE",
    state.canReplicate && "has REPLICATION",
    state.hasRoleMemberships && "has a role membership",
    state.hasRoleOverride && "does not match the authenticated session user",
    state.hasForbiddenTablePrivileges && "has forbidden table privileges",
    state.ownsApplicationTables && "owns an application table",
    state.canCreatePublic && "can create objects in the public schema",
    !state.hasRequiredTablePrivileges && "lacks required table privileges",
  ].filter(Boolean);

  if (unsafeCapabilities.length > 0) {
    throw new Error(
      `DATABASE_URL role ${state.role} is not a safe runtime principal: ${unsafeCapabilities.join(
        ", ",
      )}`,
    );
  }
}

export function toPostgresOptions(config: DatabaseConfig) {
  return {
    max: config.maxConnections,
    prepare: config.prepareStatements,
  };
}

export async function createDatabaseClient(config: DatabaseConfig) {
  const client = postgres(config.databaseUrl, toPostgresOptions(config));

  try {
    const [securityState] = await client<RuntimeSecurityState[]>`
      select
        session_user as role,
        current_user <> session_user as "hasRoleOverride",
        roles.rolsuper as "isSuperuser",
        roles.rolbypassrls as "bypassesRls",
        roles.rolcreatedb as "canCreateDatabases",
        roles.rolcreaterole as "canCreateRoles",
        roles.rolreplication as "canReplicate",
        exists (
          select 1
          from pg_auth_members memberships
          where memberships.member = roles.oid
        ) as "hasRoleMemberships",
        has_schema_privilege(
          session_user,
          'public',
          'create'
        ) as "canCreatePublic",
        exists (
          select 1
          from pg_class tables
          inner join pg_namespace schemas on schemas.oid = tables.relnamespace
          where schemas.nspname = 'public'
            and tables.relname in (
              'users',
              'auth_identities',
              'organizations',
              'org_members'
            )
            and tables.relowner = roles.oid
        ) as "ownsApplicationTables",
        has_table_privilege(session_user, 'users', 'update')
          or has_table_privilege(session_user, 'users', 'delete')
          or has_table_privilege(session_user, 'users', 'truncate')
          or has_table_privilege(session_user, 'users', 'references')
          or has_table_privilege(session_user, 'users', 'trigger')
          or has_table_privilege(session_user, 'auth_identities', 'update')
          or has_table_privilege(session_user, 'auth_identities', 'delete')
          or has_table_privilege(session_user, 'auth_identities', 'truncate')
          or has_table_privilege(session_user, 'auth_identities', 'references')
          or has_table_privilege(session_user, 'auth_identities', 'trigger')
          or has_table_privilege(session_user, 'organizations', 'truncate')
          or has_table_privilege(session_user, 'organizations', 'references')
          or has_table_privilege(session_user, 'organizations', 'trigger')
          or has_table_privilege(session_user, 'org_members', 'truncate')
          or has_table_privilege(session_user, 'org_members', 'references')
          or has_table_privilege(session_user, 'org_members', 'trigger')
          as "hasForbiddenTablePrivileges",
        has_table_privilege(session_user, 'users', 'select')
          and has_table_privilege(session_user, 'users', 'insert')
          and has_table_privilege(session_user, 'auth_identities', 'select')
          and has_table_privilege(session_user, 'auth_identities', 'insert')
          and has_table_privilege(session_user, 'organizations', 'select')
          and has_table_privilege(session_user, 'organizations', 'insert')
          and has_table_privilege(session_user, 'organizations', 'update')
          and has_table_privilege(session_user, 'organizations', 'delete')
          and has_table_privilege(session_user, 'org_members', 'select')
          and has_table_privilege(session_user, 'org_members', 'insert')
          and has_table_privilege(session_user, 'org_members', 'update')
          and has_table_privilege(session_user, 'org_members', 'delete')
          as "hasRequiredTablePrivileges"
      from pg_roles roles
      where roles.rolname = session_user
    `;

    if (!securityState) {
      throw new Error("DATABASE_URL did not resolve to a PostgreSQL role");
    }

    assertRuntimeSecurityState(securityState);
    const db = drizzle(client, { schema });

    return {
      db,
      async close(): Promise<void> {
        await client.end();
      },
    };
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export type ShipTicketsDatabase = Awaited<
  ReturnType<typeof createDatabaseClient>
>["db"];
