import { describe, it, expect, beforeEach, vi } from "vitest";
import { cacheGet, cacheSet, cached } from "./cache";

describe("cache — in-memory fallback (no Redis env)", () => {
  beforeEach(() => {
    // No way to fully clear from outside; use unique keys per test instead.
    vi.useRealTimers();
  });

  it("set then get returns the value", async () => {
    const key = `t:set-get:${Math.random()}`;
    await cacheSet(key, { hello: "world" }, 60);
    expect(await cacheGet(key)).toEqual({ hello: "world" });
  });

  it("get returns null for unknown keys", async () => {
    expect(await cacheGet(`t:missing:${Math.random()}`)).toBe(null);
  });

  it("respects TTL and expires entries", async () => {
    const key = `t:ttl:${Math.random()}`;
    await cacheSet(key, "v", 60);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(await cacheGet(key)).toBe(null);
  });

  it("cached() returns cached value on second call without re-running compute", async () => {
    const key = `t:cached:${Math.random()}`;
    let computeCount = 0;
    const compute = async () => {
      computeCount++;
      return "computed";
    };

    expect(await cached(key, 60, compute)).toBe("computed");
    expect(await cached(key, 60, compute)).toBe("computed");
    expect(computeCount).toBe(1);
  });

  it("cached() does not cache null/undefined results", async () => {
    const key = `t:no-cache-null:${Math.random()}`;
    let computeCount = 0;
    const compute = async () => {
      computeCount++;
      return null;
    };

    await cached(key, 60, compute);
    await cached(key, 60, compute);
    expect(computeCount).toBe(2);
  });
});
