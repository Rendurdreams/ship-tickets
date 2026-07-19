"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main role="alert">
      <h1>Dashboard unavailable</h1>
      <p>We could not load your dashboard.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
