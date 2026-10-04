# Deployment

## Vercel + a separate worker

1. Create a private GitHub repository, push this source and connect it to Vercel as a Next.js project. The app/API run on Vercel; the worker is a separate persistent service.
2. Provision PostgreSQL 16+. Use TLS (`sslmode=require`) outside a private Docker network. For serverless traffic use the database provider’s pooled URL; use a direct connection for migrations when required by the provider. Set a conservative Prisma connection limit according to the database plan.
3. Add production environment variables in Vercel. Set `APP_URL` to the final HTTPS origin (no trailing slash). Never prefix server secrets with `NEXT_PUBLIC_`.
4. Run `npm run db:migrate` once with the migration database URL before activating traffic. Do not use `prisma db push` against production.
5. Build the `worker` Docker target and run it on a persistent container host. Set the same database/encryption/Meta/AI configuration. Command: `npm run worker`. Do not run the worker inside Vercel request handlers.
6. Deploy the Next.js project. Verify `/api/health`, register the owner, and set `REGISTRATION_ENABLED=false` for a private single-owner installation.
7. Add the domain in Vercel and apply its exact DNS instructions. Wait for Vercel’s managed TLS certificate. Update Meta callback URLs and `APP_URL` together; HTTP/HTTPS or domain mismatches will block OAuth and CSRF checks.
8. Enable managed PostgreSQL backups and point-in-time recovery where available. Test restoration to a separate database. Provision uptime monitoring and alert on worker heartbeat/dead jobs.

## Docker Compose on a VPS

Copy `.env.example` to `.env`, configure secrets, and add `POSTGRES_PASSWORD` using a long URL-safe random value (avoid URI-reserved characters or encode them in a custom URL). Set `APP_URL=https://your-domain`.

```sh
docker compose up --build -d
```

Compose starts PostgreSQL, applies migrations once, then starts web, worker and daily local backups. The web port is bound only to `127.0.0.1:3000`. Terminate TLS with Caddy or Nginx on the host. Example Caddy configuration:

```caddy
your-domain.example {
  reverse_proxy 127.0.0.1:3000
}
```

Allow only ports 80/443 to the public internet. Do not expose PostgreSQL. Persistent data lives in `postgres_data`; backups live in the separate `backups` volume. Copy encrypted backups off-host; a local volume does not protect against host loss. Store the encryption key separately from backups. The app token encryption does not encrypt message content at rest; use encrypted storage/managed database encryption.

## Restore rehearsal

Restore only into a new, empty database:

```sh
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" dmflow-YYYYMMDDTHHMMSSZ.dump
```

Inspect row counts, connect a test instance with outbound workers disabled and verify data before promoting the restored database. Reconcile any queued sends before starting workers to avoid replay after a restore.

## Worker operations

`Job` holds status, attempts, runAt and last error. `WebhookEvent` holds processing state. `Message` distinguishes pending/sending/sent/skipped/expired/failed/uncertain/draft. Logs never intentionally include tokens or AI keys. Shipping logs to an external monitoring provider is a deployment integration, not preconfigured here.

Start with one worker. Queue claiming supports multiple worker replicas with a lead partition, but this build has not undergone load testing on a production PostgreSQL deployment. Follow-ups and rate limits should be observed under real Meta traffic before increasing replicas.

## GitHub

```sh
git init -b main
git add .
git commit -m "Build DMFlow Instagram automation workspace"
git remote add origin https://github.com/YOUR_ACCOUNT/DMFlow.git
git push -u origin main
```

No secrets or local test database files belong in the repository. CI runs type checks, rule tests, production build and local integration tests. GitHub Actions does not send messages to Instagram.
