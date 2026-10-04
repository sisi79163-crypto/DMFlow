import { db } from "./db";
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","resetAt") VALUES (${key},1,NOW()+(${seconds} * INTERVAL '1 second')) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count"+1 END,"resetAt"=CASE WHEN "RateLimit"."resetAt" < NOW() THEN NOW()+(${seconds} * INTERVAL '1 second') ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  if (rows[0].count > limit) throw new Error("RATE_LIMITED");
}
