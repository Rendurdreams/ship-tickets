import { describe, expect, it } from "vitest";

import { calculatePlatformFee } from "../src/index";

describe("calculatePlatformFee", () => {
  it("charges $2.22 for every paid ticket on Mixt Hosted", () => {
    expect(
      calculatePlatformFee({
        deploymentMode: "mixt_hosted",
        paidTicketCount: 3,
        platformFeeCents: 222,
      }),
    ).toBe(666);
  });

  it("does not charge a Ship Tickets fee in self-hosted mode", () => {
    expect(
      calculatePlatformFee({
        deploymentMode: "self_hosted",
        paidTicketCount: 3,
        platformFeeCents: 222,
      }),
    ).toBe(0);
  });

  it("does not charge a fee when every ticket is free", () => {
    expect(
      calculatePlatformFee({
        deploymentMode: "mixt_hosted",
        paidTicketCount: 0,
        platformFeeCents: 222,
      }),
    ).toBe(0);
  });
});
