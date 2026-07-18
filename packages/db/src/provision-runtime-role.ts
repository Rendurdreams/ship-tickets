import postgres from "postgres";

import type { DatabaseProvisionConfig } from "./config";

interface ExistingRuntimeRole {
  readonly bypassesRls: boolean;
  readonly canLogin: boolean;
  readonly canCreateDatabases: boolean;
  readonly canCreateRoles: boolean;
  readonly canReplicate: boolean;
  readonly hasRoleMemberships: boolean;
  readonly isSuperuser: boolean;
  readonly ownsApplicationTables: boolean;
}

export async function provisionRuntimeRole(
  config: DatabaseProvisionConfig,
): Promise<void> {
  const admin = postgres(config.databaseUrl, { max: 1, prepare: false });

  try {
    const [runtimeRole] = await admin<ExistingRuntimeRole[]>`
      select
        roles.rolcanlogin as "canLogin",
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
        ) as "ownsApplicationTables"
      from pg_roles roles
      where roles.rolname = ${config.runtimeRole}
    `;

    if (!runtimeRole?.canLogin) {
      throw new Error(
        `DATABASE_RUNTIME_ROLE must name an existing login: ${config.runtimeRole}`,
      );
    }

    if (runtimeRole.ownsApplicationTables) {
      throw new Error(
        `DATABASE_RUNTIME_ROLE must not own application tables: ${config.runtimeRole}`,
      );
    }

    if (runtimeRole.hasRoleMemberships) {
      throw new Error(
        `DATABASE_RUNTIME_ROLE must not have any role membership: ${config.runtimeRole}`,
      );
    }

    if (
      runtimeRole.isSuperuser ||
      runtimeRole.bypassesRls ||
      runtimeRole.canCreateDatabases ||
      runtimeRole.canCreateRoles ||
      runtimeRole.canReplicate
    ) {
      throw new Error(
        `DATABASE_RUNTIME_ROLE is not a restricted runtime login: ${config.runtimeRole}`,
      );
    }

    await admin.begin(async (transaction) => {
      await transaction`revoke create on schema public from public`;
      await transaction`
        revoke all privileges on schema public
        from ${transaction(config.runtimeRole)}
      `;
      await transaction`
        revoke all privileges on type organization_role
        from ${transaction(config.runtimeRole)}
      `;
      await transaction`
        revoke all privileges
        on users, auth_identities, organizations, org_members
        from ${transaction(config.runtimeRole)}
      `;
      await transaction`
        grant usage on schema public to ${transaction(config.runtimeRole)}
      `;
      await transaction`
        grant usage on type organization_role to ${transaction(config.runtimeRole)}
      `;
      await transaction`
        grant select, insert on users, auth_identities
        to ${transaction(config.runtimeRole)}
      `;
      await transaction`
        grant select, insert, update, delete
        on organizations, org_members
        to ${transaction(config.runtimeRole)}
      `;
    });
  } finally {
    await admin.end();
  }
}
