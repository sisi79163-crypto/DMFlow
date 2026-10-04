# Verification record

Validated locally on 2026-10-04.

| Check                                                          | Result                                   |
| -------------------------------------------------------------- | ---------------------------------------- |
| Prisma schema/client generation                                | Passed                                   |
| Initial SQL migration on isolated PostgreSQL-compatible PGlite | Applied successfully                     |
| TypeScript strict compilation                                  | Passed                                   |
| Production Next.js build                                       | Passed                                   |
| Unit/security/business-rule tests                              | 14 passed                                |
| Integrated API/engine/browser checks                           | 33 passed                                |
| Production dependency audit                                    | 0 reported vulnerabilities at build time |
| 1440px desktop and 390px mobile visual review                  | Reviewed                                 |
| Mobile horizontal overflow                                     | None detected                            |
| Arabic RTL / English LTR / dark mode                           | Verified in Chromium                     |

## What the integration suite covers

Session creation, unauthenticated denial, CSRF/origin denial, two-workspace isolation, persistent automation creation, pause/enable validation, invalid webhook signature, duplicate webhook delivery, deduplicated comments and private replies, correct recipient type, public reply endpoint, normal-DM denial before inbound, question/wait progression, yes/no branch selection, inbound replay, manual-send idempotency, ambiguous transport quarantine, expired messaging window, Arabic opt-out, knowledge persistence, link redirect/click count, real dashboard totals, and omission of account tokens from client data.

The database was isolated and ephemeral. Meta HTTP responses were intercepted, not sent over the network. Preview screenshots contain synthetic Test Owner / Test campaign records. No test account or test data is included in a production seed.

## Not verified in this environment

Live Meta OAuth or App Review; live Instagram webhook shapes/delivery on a real approved account; live AI-provider responses; native Safari on a physical iPhone; Docker image builds; deployment to Vercel; production PostgreSQL load/concurrency under traffic; backup restoration on a real server. The committed CI configuration can repeat the automated local suite in GitHub Actions.

The application source and configuration are provided; production activation needs hosting/database access and actual Meta credentials/permissions. Team/RBAC, Web Push, historical inbox import, attachment processing and password-reset/email-verification delivery are outside this release’s implemented scope.
