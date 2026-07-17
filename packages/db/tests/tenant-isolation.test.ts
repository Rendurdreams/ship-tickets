import { sql as drizzleSql } from "drizzle-orm";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../src/client";
import { migrateDatabase } from "../src/migrate";
import { provisionRuntimeRole } from "../src/provision-runtime-role";
import { withTenant } from "../src/tenant";
import {
  startPostgresTestContainer,
  type PostgresTestContainer,
} from "./postgres-container";
import { migrationsFolder } from "./test-paths";

const ORG_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";
const RUNTIME_ROLE = "ship_tickets_tenant_test";
const RUNTIME_PASSWORD = "tenant_test_password";

let admin: Sql;
let container: PostgresTestContainer;
let runtime: Sql;
let runtimeDatabaseUrl: string;

beforeAll(async () => {
  container = await startPostgresTestContainer();
  await migrateDatabase({
    databaseUrl: container.databaseUrl,
    migrationsFolder,
  });

  admin = postgres(container.databaseUrl, { max: 1 });
  await admin`
    create role ship_tickets_tenant_test
    login password 'tenant_test_password'
    nosuperuser nocreatedb nocreaterole noreplication nobypassrls
  `;
  await provisionRuntimeRole({
    databaseUrl: container.databaseUrl,
    runtimeRole: RUNTIME_ROLE,
  });

  const runtimeUrl = new URL(container.databaseUrl);
  runtimeUrl.username = RUNTIME_ROLE;
  runtimeUrl.password = RUNTIME_PASSWORD;
  runtimeDatabaseUrl = runtimeUrl.toString();
  runtime = postgres(runtimeDatabaseUrl, { max: 1, prepare: false });

  await admin.begin(async (sql) => {
    await sql`
      insert into users (id, display_name)
      values
        (${USER_A_ID}, 'Tenant A user'),
        (${USER_B_ID}, 'Tenant B user')
    `;
    await sql`
      insert into auth_identities (user_id, provider, subject)
      values (${USER_A_ID}, 'supabase', 'supabase-user-a')
    `;
    await sql`
      insert into organizations (id, name, slug)
      values
        (${ORG_A_ID}, 'Tenant A', 'tenant-a'),
        (${ORG_B_ID}, 'Tenant B', 'tenant-b')
    `;
    await sql`
      insert into org_members (org_id, user_id, role)
      values
        (${ORG_A_ID}, ${USER_A_ID}, 'owner'),
        (${ORG_B_ID}, ${USER_B_ID}, 'owner')
    `;
  });
}, 120_000);

afterAll(async () => {
  await runtime?.end();
  await admin?.end();
  await container?.stop();
});

describe("tenant row-level security", () => {
  it("hides memberships owned by another organization", async () => {
    const rows = await runtime.begin(async (sql) => {
      await sql`select set_config('app.current_org_id', ${ORG_A_ID}, true)`;

      return sql<{ org_id: string }[]>`
        select org_id
        from org_members
        order by org_id
      `;
    });

    expect(rows.map((row) => row.org_id)).toEqual([ORG_A_ID]);
  });

  it("hides another organization's root record", async () => {
    const rows = await runtime.begin(async (sql) => {
      await sql`select set_config('app.current_org_id', ${ORG_A_ID}, true)`;

      return sql<{ id: string }[]>`
        select id
        from organizations
        order by id
      `;
    });

    expect(rows.map((row) => row.id)).toEqual([ORG_A_ID]);
  });

  it("keeps tenant context local to one transaction", async () => {
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const insideTenant = await withTenant(
        client.db,
        ORG_A_ID,
        async (transaction) => {
          const rows = await transaction.execute(
            drizzleSql`select current_setting('app.current_org_id', true) as org_id`,
          );

          return rows[0]?.org_id;
        },
      );
      const rowsAfterTransaction = await client.db.execute(
        drizzleSql`select current_setting('app.current_org_id', true) as org_id`,
      );

      expect(insideTenant).toBe(ORG_A_ID);
      expect(rowsAfterTransaction[0]?.org_id ?? "").toBe("");
    } finally {
      await client.close();
    }
  });

  it("clears tenant context after a transaction rolls back", async () => {
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      await expect(
        withTenant(client.db, ORG_A_ID, async (transaction) => {
          const rows = await transaction.execute(
            drizzleSql`select current_setting('app.current_org_id', true) as org_id`,
          );
          expect(rows[0]?.org_id).toBe(ORG_A_ID);
          throw new Error("rollback tenant transaction");
        }),
      ).rejects.toThrow("rollback tenant transaction");

      const rowsAfterRollback = await client.db.execute(
        drizzleSql`
          select
            current_setting('app.current_org_id', true) as org_id,
            current_user as role
        `,
      );

      expect(rowsAfterRollback[0]?.org_id ?? "").toBe("");
      expect(rowsAfterRollback[0]?.role).toBe(RUNTIME_ROLE);
    } finally {
      await client.close();
    }
  });

  it("returns no tenant rows when runtime context is missing", async () => {
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const rows = await client.db.execute(
        drizzleSql`select id from organizations order by id`,
      );

      expect(rows).toHaveLength(0);
    } finally {
      await client.close();
    }
  });

  it("treats an injection-shaped slug as an exact value", async () => {
    const { createOrganizationRepository } =
      await import("../src/repositories/organizations");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const organization = await withTenant(
        client.db,
        ORG_A_ID,
        async (transaction) => {
          const repository = createOrganizationRepository(transaction);

          return repository.findBySlug(ORG_A_ID, "tenant-a' OR '1' = '1' --");
        },
      );

      expect(organization).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("prevents a tenant from renaming another organization", async () => {
    const { createOrganizationRepository } =
      await import("../src/repositories/organizations");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const updated = await withTenant(
        client.db,
        ORG_A_ID,
        async (transaction) => {
          const repository = createOrganizationRepository(transaction);

          return repository.rename(ORG_B_ID, "Compromised");
        },
      );
      const rows = await admin<{ name: string }[]>`
        select name from organizations where id = ${ORG_B_ID}
      `;

      expect(updated).toBeNull();
      expect(rows[0]?.name).toBe("Tenant B");
    } finally {
      await client.close();
    }
  });

  it("treats an injection-shaped provider subject as an exact value", async () => {
    const { createAuthIdentityRepository } =
      await import("../src/repositories/auth-identities");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const repository = createAuthIdentityRepository(client.db);
      const identity = await repository.findIdentity(
        "supabase",
        "supabase-user-a' OR '1' = '1' --",
      );

      expect(identity).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("lists memberships only through an explicit organization scope", async () => {
    const { createMembershipRepository } =
      await import("../src/repositories/memberships");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const memberships = await withTenant(
        client.db,
        ORG_A_ID,
        async (transaction) => {
          const repository = createMembershipRepository(transaction);

          return repository.listByOrganization(ORG_A_ID);
        },
      );

      expect(memberships).toEqual([
        expect.objectContaining({ orgId: ORG_A_ID, userId: USER_A_ID }),
      ]);
    } finally {
      await client.close();
    }
  });

  it("atomically creates an internal user with an external identity", async () => {
    const { createAuthIdentityRepository } =
      await import("../src/repositories/auth-identities");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const repository = createAuthIdentityRepository(client.db);
      const identity = await repository.createUserWithIdentity({
        provider: "supabase_phone",
        subject: "new-supabase-subject",
        phone: "+15555550123",
      });
      const resolvedIdentity = await repository.findIdentity(
        "supabase_phone",
        "new-supabase-subject",
      );
      const rows = await admin<
        { phone: string | null; provider: string; subject: string }[]
      >`
        select users.phone, auth_identities.provider, auth_identities.subject
        from auth_identities
        inner join users on users.id = auth_identities.user_id
        where auth_identities.user_id = ${identity.userId}
      `;

      expect(identity).toMatchObject({
        provider: "supabase_phone",
        subject: "new-supabase-subject",
      });
      expect(resolvedIdentity).toEqual(identity);
      expect(rows).toEqual([
        {
          phone: "+15555550123",
          provider: "supabase_phone",
          subject: "new-supabase-subject",
        },
      ]);
    } finally {
      await client.close();
    }
  });

  it("does not merge identities by matching phone or email", async () => {
    const { createAuthIdentityRepository } =
      await import("../src/repositories/auth-identities");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const repository = createAuthIdentityRepository(client.db);
      const first = await repository.createUserWithIdentity({
        email: "same-person@example.test",
        phone: "+15555550999",
        provider: "supabase_phone",
        subject: "no-merge-subject-a",
      });
      const second = await repository.createUserWithIdentity({
        email: "same-person@example.test",
        phone: "+15555550999",
        provider: "supabase_phone",
        subject: "no-merge-subject-b",
      });

      expect(second.userId).not.toBe(first.userId);
    } finally {
      await client.close();
    }
  });

  it("rejects a duplicate identity without creating an orphan user", async () => {
    const { createAuthIdentityRepository } =
      await import("../src/repositories/auth-identities");
    const client = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });

    try {
      const repository = createAuthIdentityRepository(client.db);
      const input = {
        phone: "+15555550888",
        provider: "supabase_phone",
        subject: "duplicate-subject",
      } as const;

      await repository.createUserWithIdentity(input);
      const usersBefore = await admin<{ count: number }[]>`
        select count(*)::integer as count
        from users
        where phone = ${input.phone}
      `;

      await expect(
        repository.createUserWithIdentity(input),
      ).rejects.toMatchObject({ code: "identity_conflict" });

      const usersAfter = await admin<{ count: number }[]>`
        select count(*)::integer as count
        from users
        where phone = ${input.phone}
      `;

      expect(usersBefore[0]?.count).toBe(1);
      expect(usersAfter[0]?.count).toBe(usersBefore[0]?.count);
    } finally {
      await client.close();
    }
  });

  it("serializes concurrent creation of the same external identity", async () => {
    const { createAuthIdentityRepository } =
      await import("../src/repositories/auth-identities");
    const firstClient = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });
    const secondClient = await createDatabaseClient({
      databaseUrl: runtimeDatabaseUrl,
      maxConnections: 1,
      prepareStatements: false,
    });
    const input = {
      phone: "+15555550777",
      provider: "supabase_phone",
      subject: "concurrent-subject",
    } as const;

    try {
      const results = await Promise.allSettled([
        createAuthIdentityRepository(firstClient.db).createUserWithIdentity(
          input,
        ),
        createAuthIdentityRepository(secondClient.db).createUserWithIdentity(
          input,
        ),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter((result) => result.status === "rejected");
      const usersWithPhone = await admin<{ count: number }[]>`
        select count(*)::integer as count
        from users
        where phone = ${input.phone}
      `;

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: { code: "identity_conflict" },
      });
      expect(usersWithPhone[0]?.count).toBe(1);
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
  });
});
