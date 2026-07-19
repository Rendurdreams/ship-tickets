import type { AuthError } from "@ship-tickets/auth";
import { NextResponse } from "next/server";

function authErrorStatus(code: string): number {
  if (code === "rate_limited") return 429;
  if (code === "provider_error") return 503;
  return 400;
}

export function authErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: authErrorStatus(error.code) },
  );
}
