import { loadDatabaseProvisionConfig } from "./config";
import { provisionRuntimeRole } from "./provision-runtime-role";

const config = loadDatabaseProvisionConfig(process.env);
await provisionRuntimeRole(config);
