export type PaymentDeploymentMode =
  "development" | "self_hosted" | "mixt_hosted";

export interface PlatformFeeInput {
  readonly deploymentMode: PaymentDeploymentMode;
  readonly paidTicketCount: number;
  readonly platformFeeCents: number;
}

export function calculatePlatformFee({
  deploymentMode,
  paidTicketCount,
  platformFeeCents,
}: PlatformFeeInput): number {
  if (deploymentMode === "self_hosted" || paidTicketCount === 0) {
    return 0;
  }

  return paidTicketCount * platformFeeCents;
}
