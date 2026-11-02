# Contributing to DMFlow

## Quick start

1. Fork the repository and create a branch from `main`.
2. `npm ci`, copy `.env.example` to `.env`, then `npm run db:generate` and `npm run db:migrate`.
3. Run the app with `npm run dev` and the worker with `npm run worker`.

## Before opening a pull request

- `npm run typecheck`
- `npm test`
- `npm run build`

## Ground rules

- Official Meta API only. No Instagram password collection, no unofficial API, no scraping.
- Secrets go in environment variables, never in code or committed files.
- Keep the bilingual (Arabic/English) UI: user-facing strings need both languages.
- Small, focused pull requests are reviewed faster than large rewrites.
