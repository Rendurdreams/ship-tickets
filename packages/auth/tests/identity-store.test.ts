import { describe, expect, it } from "vitest";

import { InMemoryAuthIdentityStore } from "../src/identity-store";

describe("InMemoryAuthIdentityStore", () => {
  it("returns null for an unknown (provider, subject) pair", async () => {
    const store = new InMemoryAuthIdentityStore();

    await expect(
      store.findIdentity("supabase_phone", "user-1"),
    ).resolves.toBeNull();
  });

  it("creates a new internal user and identity when none exists", async () => {
    const store = new InMemoryAuthIdentityStore();

    const created = await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "auth0-subject-1",
      phone: "+15551230000",
    });

    expect(created.provider).toBe("supabase_phone");
    expect(created.subject).toBe("auth0-subject-1");
    expect(created.userId).toEqual(expect.any(String));

    await expect(
      store.findIdentity("supabase_phone", "auth0-subject-1"),
    ).resolves.toEqual(created);
  });

  it("resolves the same (provider, subject) pair to the same internal user every time", async () => {
    const store = new InMemoryAuthIdentityStore();
    const created = await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "auth0-subject-2",
    });

    const first = await store.findIdentity("supabase_phone", "auth0-subject-2");
    const second = await store.findIdentity(
      "supabase_phone",
      "auth0-subject-2",
    );

    expect(first?.userId).toBe(created.userId);
    expect(second?.userId).toBe(created.userId);
  });

  it("rejects creating a second identity for a (provider, subject) pair that already exists", async () => {
    const store = new InMemoryAuthIdentityStore();
    await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "auth0-subject-3",
    });

    await expect(
      store.createUserWithIdentity({
        provider: "supabase_phone",
        subject: "auth0-subject-3",
      }),
    ).rejects.toMatchObject({ code: "identity_conflict" });
  });

  it("does not merge two identities into one internal user just because they share a phone number", async () => {
    const store = new InMemoryAuthIdentityStore();

    const first = await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "auth0-subject-4",
      phone: "+15551230000",
    });
    const second = await store.createUserWithIdentity({
      provider: "privy_wallet",
      subject: "wallet-subject-4",
      phone: "+15551230000",
    });

    expect(second.userId).not.toBe(first.userId);
  });

  it("does not merge two identities into one internal user just because they share an email address", async () => {
    const store = new InMemoryAuthIdentityStore();

    const first = await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject: "auth0-subject-5",
      email: "fan@example.com",
    });
    const second = await store.createUserWithIdentity({
      provider: "privy_wallet",
      subject: "wallet-subject-5",
      email: "fan@example.com",
    });

    expect(second.userId).not.toBe(first.userId);
  });

  it("treats the same subject under two different providers as two distinct identities", async () => {
    const store = new InMemoryAuthIdentityStore();
    const subject = "shared-subject-value";

    const supabaseIdentity = await store.createUserWithIdentity({
      provider: "supabase_phone",
      subject,
    });
    const privyIdentity = await store.createUserWithIdentity({
      provider: "privy_wallet",
      subject,
    });

    expect(privyIdentity.userId).not.toBe(supabaseIdentity.userId);
    await expect(
      store.findIdentity("supabase_phone", subject),
    ).resolves.toEqual(supabaseIdentity);
    await expect(store.findIdentity("privy_wallet", subject)).resolves.toEqual(
      privyIdentity,
    );
  });

  it("treats SQL-injection-shaped provider and subject values as exact opaque strings", async () => {
    const store = new InMemoryAuthIdentityStore();
    const maliciousSubject = "x' OR '1'='1";
    const maliciousProvider = "supabase_phone'; DROP TABLE users; --";

    const created = await store.createUserWithIdentity({
      provider: maliciousProvider,
      subject: maliciousSubject,
    });

    await expect(
      store.findIdentity(maliciousProvider, maliciousSubject),
    ).resolves.toEqual(created);

    // A near-miss value must not match — proves lookup is exact, not pattern-based.
    await expect(
      store.findIdentity(maliciousProvider, "x' OR '1'='2"),
    ).resolves.toBeNull();
    await expect(
      store.findIdentity("supabase_phone", maliciousSubject),
    ).resolves.toBeNull();
  });
});
