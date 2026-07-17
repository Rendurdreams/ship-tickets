import { loadConfig } from "@ship-tickets/config";

export function GET(): Response {
  const config = loadConfig(process.env);

  return Response.json({
    status: "ok",
    service: "ship-tickets",
    deploymentMode: config.deploymentMode,
  });
}
