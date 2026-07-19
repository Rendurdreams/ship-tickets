import type { AuthProvider, AuthenticatedUser } from "@ship-tickets/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAuthProvider } from "../../lib/auth/runtime";
import { ACCESS_COOKIE } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

interface DashboardPageDependencies {
  readonly getCurrentUser: AuthProvider["getCurrentUser"];
  readonly readAccessToken: () => Promise<string | null>;
  readonly redirect: (path: string) => never;
}

export function DashboardShell({ user }: { user: AuthenticatedUser }) {
  return (
    <main>
      <p>Ship Tickets</p>
      <h1>Dashboard</h1>
      <p>You are signed in.</p>
      <dl>
        <dt>Internal user ID</dt>
        <dd>{user.id}</dd>
      </dl>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}

function DashboardProviderError({ message }: { message: string }) {
  return (
    <main role="alert">
      <h1>Dashboard unavailable</h1>
      <p>{message}</p>
    </main>
  );
}

export async function renderDashboardPage(
  dependencies: DashboardPageDependencies,
): Promise<ReactNode> {
  const accessToken = await dependencies.readAccessToken();
  if (!accessToken) return dependencies.redirect("/login");

  const result = await dependencies.getCurrentUser({ accessToken });
  if (!result.ok) {
    return <DashboardProviderError message={result.error.message} />;
  }
  if (!result.value) return dependencies.redirect("/login");

  return <DashboardShell user={result.value} />;
}

export default async function DashboardPage() {
  const provider = await getAuthProvider();

  return renderDashboardPage({
    getCurrentUser: provider.getCurrentUser,
    readAccessToken: async () => {
      const cookieStore = await cookies();
      return cookieStore.get(ACCESS_COOKIE)?.value ?? null;
    },
    redirect,
  });
}
