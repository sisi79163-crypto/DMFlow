# DMFlow

Source: https://github.com/sisi79163-crypto/DMFlow

A bilingual, mobile-first Instagram automation workspace built with Next.js, TypeScript, Tailwind CSS, PostgreSQL and Prisma. It includes a real application backend and a durable PostgreSQL worker queue. No mock analytics, no Instagram password collection, no unofficial Instagram API.

**Status:** implementation ready for local integration testing and deployment configuration. Live Meta connection, external AI provider, hosting require the operator’s actual accounts/configuration. This repository does not claim Meta approval or a completed production rollout.

## Included

- Email/password registration and login, bcrypt password hashes, hashed session records, HttpOnly cookies and origin checks.
- Multi-account Instagram OAuth, encrypted tokens, refresh job and media sync.
- Per-post/Reel keyword or any-comment automation, optional public reply, cooldown, schedules and business hours.
- Visual flow editor: comment → private reply → wait → message/question → yes/no condition → link/tag. Saved graphs drive the worker.
- Real webhook ingestion with signature validation, deduplication, database-backed jobs and retries.
- Inbox for incoming text events, manual responses inside the messaging window, per-conversation AI pause.
- CRM, tags, status, contact search/filter/pagination, stored source comment/post.
- Database-driven dashboard, 30-day activity chart, conversion counts, campaign/A/B send totals, tracked-link click counts.
- Knowledge base and configurable AI provider adapter. Draft mode and explicit auto mode.
- Arabic/English interface, RTL, responsive mobile navigation and dark mode.
- Activity/audit logs, webhook logs, in-app notifications, account disconnect and data deletion.
- Initial database migration, Docker targets/Compose, Vercel configuration, daily backup container and GitHub CI.

## Quick start

Prerequisites: Node.js 22+, npm, PostgreSQL 16+; Docker is optional.

```sh
npm ci
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Place the generated value in `TOKEN_ENCRYPTION_KEY`. Keep it stable: changing it without re-encrypting tokens requires reconnecting accounts. Fill `DATABASE_URL` and `APP_URL`. Set `REGISTRATION_ENABLED=true` for initial owner registration.

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000, create an account, then run the worker in a second terminal with the same environment:

```sh
node --env-file=.env --import tsx workers/index.ts
```

`npm run worker` assumes environment variables are injected by Docker/your host. Next.js loads `.env` for its own process; the separate worker must receive it explicitly.

For Docker, set `POSTGRES_PASSWORD` in `.env` then run `docker compose up --build -d`. See [deployment](docs/deployment.md) for domain/TLS, worker, database and backups.

## Environment

| Variable                         | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                   | PostgreSQL connection; use TLS outside the internal Compose network |
| `APP_URL`                        | Exact public origin, no trailing slash                              |
| `TOKEN_ENCRYPTION_KEY`           | Base64-encoded random 32-byte AES-GCM key                           |
| `META_APP_ID`, `META_APP_SECRET` | Instagram Login application credentials                             |
| `META_API_VERSION`               | Explicit supported Graph API version selected in Meta               |
| `META_WEBHOOK_VERIFY_TOKEN`      | Random webhook verification string                                  |
| `META_SENDS_PER_HOUR`            | Conservative per-account send budget, default 200                   |
| `AI_BASE_URL`                    | HTTPS OpenAI-compatible endpoint base, `/v1` if required            |
| `AI_API_KEY`, `AI_MODEL`         | Optional server-only provider credentials/model                     |
| `REGISTRATION_ENABLED`           | `true` only while accepting new owners                              |
| `POSTGRES_PASSWORD`              | Docker Compose database password                                    |

## Commands

```sh
npm run typecheck
npm test
npm run build
npm run test:integration
VISUAL_QA=true npm run test:integration
npm run format
```

Integration tests start an isolated PGlite/PostgreSQL-compatible socket server and a production Next.js server in one process environment. Meta calls are intercepted. Never point integration tests at a production database. Visual tests use a packaged Chromium binary; screenshots are local QA output and contain synthetic test records.

## Structure

```text
app/          Pages and Next.js API route handlers
components/   Bilingual workspace, authentication and visual flow builder
lib/          Auth, encryption, Meta client, graph rules, AI adapter, queue
api/          Validated application schemas
database/    Prisma schema and committed SQL migration
workers/      Event processing, messaging and durable queue runner
docs/         Architecture, Meta setup, deployment and verification
scripts/      Integration harness and backup runner
tests/        Security and business-rule tests
```

## Setup guides

- [Meta developer app, permissions, OAuth, Webhooks, App Review](docs/meta-setup.md)
- [Deployment, domain, SSL, PostgreSQL, workers and backup restoration](docs/deployment.md)
- [Architecture and delivery semantics](docs/architecture.md)
- [Verification and remaining activation work](docs/verification.md)

## Deliberate boundaries

No historical inbox import, rich attachment handling, Web Push subscriptions, team invitations/RBAC, password-reset email or email-verification delivery in this release. These are not presented as working buttons. Team/roles and Web Push were future/optional features in the brief. A/B selection is deterministic per lead; the dashboard reports observed counts, not statistical significance. Conversion is explicitly a contact marked `Customer`, not an inferred sale.

API responses page contacts and messages; media sync currently reads up to 1,000 media items and the UI displays the most recent 100. Logs show the most recent 100. The basic dashboard loads workspace data together; split/cached analytical endpoints are the next step for high-volume deployments. No live Meta/AI end-to-end or production load test has been performed without credentials.
