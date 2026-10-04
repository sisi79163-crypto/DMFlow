import { db } from "../lib/db";
import { processWebhook, sendMessage, processInbound } from "./engine";
import { MetaError, accountToken } from "../lib/meta";
import { encrypt } from "../lib/security";
import type { Job } from "@prisma/client";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function claim() {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(727401)`;
    const jobs = await tx.$queryRaw<
      Job[]
    >`SELECT j.* FROM "Job" j WHERE j.status='pending' AND j."runAt"<=NOW() AND NOT EXISTS (SELECT 1 FROM "Job" r WHERE r.status='running' AND r.payload->>'leadId'=j.payload->>'leadId') ORDER BY j."runAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!jobs[0]) return null;
    return tx.job.update({
      where: { id: jobs[0].id },
      data: {
        status: "running",
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  });
}
async function maintenance() {
  await db.message.updateMany({
    where: {
      status: "sending",
      updatedAt: { lt: new Date(Date.now() - 600000) },
    },
    data: { status: "uncertain" },
  });
  const uncertain = await db.message.findMany({
    where: { status: "uncertain", automationId: { not: null } },
    select: { leadId: true, automationId: true },
  });
  for (const m of uncertain)
    await db.execution.updateMany({
      where: {
        leadId: m.leadId,
        automationId: m.automationId!,
        state: { in: ["sending", "awaiting_private"] },
      },
      data: { state: "halted" },
    });
  await db.job.updateMany({
    where: {
      status: "running",
      lockedAt: { lt: new Date(Date.now() - 600000) },
    },
    data: { status: "pending", lockedAt: null },
  });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  const accounts = await db.instagramAccount.findMany({
    where: {
      connected: true,
      tokenExpiresAt: { lt: new Date(Date.now() + 864000000), gt: new Date() },
    },
  });
  for (const a of accounts) {
    try {
      const r = await fetch(
        "https://graph.instagram.com/refresh_access_token?" +
          new URLSearchParams({
            grant_type: "ig_refresh_token",
            access_token: accountToken(a),
          }),
        { signal: AbortSignal.timeout(20000) },
      );
      const b = await r.json();
      if (!r.ok || !b.access_token) throw new Error("Refresh failed");
      await db.instagramAccount.update({
        where: { id: a.id },
        data: {
          tokenEncrypted: encrypt(b.access_token),
          tokenExpiresAt: new Date(Date.now() + b.expires_in * 1000),
        },
      });
    } catch {
      await db.notification.create({
        data: {
          workspaceId: a.workspaceId,
          title: "Instagram token renewal failed. Reconnect the account.",
        },
      });
    }
  }
}
async function main() {
  let lastMaintenance = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastMaintenance > 3600000) {
        await maintenance();
        lastMaintenance = Date.now();
      }
      const j = await claim();
      if (!j) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      try {
        const p = j.payload as any;
        if (j.type === "webhook") await processWebhook(p.eventId);
        else if (j.type === "send") await sendMessage(p);
        else if (j.type === "inbound")
          await processInbound(p.leadId, p.text, p.mid);
        else throw new Error("Unknown job");
        await db.job.update({
          where: { id: j.id },
          data: { status: "completed", lockedAt: null, error: null },
        });
      } catch (e) {
        const outsideHours =
          e instanceof Error &&
          ["OUTSIDE_HOURS", "FLOW_BUSY"].includes(e.message);
        const retry = outsideHours || j.attempts < 8;
        const error =
          e instanceof MetaError
            ? e.message
            : "Processing failed; inspect configuration or event";
        await db.job.update({
          where: { id: j.id },
          data: {
            status: retry ? "pending" : "dead",
            attempts: outsideHours ? j.attempts - 1 : j.attempts,
            lockedAt: null,
            error,
            runAt: new Date(
              Date.now() +
                (outsideHours
                  ? e instanceof Error && e.message === "FLOW_BUSY"
                    ? 3000
                    : 900000
                  : Math.min(3600000, 5000 * 2 ** j.attempts)) +
                Math.random() * 1000,
            ),
          },
        });
        if (j.type === "webhook")
          await db.webhookEvent.update({
            where: { id: (j.payload as any).eventId },
            data: { status: retry ? "retrying" : "failed", error },
          });
      }
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "worker.loop.failed",
          time: new Date().toISOString(),
        }),
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await db.$disconnect();
}
main().catch(() => process.exit(1));
