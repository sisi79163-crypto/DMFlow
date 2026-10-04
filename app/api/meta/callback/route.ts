import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hash, encrypt } from "@/lib/security";
import { graph, syncMedia } from "@/lib/meta";
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL!;
  try {
    const u = await requireUser();
    const state = req.nextUrl.searchParams.get("state"),
      code = req.nextUrl.searchParams.get("code");
    if (!state || state !== req.cookies.get("dmflow_oauth")?.value || !code)
      throw new Error("Invalid OAuth callback");
    const s = await db.oAuthState.findUnique({ where: { id: hash(state) } });
    if (!s || s.workspaceId !== u.workspace.id || s.expiresAt < new Date())
      throw new Error("Expired state");
    const consumed = await db.oAuthState.deleteMany({ where: { id: s.id } });
    if (!consumed.count) throw new Error("State already consumed");
    const short = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: base + "/api/meta/callback",
        code,
      }),
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json());
    if (!short.access_token) throw new Error("Token exchange failed");
    const q = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: process.env.META_APP_SECRET!,
      access_token: short.access_token,
    });
    const long = await fetch("https://graph.instagram.com/access_token?" + q, {
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json());
    if (!long.access_token) throw new Error("Long token exchange failed");
    const p = await graph("me?fields=user_id,username", long.access_token);
    const instagramId = String(p.user_id || p.id);
    const old = await db.instagramAccount.findUnique({
      where: { instagramId },
    });
    if (old && old.workspaceId !== u.workspace.id)
      throw new Error("Account already belongs to another workspace");
    const data = {
      username: p.username,
      tokenEncrypted: encrypt(long.access_token),
      tokenExpiresAt: new Date(
        Date.now() + (long.expires_in || 5184000) * 1000,
      ),
      connected: true,
    };
    const a = await db.instagramAccount.upsert({
      where: { instagramId },
      create: { workspaceId: u.workspace.id, instagramId, ...data },
      update: data,
    });
    await graph(`${instagramId}/subscribed_apps`, long.access_token, "POST", {
      subscribed_fields: "comments,messages,messaging_postbacks",
    });
    await syncMedia(a);
    await db.log.create({
      data: {
        workspaceId: u.workspace.id,
        type: "audit",
        action: "meta.connected",
        detail: a.username,
      },
    });
    const res = NextResponse.redirect(base + "/?view=connection&connected=1");
    res.cookies.delete("dmflow_oauth");
    return res;
  } catch {
    return NextResponse.redirect(base + "/?view=connection&error=oauth");
  }
}
