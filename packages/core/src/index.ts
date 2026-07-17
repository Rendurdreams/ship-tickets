export type OrganizationRole = "owner" | "admin" | "staff";

export type TicketStatus = "issued" | "transferred" | "scanned" | "refunded";

export interface TenantContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: OrganizationRole;
}
