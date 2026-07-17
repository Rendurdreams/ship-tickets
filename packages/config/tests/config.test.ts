import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/index";

describe("loadConfig", () => {
  it("rejects a Ship Tickets platform fee in self-hosted mode", () => {
    expect(() =>
      loadConfig({
        DEPLOYMENT_MODE: "self_hosted",
        PLATFORM_FEE_CENTS: "222",
      }),
    ).toThrow(/self-hosted deployments cannot charge/i);
  });

  it("defaults Mixt Hosted to a $2.22 fee per paid ticket", () => {
    const config = loadConfig({ DEPLOYMENT_MODE: "mixt_hosted" });

    expect(config.platformFeeCents).toBe(222);
  });
});
