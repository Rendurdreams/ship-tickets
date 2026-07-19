import { AuthError } from "@ship-tickets/auth";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DashboardError from "../app/dashboard/error";
import DashboardLoading from "../app/dashboard/loading";
import { DashboardShell, renderDashboardPage } from "../app/dashboard/page";
import { PhoneLoginForm } from "../app/login/phone-login-form";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("protected dashboard", () => {
  it("redirects an anonymous request to login", async () => {
    const redirect = vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      renderDashboardPage({
        readAccessToken: async () => null,
        getCurrentUser: vi.fn(),
        redirect,
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders the normalized internal user", async () => {
    const result = await renderDashboardPage({
      readAccessToken: async () => "valid-access-token",
      getCurrentUser: async () => ({ ok: true, value: { id: USER_ID } }),
      redirect: vi.fn(() => {
        throw new Error("unexpected redirect");
      }),
    });

    const html = renderToStaticMarkup(result);
    expect(html).toContain("Dashboard");
    expect(html).toContain(USER_ID);
  });

  it("renders explicit provider, loading, and route error states", async () => {
    const providerError = await renderDashboardPage({
      readAccessToken: async () => "provider-error-token",
      getCurrentUser: async () => ({
        ok: false,
        error: new AuthError(
          "provider_error",
          "Authentication provider unavailable",
        ),
      }),
      redirect: vi.fn(() => {
        throw new Error("unexpected redirect");
      }),
    });

    expect(renderToStaticMarkup(providerError)).toContain(
      "Authentication provider unavailable",
    );
    expect(renderToStaticMarkup(<DashboardLoading />)).toContain(
      "Loading dashboard",
    );
    expect(
      renderToStaticMarkup(
        <DashboardError error={new Error("boom")} reset={() => undefined} />,
      ),
    ).toContain("Dashboard unavailable");
    expect(
      renderToStaticMarkup(<DashboardShell user={{ id: USER_ID }} />),
    ).toContain(USER_ID);
  });

  it("renders the phone-code login action", () => {
    const html = renderToStaticMarkup(<PhoneLoginForm />);

    expect(html).toContain("Phone number");
    expect(html).toContain("Send code");
  });
});
