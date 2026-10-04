import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/security";
export async function POST(req: NextRequest) {
  try {
    const signed = (await req.formData()).get("signed_request");
    if (typeof signed !== "string" || !process.env.META_APP_SECRET)
      return new Response("Forbidden", { status: 403 });
    const [signature, encoded] = signed.split(".");
    const actual = Buffer.from(signature, "base64url"),
      expected = createHmac("sha256", process.env.META_APP_SECRET)
        .update(encoded)
        .digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return new Response("Forbidden", { status: 403 });
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (payload.algorithm !== "HMAC-SHA256" || !payload.user_id)
      return new Response("Forbidden", { status: 403 });
    const id = String(payload.user_id);
    const code = randomToken();
    await db.$transaction(async (tx) => {
      const a = await tx.instagramAccount.findUnique({
        where: { instagramId: id },
      });
      if (a) {
        const leads = await tx.lead.findMany({
          where: { accountId: a.id },
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
        await tx.instagramAccount.delete({ where: { id: a.id } });
      }
      const events = await tx.webhookEvent.findMany({
        where: { accountExternalId: id },
        select: { id: true },
      });
      await tx.job.deleteMany({
        where: { key: { in: events.map((e) => "webhook:" + e.id) } },
      });
      await tx.webhookEvent.deleteMany({ where: { accountExternalId: id } });
      await tx.deletionRequest.create({ data: { id: code } });
    });
    return Response.json({
      url: process.env.APP_URL + "/api/meta/deletion?id=" + code,
      confirmation_code: code,
    });
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const d = await db.deletionRequest.findUnique({ where: { id } });
  return Response.json(
    d
      ? { status: "completed", completedAt: d.completedAt }
      : { status: "not_found" },
    { status: d ? 200 : 404 },
  );
}
