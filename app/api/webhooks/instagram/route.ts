import { NextRequest } from "next/server";
import { signatureValid, hash } from "@/lib/security";
import { db } from "@/lib/db";
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return p.get("hub.mode") === "subscribe" &&
    !!process.env.META_WEBHOOK_VERIFY_TOKEN &&
    p.get("hub.verify_token") === process.env.META_WEBHOOK_VERIFY_TOKEN
    ? new Response(p.get("hub.challenge"), { status: 200 })
    : new Response("Forbidden", { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1000000) return new Response("Too large", { status: 413 });
  if (
    !signatureValid(
      raw,
      req.headers.get("x-hub-signature-256"),
      process.env.META_APP_SECRET || "",
    )
  )
    return new Response("Forbidden", { status: 403 });
  try {
    const b = JSON.parse(raw);
    if (b.object !== "instagram") return Response.json({ ok: true });
    await db.$transaction(async (tx) => {
      for (const e of b.entry || []) {
        const id = hash(JSON.stringify(e));
        await tx.webhookEvent.upsert({
          where: { id },
          create: { id, accountExternalId: String(e.id), payload: e },
          update: {},
        });
        await tx.job.upsert({
          where: { key: "webhook:" + id },
          create: {
            key: "webhook:" + id,
            type: "webhook",
            payload: { eventId: id },
          },
          update: {},
        });
      }
    });
    return Response.json({ ok: true });
  } catch {
    return new Response("Retry later", { status: 503 });
  }
}
