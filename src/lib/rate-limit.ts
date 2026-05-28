import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazily build a Ratelimit instance per-name so the same identifier (e.g. an
// IP) is limited consistently across requests. When Upstash env vars are
// unset we fall back to a no-op limiter that always allows the request — this
// keeps local dev working without provisioning Redis and makes the rollout
// safe (the code can ship before the env var lands).

const HAS_REDIS = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

type Window = `${number} ${"s" | "m" | "h"}`;

type Limiter = {
  limit: (identifier: string) => Promise<{ success: boolean; reset: number; remaining: number }>;
};

const cache = new Map<string, Limiter>();

function buildLimiter(prefix: string, requests: number, window: Window): Limiter {
  if (!HAS_REDIS) {
    return {
      async limit() {
        // In production the no-op fallback would silently disable abuse
        // protection (e.g. login brute-force throttling), so refuse rather
        // than fail open. The check lives here (request time) not in the
        // constructor so importing this module during `next build` doesn't
        // throw. Startup env validation normally prevents ever reaching this.
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            `Rate limiter "${prefix}" requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production`,
          );
        }
        return { success: true, reset: 0, remaining: requests };
      },
    };
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:${prefix}`,
    analytics: false,
  });
}

export function getLimiter(name: string, requests: number, window: Window): Limiter {
  const key = `${name}:${requests}:${window}`;
  let limiter = cache.get(key);
  if (!limiter) {
    limiter = buildLimiter(name, requests, window);
    cache.set(key, limiter);
  }
  return limiter;
}

// Best-effort client IP. Vercel sets x-forwarded-for; first entry is the real
// client. Falls back to a sentinel so a missing header doesn't bypass the
// limit (everyone unidentified shares the same bucket).
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
