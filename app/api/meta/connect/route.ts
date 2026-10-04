import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hash, randomToken, requireOrigin } from "@/lib/security";
import { failure } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    requireOrigin(req);
    const u = await requireUser();
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET)
      return Response.json(
        {
          error:
            "Configure META_APP_ID and META_APP_SECRET on the server first.",
        },
        { status: 503 },
      );
    const s = randomToken();
    await db.oAuthState.create({
      data: {
        id: hash(s),
        workspaceId: u.workspace.id,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: process.env.APP_URL + "/api/meta/callback",
      response_type: "code",
      scope:
        "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages",
      state: s,
      enable_fb_login: "0",
      force_authentication: "1",
    }).toString();
    const res = NextResponse.json({ url: url.toString() });
    res.cookies.set("dmflow_oauth", s, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/meta",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    return failure(e);
  }
}
