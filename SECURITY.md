# Security Policy

## Supported versions

The `main` branch is the supported version. Security fixes land on `main` first.

## Reporting a vulnerability

Do not open a public issue with exploit details. Use GitHub's **Report a vulnerability** tab on this repository (Security tab → Report a vulnerability) so the report stays private until a fix is ready.

## What this project protects

DMFlow handles sensitive material by design: encrypted Instagram OAuth tokens, webhook signature validation, and user conversation data in PostgreSQL. Contributions must keep these boundaries:

- No Instagram password collection, no unofficial Instagram API.
- Tokens stay encrypted at rest; secrets only via environment variables, never committed.
- Webhook payloads are signature-validated and deduplicated before any action.
