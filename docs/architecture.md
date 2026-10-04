# Architecture

Next.js serves a bilingual React workspace and authenticated API routes. Prisma owns a PostgreSQL schema. A separate Node process runs the queue. Redis is unnecessary for the initial deployment because durable jobs, locks and rate buckets reside in PostgreSQL.

## Data flow

1. Verify the exact Meta webhook body with HMAC-SHA256.
2. Persist each entry and its job in one transaction; acknowledge only after commit.
3. The worker creates a lead and comment, matches one eligible automation (oldest first), and atomically creates one outbound message and send job.
4. A unique comment ID and `private:<comment-id>` key enforce private-reply deduplication. Contact cooldown and active executions prevent repeated campaigns for the same contact.
5. Before sending, check automation state, schedule, business hours, connection, opt-out, rate bucket and messaging window. Claim the message durably.
6. Private replies address `recipient.comment_id`. Normal messages address the Instagram-scoped sender ID and require a recent inbound message.
7. Incoming messages advance a saved graph execution. Questions/wait nodes suspend until another inbound message. Conditions choose an explicit yes/no edge. Tags update the CRM. Cycles are rejected.

## Concurrency and delivery semantics

Queue claims take a short PostgreSQL advisory transaction lock, select one pending job with `FOR UPDATE SKIP LOCKED`, then commit. Jobs with the same lead partition do not run concurrently. Comment ingestion uses serializable transactions. Rate-limit buckets are atomic SQL upserts.

Exactly-once delivery across an external HTTP API cannot be guaranteed. If Meta rejects a call with a retryable rate/transient code, retry with exponential backoff and jitter. A transport timeout is ambiguous: the message is marked `uncertain` and is never automatically resent. A worker crash leaving a message `sending` is quarantined during hourly maintenance after it has been stale for at least 10 minutes. Inspect Instagram before taking manual action. A saved `sent` record can safely finish local follow-up work without resending.

The queue retries a job up to eight times, then retains it as `dead`. Outside-hours jobs are deferred in 15-minute increments without consuming that retry budget. Inbound messages temporarily blocked on a pending flow step defer for three seconds. Webhook logs expose retry for failed webhook processing; uncertain outbound sends intentionally have no automatic retry button.

## Tenant isolation

Every application read/write uses the workspace resolved from a hashed, HttpOnly session. Client-supplied workspace IDs are ignored. Accounts, media, leads and automations are checked against that workspace. OAuth state is single-use, expires after 10 minutes and is bound to the logged-in owner and an HttpOnly callback cookie.

## Initial scope

Multi-account storage and selection are implemented. Workspaces currently have one owner. Team memberships/invitations and granular roles are a future schema/API extension, not active placeholder controls. Instagram conversations are populated from messages received after connection, not a historical inbox import. Text messages are supported; media attachments are represented as `[Attachment]` and are not downloaded.

AI uses a provider interface with an OpenAI-compatible adapter. Keys/base URL/model are server settings. AI is disabled by default; draft mode creates messages for review. Auto mode is explicit and applies only in the inbound messaging window. Flow responses take priority over AI. A human can pause AI per lead.

UI refresh: dashboard every 15 seconds; active conversation every five seconds. This is polling, not WebSocket push. Browser push subscriptions are deferred; in-app notifications are implemented. No production data is seeded or faked.
