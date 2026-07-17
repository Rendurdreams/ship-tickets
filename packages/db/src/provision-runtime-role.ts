import postgres from "postgres";

import type { DatabaseProvisionConfig } from "./config";

interface ExistingRuntimeRole {
  readonly bypassesRls: boolean;
  readonly canLogin: boolean;
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

    if (
      runtimeRole.isSuperuser ||
      runtimeRole.bypassesRls ||
      runtimeRole.ownsApplicationTables
    ) {
      throw new Error(
        `DATABASE_RUNTIME_ROLE is not a restricted runtime login: ${config.runtimeRole}`,
      );
    }

    await admin.begin(async (transaction) => {
      await transaction`
        do $role$
        begin
          create role ship_tickets_app;
        exception
          when duplicate_object then null;
        end
        $role$
      `;
      await transaction`
        alter role ship_tickets_app
          nologin nosuperuser nocreatedb nocreaterole
          inherit noreplication nobypassrls
      `;
      await transaction`revoke create on schema public from public`;
      await transaction`
        revoke create on schema public from ${transaction(config.runtimeRole)}
      `;
      await transaction`grant usage on schema public to ship_tickets_app`;
      await transaction`
        grant usage on type organization_role to ship_tickets_app
      `;
      await transaction`
        grant select, insert on users, auth_identities to ship_tickets_app
      `;
      await transaction`
        grant select, insert, update, delete
        on organizations, org_members
        to ship_tickets_app
      `;
      await transaction`
        grant ship_tickets_app to ${transaction(config.runtimeRole)}
      `;
    });
  } finally {
    await admin.end();
  }
}
