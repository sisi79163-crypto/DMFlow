import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const l = await db.trackedLink.findUnique({ where: { id } });
  if (!l) return new Response("Not found", { status: 404 });
  if (new URL(l.destination).protocol !== "https:")
    return new Response("Invalid destination", { status: 400 });
  await db.trackedLink.update({
    where: { id },
    data: { clicks: { increment: 1 } },
  });
  const res = NextResponse.redirect(l.destination, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
