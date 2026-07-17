# Security Policy

Ticketing handles identity, money, inventory, and physical entry. Security reports are treated as operationally sensitive.

## Reporting a vulnerability

Do **not** open a public issue.

Use GitHub's private vulnerability reporting from the repository **Security** tab. Include:

- Affected route, package, or commit.
- Reproduction steps or a minimal proof of concept.
- Expected impact.
- Any suggested mitigation.

Do not access data that is not yours, disrupt a live event, perform denial-of-service testing, or publish details before a coordinated disclosure date.

## Supported versions

Before the first stable release, security fixes are applied to the latest `main` branch only.

## Secrets boundary

The public repository may contain schemas, cryptographic algorithms, and safe defaults. It must never contain production signing keys, Stripe secrets, database credentials, private rate-limit thresholds, customer data, or wallet authority keys.
