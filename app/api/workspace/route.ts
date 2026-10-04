import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, body } from "@/lib/http";
import { requireOrigin, randomToken } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { automationSchema, settingsSchema } from "@/api/schemas";
import { z } from "zod";
import { syncMedia } from "@/lib/meta";
import { canMessage } from "@/lib/rules";
import { draftReply } from "@/lib/ai";
export async function GET(req: NextRequest) {
  try {
    const u = await requireUser();
    const wid = u.workspace.id;
    await rateLimit("read:" + wid, 180);
    const view = req.nextUrl.searchParams.get("view");
    if (view === "messages") {
      const leadId = req.nextUrl.searchParams.get("leadId") || "";
      const lead = await db.lead.findFirst({
        where: { id: leadId, workspaceId: wid },
      });
      if (!lead) throw new Error("NOT_FOUND");
      const before = req.nextUrl.searchParams.get("before");
      const messages = await db.message.findMany({
        where: {
          leadId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return Response.json({ messages: messages.reverse(), lead });
    }
    const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 100),
      status = req.nextUrl.searchParams.get("status") || "";
    const page = Math.max(
      0,
      Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 0),
    );
    const [
      accounts,
      media,
      automations,
      leads,
      knowledge,
      logs,
      notifications,
      links,
      comments,
      sent,
      replies,
      customers,
      totalLeads,
      webhooks,
      trend,
    ] = await Promise.all([
      db.instagramAccount.findMany({
        where: { workspaceId: wid },
        select: {
          id: true,
          instagramId: true,
          username: true,
          connected: true,
          tokenExpiresAt: true,
        },
      }),
      db.media.findMany({
        where: { account: { workspaceId: wid } },
        orderBy: { timestamp: "desc" },
        take: 100,
      }),
      db.automation.findMany({
        where: { workspaceId: wid },
        include: { _count: { select: { comments: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.lead.findMany({
        where: {
          workspaceId: wid,
          ...(q
            ? {
                OR: [
                  { username: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { tags: { has: q } },
                ],
              }
            : {}),
          ...(status ? { status } : {}),
        },
        include: { comments: { take: 1, orderBy: { createdAt: "desc" } } },
        orderBy: { lastInteraction: "desc" },
        take: 50,
        skip: page * 50,
      }),
      db.knowledge.findMany({
        where: { workspaceId: wid },
        orderBy: { updatedAt: "desc" },
      }),
      db.log.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.notification.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.trackedLink.findMany({ where: { workspaceId: wid } }),
      db.comment.count({ where: { lead: { workspaceId: wid } } }),
      db.message.count({
        where: {
          lead: { workspaceId: wid },
          direction: "out",
          status: "sent",
          kind: { not: "public" },
        },
      }),
      db.message.count({
        where: { lead: { workspaceId: wid }, direction: "in" },
      }),
      db.lead.count({ where: { workspaceId: wid, status: "Customer" } }),
      db.lead.count({ where: { workspaceId: wid } }),
      db.webhookEvent.findMany({
        where: {
          accountExternalId: {
            in: (
              await db.instagramAccount.findMany({
                where: { workspaceId: wid },
                select: { instagramId: true },
              })
            ).map((a) => a.instagramId),
          },
        },
        select: { id: true, status: true, error: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.$queryRaw<
        { day: string; direction: string; count: bigint }[]
      >`SELECT TO_CHAR(m."createdAt",'YYYY-MM-DD') AS day,m.direction,COUNT(*) AS count FROM "Message" m JOIN "Lead" l ON l.id=m."leadId" WHERE l."workspaceId"=${wid} AND m.status='sent' AND m.kind!='public' AND m."createdAt">NOW()-INTERVAL '30 days' GROUP BY day,m.direction ORDER BY day`,
    ]);
    const dates = await db.$queryRaw<
      { day: string }[]
    >`SELECT TO_CHAR(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day`;
    const triggers = await db.comment.groupBy({
      by: ["mediaId", "triggerKeyword"],
      where: { lead: { workspaceId: wid }, automationId: { not: null } },
      _count: true,
      orderBy: { _count: { id: "desc" } },
    });
    const performance = await db.message.groupBy({
      by: ["automationId", "variant", "direction"],
      where: {
        lead: { workspaceId: wid },
        status: "sent",
        automationId: { not: null },
        kind: { not: "public" },
      },
      _count: true,
    });
    return Response.json({
      user: { name: u.name, email: u.email },
      workspace: u.workspace,
      accounts,
      media,
      automations,
      leads,
      knowledge,
      logs,
      notifications,
      links,
      webhooks,
      performance,
      triggers,
      analyticsDate: dates[0].day,
      stats: {
        comments,
        sent,
        replies,
        customers,
        leads: totalLeads,
        conversion: totalLeads
          ? Math.round((customers / totalLeads) * 1000) / 10
          : 0,
      },
      trend: trend.map((t) => ({ ...t, count: Number(t.count) })),
      configured: {
        meta: !!process.env.META_APP_ID && !!process.env.META_APP_SECRET,
        ai: !!process.env.AI_API_KEY && !!process.env.AI_MODEL,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireOrigin(req);
    const u = await requireUser(),
      wid = u.workspace.id;
    await rateLimit("write:" + wid, 60);
    const raw = await body(req);
    const action = z.string().parse(raw.action);
    const data = raw.data;
    let result: unknown = { ok: true };
    if (action === "automation.save") {
      const b = automationSchema.parse(data);
      const account = await db.instagramAccount.findFirst({
        where: { id: b.accountId, workspaceId: wid, connected: true },
      });
      const media = await db.media.findFirst({
        where: { id: b.mediaId, accountId: b.accountId },
      });
      if (!account || !media) throw new Error("NOT_FOUND");
      const { id, ...values } = b;
      const write = {
        ...values,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
      };
      if (id) {
        if (
          !(await db.automation.findFirst({ where: { id, workspaceId: wid } }))
        )
          throw new Error("NOT_FOUND");
        result = await db.automation.update({
          where: { id },
          data: { ...write, enabled: false },
        });
      } else
        result = await db.automation.create({
          data: { ...write, workspaceId: wid },
        });
    } else if (action === "automation.toggle") {
      const b = z.object({ id: z.string(), enabled: z.boolean() }).parse(data);
      const a = await db.automation.findFirst({
        where: { id: b.id, workspaceId: wid },
        include: { account: true },
      });
      if (!a) throw new Error("NOT_FOUND");
      if (b.enabled) {
        automationSchema.parse({
          ...a,
          startsAt: a.startsAt?.toISOString() || null,
          endsAt: a.endsAt?.toISOString() || null,
        });
        if (!a.account.connected || a.account.tokenExpiresAt < new Date())
          return Response.json(
            { error: "Reconnect Instagram first" },
            { status: 400 },
          );
      }
      await db.automation.update({
        where: { id: a.id },
        data: { enabled: b.enabled },
      });
    } else if (action === "automation.delete") {
      const id = z.string().parse(data.id);
      await db.automation.deleteMany({ where: { id, workspaceId: wid } });
    } else if (action === "lead.update") {
      const b = z
        .object({
          id: z.string(),
          name: z.string().max(100),
          status: z.enum([
            "Interested",
            "Hot Lead",
            "Customer",
            "Needs Follow-up",
          ]),
          tags: z.array(z.string().max(40)).max(20),
          aiPaused: z.boolean(),
          optedOut: z.boolean(),
        })
        .parse(data);
      const { id, ...v } = b;
      await db.lead.updateMany({ where: { id, workspaceId: wid }, data: v });
    } else if (action === "message.send") {
      const b = z
        .object({
          leadId: z.string(),
          text: z.string().min(1).max(1000),
          requestId: z.string().min(10).max(80),
        })
        .parse(data);
      const lead = await db.lead.findFirst({
        where: { id: b.leadId, workspaceId: wid },
      });
      if (!lead) throw new Error("NOT_FOUND");
      if (lead.optedOut || !canMessage(lead.lastInboundAt))
        return Response.json(
          {
            error:
              "The 24-hour reply window is closed or the customer opted out.",
          },
          { status: 400 },
        );
      result = await db.$transaction(async (tx) => {
        const m = await tx.message.upsert({
          where: { dedupeKey: "manual:" + wid + ":" + b.requestId },
          create: {
            leadId: lead.id,
            dedupeKey: "manual:" + wid + ":" + b.requestId,
            body: b.text,
            direction: "out",
            kind: "manual",
          },
          update: {},
        });
        await tx.job.upsert({
          where: { key: "send:" + m.id },
          create: {
            key: "send:" + m.id,
            type: "send",
            payload: { messageId: m.id, leadId: lead.id },
          },
          update: {},
        });
        return m;
      });
    } else if (action === "ai.draft") {
      const leadId = z.string().parse(data.leadId);
      if (
        !(await db.lead.findFirst({ where: { id: leadId, workspaceId: wid } }))
      )
        throw new Error("NOT_FOUND");
      await rateLimit("ai:" + wid, 10);
      result = { text: await draftReply(leadId, wid) };
    } else if (action === "knowledge.save") {
      const b = z
        .object({
          id: z.string().optional(),
          title: z.string().min(1).max(100),
          category: z.enum([
            "business",
            "products",
            "pricing",
            "shipping",
            "faq",
          ]),
          content: z.string().min(1).max(12000),
        })
        .parse(data);
      const { id, ...v } = b;
      if (id) {
        await db.knowledge.updateMany({
          where: { id, workspaceId: wid },
          data: v,
        });
      } else
        result = await db.knowledge.create({
          data: { ...v, workspaceId: wid },
        });
    } else if (action === "knowledge.delete") {
      await db.knowledge.deleteMany({
        where: { id: z.string().parse(data.id), workspaceId: wid },
      });
    } else if (action === "settings.save") {
      const b = settingsSchema.parse(data);
      result = await db.workspace.update({ where: { id: wid }, data: b });
    } else if (action === "media.sync") {
      const a = await db.instagramAccount.findFirst({
        where: { id: z.string().parse(data.id), workspaceId: wid },
      });
      if (!a) throw new Error("NOT_FOUND");
      await syncMedia(a);
    } else if (action === "account.disconnect") {
      const id = z.string().parse(data.id);
      await db.$transaction([
        db.instagramAccount.updateMany({
          where: { id, workspaceId: wid },
          data: { connected: false, tokenEncrypted: "" },
        }),
        db.automation.updateMany({
          where: { accountId: id, workspaceId: wid },
          data: { enabled: false },
        }),
      ]);
    } else if (action === "account.delete") {
      const id = z.string().parse(data.id);
      const a = await db.instagramAccount.findFirst({
        where: { id, workspaceId: wid },
      });
      if (!a) throw new Error("NOT_FOUND");
      await db.$transaction(async (tx) => {
        const leads = await tx.lead.findMany({
          where: { accountId: id },
          select: { id: true },
        });
        const ids = leads.map((l) => l.id);
        const jobs = await tx.job.findMany({
          where: { type: { in: ["send", "inbound"] } },
          select: { id: true, payload: true },
        });
        await tx.job.deleteMany({
          where: {
            id: {
              in: jobs
                .filter((j) => ids.includes(String((j.payload as any).leadId)))
                .map((j) => j.id),
            },
          },
        });
        const events = await tx.webhookEvent.findMany({
          where: { accountExternalId: a.instagramId },
          select: { id: true },
        });
        await tx.job.deleteMany({
          where: { key: { in: events.map((e) => "webhook:" + e.id) } },
        });
        await tx.webhookEvent.deleteMany({
          where: { accountExternalId: a.instagramId },
        });
        await tx.instagramAccount.delete({ where: { id } });
      });
    } else if (action === "notification.read") {
      await db.notification.updateMany({
        where: { workspaceId: wid },
        data: { read: true },
      });
    } else if (action === "link.create") {
      const b = z
        .object({
          label: z.string().min(1).max(100),
          destination: z
            .string()
            .url()
            .max(2000)
            .refine((s) => new URL(s).protocol === "https:"),
        })
        .parse(data);
      result = await db.trackedLink.create({
        data: { workspaceId: wid, ...b },
      });
    } else if (action === "webhook.retry") {
      const id = z.string().parse(data.id);
      const e = await db.webhookEvent.findUnique({ where: { id } });
      if (
        !e ||
        !(await db.instagramAccount.findFirst({
          where: { workspaceId: wid, instagramId: e.accountExternalId },
        }))
      )
        throw new Error("NOT_FOUND");
      await db.job.updateMany({
        where: { key: "webhook:" + id, status: "dead" },
        data: {
          status: "pending",
          attempts: 0,
          runAt: new Date(),
          error: null,
        },
      });
    } else return Response.json({ error: "Unknown action" }, { status: 400 });
    await db.log.create({
      data: { workspaceId: wid, type: "audit", action, detail: u.email },
    });
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
