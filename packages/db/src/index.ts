export interface DatabaseHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
}

export interface DatabaseProvider {
  health(): Promise<DatabaseHealth>;
}

export {
  assertRuntimeSecurityState,
  createDatabaseClient,
  type RuntimeSecurityState,
  type ShipTicketsDatabase,
} from "./client";
export {
  loadDatabaseConfig,
  loadDatabaseMigrationConfig,
  loadDatabaseProvisionConfig,
  type DatabaseConfig,
  type DatabaseMigrationConfig,
  type DatabaseProvisionConfig,
} from "./config";
export { migrateDatabase, type MigrateDatabaseOptions } from "./migrate";
export { provisionRuntimeRole } from "./provision-runtime-role";
export {
  AuthIdentityConflictError,
  createAuthIdentityRepository,
  type AuthIdentityRecord,
  type AuthIdentityRepository,
  type CreateUserWithIdentityInput,
} from "./repositories/auth-identities";
export {
  createMembershipRepository,
  type MembershipRepository,
} from "./repositories/memberships";
export {
  createOrganizationRepository,
  type OrganizationRepository,
} from "./repositories/organizations";
export * from "./schema";
export { withTenant, type TenantTransaction } from "./tenant";
