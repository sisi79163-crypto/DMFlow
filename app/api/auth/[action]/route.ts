import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { requireOrigin, hash } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { failure, body } from "@/lib/http";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireOrigin(req);
    const { action } = await params;
    if (action === "logout") {
      const c = await cookies(),
        t = c.get("dmflow_session")?.value;
      if (t) await db.session.deleteMany({ where: { id: hash(t) } });
      c.delete("dmflow_session");
      return Response.json({ ok: true });
    }
    const b = z
      .object({
        email: z
          .string()
          .email()
          .max(254)
          .transform((x) => x.toLowerCase()),
        password: z
          .string()
          .min(12)
          .max(72)
          .refine(
            (s) => Buffer.byteLength(s, "utf8") <= 72,
            "Password must be at most 72 UTF-8 bytes",
          ),
        name: z.string().min(1).max(80).optional(),
      })
      .parse(await body(req));
    await rateLimit("auth:" + hash(b.email), 10, 900);
    if (action === "register") {
      if (process.env.REGISTRATION_ENABLED !== "true")
        return Response.json(
          { error: "Registration is disabled" },
          { status: 403 },
        );
      const passwordHash = await bcrypt.hash(b.password, 12);
      try {
        const u = await db.user.create({
          data: {
            email: b.email,
            name: b.name || b.email.split("@")[0],
            passwordHash,
            workspace: { create: {} },
          },
        });
        await createSession(u.id);
      } catch {
        return Response.json(
          { error: "Unable to create account with these details" },
          { status: 400 },
        );
      }
    } else if (action === "login") {
      const u = await db.user.findUnique({ where: { email: b.email } });
      const valid = await bcrypt.compare(
        b.password,
        u?.passwordHash ||
          "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid",
      );
      if (!u || !valid)
        return Response.json(
          { error: "Invalid email or password" },
          { status: 401 },
        );
      await createSession(u.id);
    } else return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
