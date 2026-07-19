import type { AuthProvider } from "@ship-tickets/auth";
import { NextResponse } from "next/server";

import { getAuthProvider } from "../../../lib/auth/runtime";
import { readAccessToken } from "../../../lib/auth/session";

const UNAUTHORIZED = {
  error: { code: "unauthorized", message: "Authentication required" },
};

export function createGetMeHandler(
  provider: Pick<AuthProvider, "getCurrentUser">,
) {
  return async function getMe(request: Request): Promise<NextResponse> {
    const accessToken = readAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(UNAUTHORIZED, { status: 401 });
    }

    const result = await provider.getCurrentUser({ accessToken });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: result.error.code === "provider_error" ? 503 : 401 },
      );
    }
    if (!result.value) {
      return NextResponse.json(UNAUTHORIZED, { status: 401 });
    }

    return NextResponse.json({ user: result.value });
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  return createGetMeHandler(await getAuthProvider())(request);
}
