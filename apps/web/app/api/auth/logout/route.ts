import type { AuthProvider } from "@ship-tickets/auth";
import { NextResponse } from "next/server";

import { authErrorResponse } from "../../../../lib/auth/http";
import { getAuthProvider } from "../../../../lib/auth/runtime";
import {
  clearSessionCookies,
  readAccessToken,
} from "../../../../lib/auth/session";

export function createLogoutHandler(provider: AuthProvider) {
  return async function logout(request: Request): Promise<NextResponse> {
    const accessToken = readAccessToken(request);
    let response: NextResponse;

    if (accessToken) {
      const result = await provider.logout({ accessToken });
      response =
        !result.ok && result.error.code !== "invalid_session"
          ? authErrorResponse(result.error)
          : NextResponse.redirect(new URL("/login", request.url), 303);
    } else {
      response = NextResponse.redirect(new URL("/login", request.url), 303);
    }

    clearSessionCookies(response);
    return response;
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  return createLogoutHandler(await getAuthProvider())(request);
}
