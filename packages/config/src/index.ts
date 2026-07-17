import { z } from "zod";

const ConfigInputSchema = z.object({
  DEPLOYMENT_MODE: z
    .enum(["development", "self_hosted", "mixt_hosted"])
    .default("development"),
  PLATFORM_FEE_CENTS: z.coerce.number().int().nonnegative().optional(),
});

export type DeploymentMode = z.infer<
  typeof ConfigInputSchema
>["DEPLOYMENT_MODE"];

export interface AppConfig {
  readonly deploymentMode: DeploymentMode;
  readonly platformFeeCents: number;
}

export function loadConfig(
  environment: Record<string, string | undefined>,
): AppConfig {
  const parsed = ConfigInputSchema.parse(environment);
  const platformFeeCents =
    parsed.PLATFORM_FEE_CENTS ??
    (parsed.DEPLOYMENT_MODE === "mixt_hosted" ? 222 : 0);

  if (parsed.DEPLOYMENT_MODE === "self_hosted" && platformFeeCents !== 0) {
    throw new Error(
      "Self-hosted deployments cannot charge a Ship Tickets platform fee.",
    );
  }

  return {
    deploymentMode: parsed.DEPLOYMENT_MODE,
    platformFeeCents,
  };
}
