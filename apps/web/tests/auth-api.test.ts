import {
  AuthError,
  InMemoryAuthIdentityStore,
  createTestAuthProvider,
} from "@ship-tickets/auth";
import { describe, expect, it } from "vitest";

import { createLogoutHandler } from "../app/api/auth/logout/route";
import { createRequestOtpHandler } from "../app/api/auth/request-otp/route";
import { createVerifyOtpHandler } from "../app/api/auth/verify-otp/route";
import { createGetMeHandler } from "../app/api/me/route";

const PHONE = "+15555550123";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("phone login and GET /api/me", () => {
  it("creates an HttpOnly session and returns the normalized internal user", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const requestOtp = createRequestOtpHandler(provider);
    const requestResponse = await requestOtp(
      jsonRequest("http://localhost/api/auth/request-otp", { phone: PHONE }),
    );
    expect(requestResponse.status).toBe(202);

    const verifyOtp = createVerifyOtpHandler(provider);
    const verifyResponse = await verifyOtp(
      jsonRequest("http://localhost/api/auth/verify-otp", {
        phone: PHONE,
        code: provider.fixedOtpCodeForTesting,
      }),
    );
    const verified = (await verifyResponse.json()) as {
      user: { id: string };
    };

    expect(verifyResponse.status).toBe(200);
    expect(verified.user.id).toMatch(/^[0-9a-f-]{36}$/);

    const setCookie = verifyResponse.headers.getSetCookie();
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ship_tickets_access=.*HttpOnly/i),
        expect.stringMatching(/^ship_tickets_refresh=.*HttpOnly/i),
      ]),
    );

    const accessCookie = setCookie
      .find((cookie) => cookie.startsWith("ship_tickets_access="))
      ?.split(";", 1)[0];
    expect(accessCookie).toBeDefined();

    const getMe = createGetMeHandler(provider);
    const meResponse = await getMe(
      new Request("http://localhost/api/me", {
        headers: { cookie: accessCookie as string },
      }),
    );

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toEqual({ user: verified.user });
  });

  it("returns 401 when no session is present", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    const response = await createGetMeHandler(provider)(
      new Request("http://localhost/api/me"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
  });

  it("returns 401 for an invalid access token", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    const response = await createGetMeHandler(provider)(
      new Request("http://localhost/api/me", {
        headers: { authorization: "Bearer invalid-access-token" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("does not issue session cookies for an invalid OTP", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    await createRequestOtpHandler(provider)(
      jsonRequest("http://localhost/api/auth/request-otp", { phone: PHONE }),
    );

    const response = await createVerifyOtpHandler(provider)(
      jsonRequest("http://localhost/api/auth/verify-otp", {
        phone: PHONE,
        code: "111111",
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("revokes the provider session and clears both cookies on logout", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    await createRequestOtpHandler(provider)(
      jsonRequest("http://localhost/api/auth/request-otp", { phone: PHONE }),
    );
    const verifyResponse = await createVerifyOtpHandler(provider)(
      jsonRequest("http://localhost/api/auth/verify-otp", {
        phone: PHONE,
        code: provider.fixedOtpCodeForTesting,
      }),
    );
    const accessCookie = verifyResponse.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("ship_tickets_access="))
      ?.split(";", 1)[0];
    expect(accessCookie).toBeDefined();

    const response = await createLogoutHandler(provider)(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: accessCookie as string },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ship_tickets_access=;.*Max-Age=0/i),
        expect.stringMatching(/^ship_tickets_refresh=;.*Max-Age=0/i),
      ]),
    );

    const meResponse = await createGetMeHandler(provider)(
      new Request("http://localhost/api/me", {
        headers: { cookie: accessCookie as string },
      }),
    );
    expect(meResponse.status).toBe(401);
  });

  it("returns an explicit provider error", async () => {
    const response = await createGetMeHandler({
      getCurrentUser: async () => ({
        ok: false,
        error: new AuthError(
          "provider_error",
          "Authentication provider unavailable",
        ),
      }),
    })(
      new Request("http://localhost/api/me", {
        headers: { authorization: "Bearer unavailable-provider-token" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "provider_error",
        message: "Authentication provider unavailable",
      },
    });
  });

  it("rejects malformed request bodies", async () => {
    const provider = createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
    const response = await createRequestOtpHandler(provider)(
      new Request("http://localhost/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
  });
});
