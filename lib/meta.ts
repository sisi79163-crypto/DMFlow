import { decrypt } from "./security";
import type { InstagramAccount } from "@prisma/client";
export class MetaError extends Error {
  constructor(
    public code: number,
    public retryable: boolean,
  ) {
    super("Meta API error " + code);
  }
}
export async function graph(
  path: string,
  token: string,
  method = "GET",
  data?: unknown,
) {
  const v = process.env.META_API_VERSION;
  if (!v || !/^v\d+\.0$/.test(v)) throw new Error("Configure META_API_VERSION");
  const r = await fetch(`https://graph.instagram.com/${v}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const b = await r.json();
  if (!r.ok || b.error)
    throw new MetaError(
      b.error?.code || r.status,
      r.status === 429 ||
        b.error?.is_transient === true ||
        [4, 17, 32, 613].includes(b.error?.code),
    );
  return b;
}
export function accountToken(a: InstagramAccount) {
  if (!a.connected || a.tokenExpiresAt < new Date())
    throw new Error("Instagram connection expired");
  return decrypt(a.tokenEncrypted);
}
export async function syncMedia(a: InstagramAccount) {
  const { db } = await import("./db");
  let after = "";
  for (let page = 0; page < 20; page++) {
    const b = await graph(
      `${a.instagramId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50${after ? "&after=" + encodeURIComponent(after) : ""}`,
      accountToken(a),
    );
    for (const m of b.data || []) {
      const data = {
        accountId: a.id,
        caption: m.caption || "",
        mediaType: m.media_type,
        mediaUrl: m.thumbnail_url || m.media_url,
        permalink: m.permalink,
        timestamp: new Date(m.timestamp),
      };
      await db.media.upsert({
        where: { id: m.id },
        create: { id: m.id, ...data },
        update: data,
      });
    }
    if (!b.paging?.next) break;
    after = b.paging.cursors.after;
  }
}
