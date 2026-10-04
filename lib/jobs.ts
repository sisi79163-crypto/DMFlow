import { db } from "./db";
import type { Prisma } from "@prisma/client";
export async function enqueue(
  key: string,
  type: string,
  payload: Prisma.InputJsonValue,
  runAt = new Date(),
) {
  return db.job.upsert({
    where: { key },
    create: { key, type, payload, runAt },
    update: {},
  });
}
