import { afterEach, describe, expect, it, vi } from "vitest";

interface AuthRuntimeGlobal {
  __shipTicketsAuthProviderPromise?: unknown;
}

const authRuntimeGlobal = globalThis as typeof globalThis & AuthRuntimeGlobal;
const originalEnvironment = {
  AUTH_PROVIDER: process.env.AUTH_PROVIDER,
  DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE,
  NODE_ENV: process.env.NODE_ENV,
};

function setEnvironment(
  name: keyof typeof originalEnvironment,
  value: string | undefined,
): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    Reflect.set(process.env, name, value);
  }
}

afterEach(() => {
  vi.resetModules();
  delete authRuntimeGlobal.__shipTicketsAuthProviderPromise;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    setEnvironment(name as keyof typeof originalEnvironment, value);
  }
});

describe("web auth runtime", () => {
  it("shares the development provider across Next.js module graphs", async () => {
    setEnvironment("AUTH_PROVIDER", "mock");
    setEnvironment("DEPLOYMENT_MODE", "development");
    setEnvironment("NODE_ENV", "test");

    const firstRuntime = await import("../lib/auth/runtime");
    const firstProvider = await firstRuntime.getAuthProvider();

    vi.resetModules();
    const secondRuntime = await import("../lib/auth/runtime");
    const secondProvider = await secondRuntime.getAuthProvider();

    expect(secondProvider).toBe(firstProvider);
  });
});
