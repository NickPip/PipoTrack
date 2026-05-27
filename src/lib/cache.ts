import { Redis } from "@upstash/redis";

// Tiny TTL key/value cache. Backed by Upstash Redis when configured (so it
// works across Vercel function instances) and by a per-instance Map when not
// (so local dev works without provisioning anything).
//
// Use for lookups that are:
//   - read-heavy
//   - safe to be a little stale (TTL > 0)
//   - keyable by a deterministic string
//
// Not a replacement for proper invalidation — use it for things like
// geocoding lookups and external API responses, not for app state.

const HAS_REDIS = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = HAS_REDIS
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// In-memory fallback. Per-instance and lost on cold start, but better than
// nothing when Redis isn't around. Capped at MAX_ENTRIES so a long-running
// dev server can't leak memory.
const MAX_ENTRIES = 1000;
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSec: number): void {
  if (memCache.size >= MAX_ENTRIES) {
    // Drop oldest 10% so we don't thrash on every set once full.
    const drop = Math.floor(MAX_ENTRIES / 10);
    const keys = [...memCache.keys()].slice(0, drop);
    for (const k of keys) memCache.delete(k);
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      // Upstash returns the parsed value (it auto-deserializes JSON).
      const v = await redis.get<T>(key);
      return v ?? null;
    } catch (err) {
      console.warn("[cache] redis get failed, falling back:", err);
      return memGet<T>(key);
    }
  }
  return memGet<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec });
      return;
    } catch (err) {
      console.warn("[cache] redis set failed, falling back:", err);
    }
  }
  memSet(key, value, ttlSec);
}

// Convenience: get-or-compute. Avoids the standard "check, compute, set"
// dance everywhere.
export async function cached<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  if (value !== null && value !== undefined) {
    await cacheSet(key, value, ttlSec);
  }
  return value;
}
