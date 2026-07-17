import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../src/client";
import { migrateDatabase } from "../src/migrate";
import { provisionRuntimeRole } from "../src/provision-runtime-role";
import {
  startPostgresTestContainer,
  type PostgresTestContainer,
} from "./postgres-container";
import { migrationsFolder } from "./test-paths";

const RUNTIME_ROLE = "ship_tickets_runtime_test";
const RUNTIME_PASSWORD = "runtime_test_password";

let admin: Sql;
let container: PostgresTestContainer;
let runtimeDatabaseUrl: string;

beforeAll(async () => {
  container = await startPostgresTestContainer();
  await migrateDatabase({
    databaseUrl: container.databaseUrl,
    migrationsFolder,
  });
  admin = postgres(container.databaseUrl, { max: 1 });
  await admin`
    create role ship_tickets_runtime_test
    login password 'runtime_test_password'
    nosuperuser nocreatedb nocreaterole noreplication nobypassrls
  `;

  const runtimeUrl = new URL(container.databaseUrl);
  runtimeUrl.username = RUNTIME_ROLE;
  runtimeUrl.password = RUNTIME_PASSWORD;
  runtimeDatabaseUrl = runtimeUrl.toString();
}, 120_000);

afterAll(async () => {
  await admin?.end();
  await container?.stop();
});

describe("provisionRuntimeRole", () => {
  it("provisions an existing restricted login idempotently", async () => {
    await provisionRuntimeRole({
      databaseUrl: container.databaseUrl,
      runtimeRole: RUNTIME_ROLE,
    });
    await provisionRuntimeRole({
      databaseUrl: container.databaseUrl,
      runtimeRole: RUNTIME_ROLE,
    });

    const runtime = postgres(runtimeDatabaseUrl, { max: 1 });

    try {
      const [state] = await runtime<
        {
          bypasses_rls: boolean;
          can_create_public: boolean;
          has_auth_privileges: boolean;
          has_tenant_privileges: boolean;
          is_superuser: boolean;
          role: string;
        }[]
      >`
        select
          current_user as role,
          roles.rolsuper as is_superuser,
          roles.rolbypassrls as bypasses_rls,
          has_schema_privilege(current_user, 'public', 'create') as can_create_public,
          has_table_privilege(
            current_user,
            'users',
            'select, insert'
          ) and has_table_privilege(
            current_user,
            'auth_identities',
            'select, insert'
          ) as has_auth_privileges,
          has_table_privilege(
            current_user,
            'organizations',
            'select, insert, update, delete'
          ) and has_table_privilege(
            current_user,
            'org_members',
            'select, insert, update, delete'
          ) as has_tenant_privileges
        from pg_roles roles
        where roles.rolname = current_user
      `;

      expect(state).toEqual({
        bypasses_rls: false,
        can_create_public: false,
        has_auth_privileges: true,
        has_tenant_privileges: true,
        is_superuser: false,
        role: RUNTIME_ROLE,
      });
      await expect(
        runtime`create table public.runtime_must_not_create_objects (id integer)`,
      ).rejects.toThrow();
    } finally {
      await runtime.end();
    }
  });

  it("refuses to provision a login that does not exist", async () => {
    await expect(
      provisionRuntimeRole({
        databaseUrl: container.databaseUrl,
        runtimeRole: "missing_runtime_login",
      }),
    ).rejects.toThrow(/existing login/);
  });

  it("rejects an owner runtime URL and accepts the provisioned login", async () => {
    await provisionRuntimeRole({
      databaseUrl: container.databaseUrl,
      runtimeRole: RUNTIME_ROLE,
    });

    await expect(
      createDatabaseClient({
        databaseUrl: container.databaseUrl,
        maxConnections: 1,
        prepareStatements: false,
      }),
    ).rejects.toThrow(/DATABASE_URL/);

    const runtimeClient = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });
    await runtimeClient.close();
  });
});
