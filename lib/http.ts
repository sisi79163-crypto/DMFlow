import { ZodError } from "zod";
export function failure(e: unknown) {
  const m = e instanceof Error ? e.message : "Unknown";
  const status =
    m === "UNAUTHORIZED"
      ? 401
      : m === "FORBIDDEN"
        ? 403
        : m === "RATE_LIMITED"
          ? 429
          : e instanceof ZodError
            ? 400
            : m === "NOT_FOUND"
              ? 404
              : 500;
  return Response.json(
    {
      error:
        status === 500
          ? "Request failed. Check server configuration and activity logs."
          : e instanceof ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : m,
    },
    { status },
  );
}
export async function body(req: Request) {
  const text = await req.text();
  if (text.length > 100000) throw new Error("FORBIDDEN");
  return JSON.parse(text);
}
