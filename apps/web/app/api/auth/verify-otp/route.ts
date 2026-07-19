import type { AuthProvider } from "@ship-tickets/auth";
import { NextResponse } from "next/server";

import { authErrorResponse } from "../../../../lib/auth/http";
import { getAuthProvider } from "../../../../lib/auth/runtime";
import { writeSessionCookies } from "../../../../lib/auth/session";

export function createVerifyOtpHandler(provider: AuthProvider) {
  return async function verifyOtp(request: Request): Promise<NextResponse> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Invalid request" } },
        { status: 400 },
      );
    }

    const phone = Reflect.get(body, "phone");
    const code = Reflect.get(body, "code");
    if (typeof phone !== "string" || typeof code !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "Phone and code are required",
          },
        },
        { status: 400 },
      );
    }

    const result = await provider.verifyPhoneOtp({ phone, code });
    if (!result.ok) {
      return authErrorResponse(result.error);
    }

    const response = NextResponse.json({
      user: { id: result.value.userId },
    });
    writeSessionCookies(response, result.value);
    return response;
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  return createVerifyOtpHandler(await getAuthProvider())(request);
}
