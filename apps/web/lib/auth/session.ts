import type { AuthSession } from "@ship-tickets/auth";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "ship_tickets_access";
export const REFRESH_COOKIE = "ship_tickets_refresh";

function cookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function readAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim() || null;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === ACCESS_COOKIE) {
      const value = valueParts.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export function writeSessionCookies(
  response: NextResponse,
  session: AuthSession,
): void {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    ...cookieOptions(),
    ...(session.expiresAt === null
      ? {}
      : { expires: new Date(session.expiresAt * 1000) }),
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions());
}

export function clearSessionCookies(response: NextResponse): void {
  const options = {
    ...cookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  };
  response.cookies.set(ACCESS_COOKIE, "", options);
  response.cookies.set(REFRESH_COOKIE, "", options);
}
