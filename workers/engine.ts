import { db } from "../lib/db";
import { rateLimit } from "../lib/rate-limit";
import { enqueue } from "../lib/jobs";
import {
  matches,
  normalize,
  canMessage,
  inSchedule,
  inBusinessHours,
  variantFor,
  STOP_WORDS,
} from "../lib/rules";
import { flowSchema, nextNode } from "../lib/flow";
import { graph, accountToken, MetaError } from "../lib/meta";
import { draftReply } from "../lib/ai";
import type { Prisma } from "@prisma/client";
export async function processWebhook(eventId: string) {
  const event = await db.webhookEvent.findUniqueOrThrow({
    where: { id: eventId },
  });
  const a = await db.instagramAccount.findUnique({
    where: { instagramId: event.accountExternalId },
    include: { workspace: true },
  });
  if (!a?.connected) {
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "ignored" },
    });
    return;
  }
  const payload = event.payload as any;
  for (const change of payload.changes || []) {
    if (change.field !== "comments") continue;
    const v = change.value;
    if (
      !v.id ||
      !v.from?.id ||
      !v.media?.id ||
      v.from.id === a.instagramId ||
      v.parent_id
    )
      continue;
    const automations = await db.automation.findMany({
      where: { accountId: a.id, mediaId: String(v.media.id), enabled: true },
      orderBy: { createdAt: "asc" },
    });
    const automation = automations.find(
      (x) => inSchedule(x) && matches(v.text || "", x.trigger, x.keywords),
    );
    const createdAt = new Date(
      (payload.time || Math.floor(Date.now() / 1000)) * 1000,
    );
    await db.$transaction(
      async (tx) => {
        const l = await tx.lead.upsert({
          where: {
            accountId_instagramId: {
              accountId: a.id,
              instagramId: String(v.from.id),
            },
          },
          create: {
            workspaceId: a.workspaceId,
            accountId: a.id,
            instagramId: String(v.from.id),
            username: v.from.username || "",
          },
          update: {
            username: v.from.username || "",
            lastInteraction: new Date(),
          },
        });
        const existing = await tx.comment.findUnique({
          where: { id: String(v.id) },
        });
        if (existing) return;
        await tx.comment.create({
          data: {
            id: String(v.id),
            leadId: l.id,
            automationId: automation?.id,
            mediaId: String(v.media.id),
            text: v.text || "",
            triggerKeyword:
              automation?.trigger === "any"
                ? "Any"
                : automation?.keywords.find((k) =>
                    matches(v.text || "", "keywords", [k]),
                  ) || "",
            createdAt,
          },
        });
        if (
          !automation ||
          l.optedOut ||
          Date.now() - createdAt.getTime() > 604800000
        )
          return;
        if (
          l.lastOutboundAt &&
          Date.now() - l.lastOutboundAt.getTime() <
            automation.cooldownHours * 3600000
        )
          return;
        if (
          await tx.execution.count({
            where: {
              leadId: l.id,
              state: { in: ["waiting", "sending", "awaiting_private"] },
            },
          })
        )
          return;
        const variant = automation.messageB ? variantFor(l.id) : "A";
        const f = flowSchema.parse(automation.flow);
        const first = f.nodes.find((n) => n.data.kind === "comment");
        const dm = first
          ? f.nodes.find((n) => n.id === nextNode(f, first.id))
          : undefined;
        if (f.nodes.length && dm?.data.kind !== "dm")
          throw new Error("Flow must start with Comment → DM");
        const key = "private:" + v.id;
        const m = await tx.message.create({
          data: {
            leadId: l.id,
            dedupeKey: key,
            direction: "out",
            kind: "private",
            body: variant === "B" ? automation.messageB : automation.messageA,
            variant,
            automationId: automation.id,
            commentId: String(v.id),
          },
        });
        await tx.job.create({
          data: {
            key: "send:" + m.id,
            type: "send",
            payload: { messageId: m.id, leadId: l.id },
          },
        });
        await tx.execution.upsert({
          where: {
            leadId_automationId: { leadId: l.id, automationId: automation.id },
          },
          create: {
            leadId: l.id,
            automationId: automation.id,
            variant,
            cursor: dm ? nextNode(f, dm.id) : null,
            state: "awaiting_private",
          },
          update: {
            variant,
            cursor: dm ? nextNode(f, dm.id) : null,
            state: "awaiting_private",
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
  for (const ev of payload.messaging || []) {
    if (
      !ev.message?.mid ||
      ev.message.is_echo ||
      ev.sender?.id === a.instagramId ||
      !ev.sender?.id
    )
      continue;
    const text = ev.message.text || "[Attachment]";
    const inboundAt = new Date(ev.timestamp || Date.now());
    const l = await db.$transaction(async (tx) => {
      const lead = await tx.lead.upsert({
        where: {
          accountId_instagramId: {
            accountId: a.id,
            instagramId: String(ev.sender.id),
          },
        },
        create: {
          workspaceId: a.workspaceId,
          accountId: a.id,
          instagramId: String(ev.sender.id),
          lastInboundAt: inboundAt,
        },
        update: { lastInteraction: new Date() },
      });
      const existing = await tx.message.findUnique({
        where: { dedupeKey: "in:" + ev.message.mid },
      });
      if (existing) return null;
      await tx.message.create({
        data: {
          leadId: lead.id,
          dedupeKey: "in:" + ev.message.mid,
          externalId: ev.message.mid,
          direction: "in",
          body: text,
          status: "sent",
          sentAt: inboundAt,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          lastInboundAt:
            !lead.lastInboundAt || inboundAt > lead.lastInboundAt
              ? inboundAt
              : lead.lastInboundAt,
          optedOut:
            lead.optedOut ||
            STOP_WORDS.some((w) => normalize(w) === normalize(text)),
          tags: { set: Array.from(new Set([...lead.tags, "Hot Lead"])) },
        },
      });
      await tx.notification.create({
        data: { workspaceId: a.workspaceId, title: "New reply received" },
      });
      await tx.job.upsert({
        where: { key: "inbound:" + ev.message.mid },
        create: {
          key: "inbound:" + ev.message.mid,
          type: "inbound",
          payload: { leadId: lead.id, text, mid: ev.message.mid },
        },
        update: {},
      });
      return lead;
    });
    void l;
  }
  await db.webhookEvent.update({
    where: { id: eventId },
    data: { status: "processed", error: null },
  });
}
export async function processInbound(
  leadId: string,
  text: string,
  mid: string,
) {
  const receipt = await db.inboundReceipt.findUnique({ where: { mid } });
  if (receipt?.completed) return;
  if (receipt?.executionId) {
    await advance(receipt.executionId, receipt.cursor, text, mid);
    await db.inboundReceipt.update({
      where: { mid },
      data: { completed: true },
    });
    return;
  }
  const l = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { workspace: true },
  });
  if (l.optedOut) return;
  if (
    await db.execution.count({
      where: { leadId, state: { in: ["sending", "awaiting_private"] } },
    })
  )
    throw new Error("FLOW_BUSY");
  const executions = await db.execution.findMany({
    where: { leadId, state: "waiting" },
    include: { automation: true },
    orderBy: { updatedAt: "desc" },
  });
  const e = executions.find(
    (x) => x.automation.enabled && inSchedule(x.automation),
  );
  if (e) {
    const f = flowSchema.parse(e.automation.flow);
    const node = f.nodes.find((n) => n.id === e.cursor);
    const cursor =
      node && ["wait", "question"].includes(node.data.kind)
        ? nextNode(f, node.id)
        : e.cursor;
    await db.inboundReceipt.upsert({
      where: { mid },
      create: { mid, executionId: e.id, cursor },
      update: {},
    });
    await db.message.updateMany({
      where: { dedupeKey: "in:" + mid },
      data: { automationId: e.automationId, variant: e.variant },
    });
    await advance(e.id, cursor, text, mid);
    await db.inboundReceipt.update({
      where: { mid },
      data: { completed: true },
    });
    return;
  }
  if (l.workspace.aiEnabled && !l.aiPaused && canMessage(l.lastInboundAt)) {
    const reply = await draftReply(leadId, l.workspaceId);
    if (!reply) return;
    const m = await db.message.upsert({
      where: { dedupeKey: "ai:" + mid },
      create: {
        leadId,
        dedupeKey: "ai:" + mid,
        direction: "out",
        body: reply,
        status: l.workspace.aiMode === "auto" ? "pending" : "draft",
        kind: "ai",
      },
      update: {},
    });
    if (m.status === "pending")
      await enqueue("send:" + m.id, "send", { messageId: m.id, leadId });
  }
  await db.inboundReceipt.upsert({
    where: { mid },
    create: { mid, completed: true },
    update: { completed: true },
  });
}
export async function advance(
  executionId: string,
  cursor: string | null,
  text: string,
  mid: string,
) {
  const e = await db.execution.findUniqueOrThrow({
    where: { id: executionId },
    include: { automation: true, lead: true },
  });
  const f = flowSchema.parse(e.automation.flow);
  for (let steps = 0; cursor && steps < 40; steps++) {
    const node = f.nodes.find((n) => n.id === cursor);
    if (!node) break;
    const k = node.data.kind;
    if (k === "wait") {
      await db.execution.update({
        where: { id: e.id },
        data: { cursor, state: "waiting" },
      });
      return;
    }
    if (k === "condition") {
      cursor = nextNode(
        f,
        cursor,
        normalize(text).includes(normalize(node.data.value || ""))
          ? "yes"
          : "no",
      );
      continue;
    }
    if (k === "tag") {
      await db.lead.update({
        where: { id: e.leadId },
        data: {
          tags: {
            set: Array.from(
              new Set([
                ...(
                  await db.lead.findUniqueOrThrow({ where: { id: e.leadId } })
                ).tags,
                node.data.value || "Interested",
              ]),
            ),
          },
        },
      });
      cursor = nextNode(f, cursor);
      continue;
    }
    if (["message", "question", "link"].includes(k)) {
      const body =
        k === "link"
          ? [node.data.text, node.data.value].filter(Boolean).join("\n")
          : node.data.text || "";
      if (!body) throw new Error("Empty flow message");
      const key = `flow:${e.id}:${mid}:${cursor}`;
      const m = await db.message.upsert({
        where: { dedupeKey: key },
        create: {
          leadId: e.leadId,
          dedupeKey: key,
          direction: "out",
          body,
          automationId: e.automationId,
          variant: e.variant,
        },
        update: {},
      });
      await db.execution.update({
        where: { id: e.id },
        data: { cursor, state: "sending" },
      });
      await enqueue("send:" + m.id, "send", {
        messageId: m.id,
        leadId: e.leadId,
        executionId: e.id,
        nodeId: cursor,
        mid,
        text,
      });
      return;
    }
    cursor = nextNode(f, cursor);
  }
  await db.execution.update({
    where: { id: e.id },
    data: { cursor: null, state: "completed" },
  });
}
export async function sendMessage(payload: {
  messageId: string;
  executionId?: string;
  nodeId?: string;
  mid?: string;
  text?: string;
}) {
  const m = await db.message.findUniqueOrThrow({
    where: { id: payload.messageId },
    include: { lead: { include: { account: true, workspace: true } } },
  });
  if (m.status === "sent") {
    await finalizePrivate(m.id);
    await continueFlow(payload);
    return;
  }
  if (m.status !== "pending") {
    if (["skipped", "expired", "failed", "uncertain"].includes(m.status))
      await haltExecution(m);
    return;
  }
  const l = m.lead;
  const a = m.automationId
    ? await db.automation.findUnique({ where: { id: m.automationId } })
    : null;
  if (
    l.optedOut ||
    !l.account.connected ||
    (m.kind === "ai" && (!l.workspace.aiEnabled || l.aiPaused)) ||
    (m.automationId && !a) ||
    (a && (!a.enabled || !inSchedule(a)))
  ) {
    await db.message.update({
      where: { id: m.id },
      data: { status: "skipped" },
    });
    await haltExecution(m);
    return;
  }
  if (
    !inBusinessHours(l.workspace.businessHours, l.workspace.timezone) &&
    m.kind !== "manual"
  )
    throw new Error("OUTSIDE_HOURS");
  try {
    await rateLimit(
      "meta-send:" + l.accountId,
      Number(process.env.META_SENDS_PER_HOUR || 200),
      3600,
    );
  } catch {
    throw new MetaError(429, true);
  }
  if (m.kind === "private") {
    const comment = await db.comment.findUnique({
      where: { id: m.commentId! },
    });
    if (!comment || Date.now() - comment.createdAt.getTime() > 604800000) {
      await db.message.update({
        where: { id: m.id },
        data: { status: "expired" },
      });
      await haltExecution(m);
      return;
    }
  } else if (m.kind !== "public" && !canMessage(l.lastInboundAt)) {
    await db.message.update({
      where: { id: m.id },
      data: { status: "expired" },
    });
    await haltExecution(m);
    return;
  }
  // A durable claim makes transport ambiguity visible instead of silently duplicating sends.
  const claimed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${l.id}))`;
    const fresh = await tx.lead.findUniqueOrThrow({ where: { id: l.id } });
    if (
      m.kind === "private" &&
      fresh.lastOutboundAt &&
      Date.now() - fresh.lastOutboundAt.getTime() <
        (a?.cooldownHours || 24) * 3600000
    ) {
      await tx.message.update({
        where: { id: m.id },
        data: { status: "skipped" },
      });
      return false;
    }
    const claim = await tx.message.updateMany({
      where: { id: m.id, status: "pending" },
      data: { status: "sending" },
    });
    if (claim.count && m.kind !== "public")
      await tx.lead.update({
        where: { id: l.id },
        data: { lastOutboundAt: new Date() },
      });
    return claim.count === 1;
  });
  if (!claimed) {
    if (m.kind === "private" && a)
      await db.execution.updateMany({
        where: { leadId: l.id, automationId: a.id, state: "awaiting_private" },
        data: { state: "completed" },
      });
    return;
  }
  try {
    const token = accountToken(l.account);
    const r =
      m.kind === "public"
        ? await graph(`${m.commentId}/replies`, token, "POST", {
            message: m.body,
          })
        : await graph(`${l.account.instagramId}/messages`, token, "POST", {
            recipient:
              m.kind === "private"
                ? { comment_id: m.commentId }
                : { id: l.instagramId },
            message: { text: m.body },
          });
    await db.message.update({
      where: { id: m.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        externalId: r.message_id || r.id,
      },
    });
    await db.log.create({
      data: {
        workspaceId: l.workspaceId,
        type: "activity",
        action: "message.sent",
        detail: m.kind,
      },
    });
    await finalizePrivate(m.id);
    await continueFlow(payload);
  } catch (err) {
    if (
      (await db.message.findUniqueOrThrow({ where: { id: m.id } })).status ===
      "sent"
    )
      throw err;
    const retry = err instanceof MetaError && err.retryable;
    await db.message.updateMany({
      where: { id: m.id, status: "sending" },
      data: {
        status: retry
          ? "pending"
          : err instanceof MetaError
            ? "failed"
            : "uncertain",
      },
    });
    if (retry && m.kind === "private")
      await db.lead.update({
        where: { id: l.id },
        data: { lastOutboundAt: l.lastOutboundAt },
      });
    await db.notification.create({
      data: {
        workspaceId: l.workspaceId,
        title: retry
          ? "Message delayed by API limit"
          : "Message requires review",
      },
    });
    if (retry) throw err;
    await haltExecution(m);
  }
}
async function continueFlow(p: {
  executionId?: string;
  nodeId?: string;
  mid?: string;
  text?: string;
}) {
  if (!p.executionId || !p.nodeId) return;
  const e = await db.execution.findUniqueOrThrow({
    where: { id: p.executionId },
    include: { automation: true },
  });
  const f = flowSchema.parse(e.automation.flow);
  const node = f.nodes.find((n) => n.id === p.nodeId);
  if (node?.data.kind === "question")
    await db.execution.update({
      where: { id: e.id },
      data: { state: "waiting", cursor: p.nodeId },
    });
  else await advance(e.id, nextNode(f, p.nodeId), p.text || "", p.mid || "");
}

async function finalizePrivate(messageId: string) {
  const m = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  if (m.kind !== "private" || !m.automationId || m.status !== "sent") return;
  const a = await db.automation.findUnique({ where: { id: m.automationId } });
  if (!a) return;
  await db.execution.updateMany({
    where: { leadId: m.leadId, automationId: a.id, state: "awaiting_private" },
    data: { state: "waiting" },
  });
  if (a.publicReply) {
    const pub = await db.message.upsert({
      where: { dedupeKey: "public:" + m.commentId },
      create: {
        leadId: m.leadId,
        dedupeKey: "public:" + m.commentId,
        direction: "out",
        kind: "public",
        body: a.publicReply,
        commentId: m.commentId,
        automationId: a.id,
      },
      update: {},
    });
    await enqueue("send:" + pub.id, "send", {
      messageId: pub.id,
      leadId: m.leadId,
    });
  }
}

async function haltExecution(m: {
  leadId: string;
  automationId: string | null;
  kind: string;
}) {
  if (m.automationId && m.kind !== "public")
    await db.execution.updateMany({
      where: {
        leadId: m.leadId,
        automationId: m.automationId,
        state: { in: ["sending", "awaiting_private"] },
      },
      data: { state: "halted" },
    });
}
