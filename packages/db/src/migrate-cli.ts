import { fileURLToPath } from "node:url";

import { loadDatabaseConfig } from "./config";
import { migrateDatabase } from "./migrate";

const config = loadDatabaseConfig(process.env);
const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

await migrateDatabase({
  databaseUrl: config.databaseUrl,
  migrationsFolder,
});
