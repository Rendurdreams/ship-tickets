import {
  InMemoryAuthIdentityStore,
  createSupabaseAuthProvider,
  createTestAuthProvider,
  loadAuthConfig,
  type AuthProvider,
} from "@ship-tickets/auth";
import {
  createAuthIdentityRepository,
  createDatabaseClient,
  loadDatabaseConfig,
} from "@ship-tickets/db";

interface AuthRuntimeGlobal {
  __shipTicketsAuthProviderPromise?: Promise<AuthProvider>;
}

const authRuntimeGlobal = globalThis as typeof globalThis & AuthRuntimeGlobal;

async function createAuthProvider(): Promise<AuthProvider> {
  const config = loadAuthConfig(process.env);

  if (config.provider === "mock") {
    return createTestAuthProvider({
      identityStore: new InMemoryAuthIdentityStore(),
    });
  }

  const database = await createDatabaseClient(loadDatabaseConfig(process.env));

  return createSupabaseAuthProvider({
    identityStore: createAuthIdentityRepository(database.db),
    supabaseUrl: config.supabaseUrl,
    supabasePublishableKey: config.supabasePublishableKey,
  });
}

/** One provider and bounded database pool per warm serverless instance. */
export function getAuthProvider(): Promise<AuthProvider> {
  if (!authRuntimeGlobal.__shipTicketsAuthProviderPromise) {
    const cachedProvider = createAuthProvider().catch((error: unknown) => {
      if (
        authRuntimeGlobal.__shipTicketsAuthProviderPromise === cachedProvider
      ) {
        delete authRuntimeGlobal.__shipTicketsAuthProviderPromise;
      }
      throw error;
    });
    authRuntimeGlobal.__shipTicketsAuthProviderPromise = cachedProvider;
  }

  return authRuntimeGlobal.__shipTicketsAuthProviderPromise;
}
