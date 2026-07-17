import { fileURLToPath } from "node:url";

import { loadDatabaseMigrationConfig } from "./config";
import { migrateDatabase } from "./migrate";

const config = loadDatabaseMigrationConfig(process.env);
const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

await migrateDatabase({
  databaseUrl: config.databaseUrl,
  migrationsFolder,
});
