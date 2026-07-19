import type { AuthProvider } from "@ship-tickets/auth";
import { NextResponse } from "next/server";

import { authErrorResponse } from "../../../../lib/auth/http";
import { getAuthProvider } from "../../../../lib/auth/runtime";

export function createRequestOtpHandler(provider: AuthProvider) {
  return async function requestOtp(request: Request): Promise<NextResponse> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null || !("phone" in body)) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Phone is required" } },
        { status: 400 },
      );
    }

    const phone = Reflect.get(body, "phone");
    const captchaToken = Reflect.get(body, "captchaToken");
    if (
      typeof phone !== "string" ||
      (captchaToken !== undefined && typeof captchaToken !== "string")
    ) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Invalid request" } },
        { status: 400 },
      );
    }

    const result = await provider.requestPhoneOtp({
      phone,
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (!result.ok) {
      return authErrorResponse(result.error);
    }

    return NextResponse.json({ requested: true }, { status: 202 });
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  return createRequestOtpHandler(await getAuthProvider())(request);
}
