import { z } from "zod";

// Always required, in every environment. Without these the app cannot run at
// all — fail loudly at startup rather than crashing on first request.
const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
});

// Required in production only. Each of these has a dev-friendly fallback (the
// no-op rate limiter, the skipped webhook auth) that is fine locally but must
// never be relied on in production — so we refuse to boot prod without them.
const PROD_REQUIRED = [
  "CRON_SECRET",
  "TELEGRAM_WEBHOOK_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export function validateEnv(): void {
  const errors: string[] = [];

  const base = baseSchema.safeParse(process.env);
  if (!base.success) {
    for (const issue of base.error.issues) errors.push(issue.message);
  }

  if (process.env.NODE_ENV === "production") {
    for (const key of PROD_REQUIRED) {
      if (!process.env[key]) errors.push(`${key} is required in production`);
    }
  }

  if (errors.length) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join("\n  - ")}`,
    );
  }
}
