import "server-only";
import { HttpError } from "@/lib/auth";
import { env } from "@/lib/env";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function verifyCron(req: Request) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new HttpError(401, "Unauthorized");
  }
}
