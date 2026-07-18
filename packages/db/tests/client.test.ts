import { describe, expect, it } from "vitest";

import {
  assertRuntimeSecurityState,
  toPostgresOptions,
  type RuntimeSecurityState,
} from "../src/client";

const secureRuntimeState: RuntimeSecurityState = {
  bypassesRls: false,
  canCreateDatabases: false,
  canCreatePublic: false,
  canCreateRoles: false,
  canReplicate: false,
  hasRequiredTablePrivileges: true,
  hasRoleMemberships: false,
  hasRoleOverride: false,
  isSuperuser: false,
  ownsApplicationTables: false,
  role: "ship_tickets_runtime",
};

describe("toPostgresOptions", () => {
  it("maps the typed database policy to PostgreSQL.js options", () => {
    expect(
      toPostgresOptions({
        databaseUrl: "postgresql://localhost/ship_tickets",
        maxConnections: 1,
        prepareStatements: false,
      }),
    ).toEqual({
      max: 1,
      prepare: false,
    });
  });
});

describe("assertRuntimeSecurityState", () => {
  it("accepts a restricted runtime role with the required table grants", () => {
    expect(() => assertRuntimeSecurityState(secureRuntimeState)).not.toThrow();
  });

  it.each([
    ["superuser", { isSuperuser: true }],
    ["BYPASSRLS", { bypassesRls: true }],
    ["database creator", { canCreateDatabases: true }],
    ["role creator", { canCreateRoles: true }],
    ["replication role", { canReplicate: true }],
    ["role member", { hasRoleMemberships: true }],
    ["default-role override", { hasRoleOverride: true }],
    ["application-table owner", { ownsApplicationTables: true }],
    ["public-schema creator", { canCreatePublic: true }],
    ["incomplete table grants", { hasRequiredTablePrivileges: false }],
  ])("rejects a %s runtime connection", (_label, unsafeState) => {
    expect(() =>
      assertRuntimeSecurityState({
        ...secureRuntimeState,
        ...unsafeState,
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
