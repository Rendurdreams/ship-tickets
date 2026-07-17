export interface DatabaseHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
}

export interface DatabaseProvider {
  health(): Promise<DatabaseHealth>;
}

export { createDatabaseClient, type ShipTicketsDatabase } from "./client";
export { loadDatabaseConfig, type DatabaseConfig } from "./config";
export { migrateDatabase, type MigrateDatabaseOptions } from "./migrate";
export * from "./schema";
