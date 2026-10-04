import { cookies } from "next/headers";
import { db } from "./db";
import { hash, randomToken } from "./security";
export async function currentUser() {
  const token = (await cookies()).get("dmflow_session")?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: { include: { workspace: true } } },
  });
  return s && s.expiresAt > new Date() ? s.user : null;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u?.workspace) throw new Error("UNAUTHORIZED");
  return { ...u, workspace: u.workspace };
}
export async function createSession(userId: string) {
  const token = randomToken();
  await db.session.create({
    data: {
      id: hash(token),
      userId,
      expiresAt: new Date(Date.now() + 604800000),
    },
  });
  (await cookies()).set("dmflow_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
