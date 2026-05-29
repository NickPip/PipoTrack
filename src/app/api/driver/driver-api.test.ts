import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { hash } from "bcryptjs";

const db = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  locUpsert: vi.fn(),
  bidFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driver: {
      findFirst: (...a: unknown[]) => db.findFirst(...a),
      findUnique: (...a: unknown[]) => db.findUnique(...a),
      update: (...a: unknown[]) => db.update(...a),
    },
    driverLocation: { upsert: (...a: unknown[]) => db.locUpsert(...a) },
    bid: { findMany: (...a: unknown[]) => db.bidFindMany(...a) },
  },
}));

import * as login from "./login/route";
import * as location from "./location/route";
import * as loads from "./loads/route";

function req(method: string, opts: { body?: unknown; token?: string } = {}): Request {
  return new Request("http://test/api/driver", {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

let pwHash: string;
beforeAll(async () => {
  pwHash = await hash("secret", 12);
});
beforeEach(() => {
  for (const f of Object.values(db)) f.mockReset();
});

describe("POST /api/driver/login", () => {
  it("400 on malformed body", async () => {
    const res = await login.POST(req("POST", { body: {} }));
    expect(res.status).toBe(400);
  });

  it("401 on unknown username", async () => {
    db.findFirst.mockResolvedValue(null);
    const res = await login.POST(req("POST", { body: { username: "ghost", password: "secret" } }));
    expect(res.status).toBe(401);
  });

  it("401 on wrong password", async () => {
    db.findFirst.mockResolvedValue({ id: "d1", name: "Joe", appPassword: pwHash });
    const res = await login.POST(req("POST", { body: { username: "joe", password: "nope" } }));
    expect(res.status).toBe(401);
  });

  it("401 when the driver has no password set", async () => {
    db.findFirst.mockResolvedValue({ id: "d1", name: "Joe", appPassword: null });
    const res = await login.POST(req("POST", { body: { username: "joe", password: "secret" } }));
    expect(res.status).toBe(401);
  });

  it("issues a rotated token on valid credentials", async () => {
    db.findFirst.mockResolvedValue({ id: "d1", name: "Joe", appPassword: pwHash });
    db.update.mockResolvedValue({});

    const res = await login.POST(req("POST", { body: { username: "joe", password: "secret" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(20);
    expect(json.driver).toMatchObject({ id: "d1", name: "Joe" });
    // token was persisted
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: { appToken: json.token } }),
    );
  });
});

describe("POST /api/driver/location", () => {
  it("401 without a token", async () => {
    const res = await location.POST(req("POST", { body: { lat: 1, lon: 2 } }));
    expect(res.status).toBe(401);
    expect(db.locUpsert).not.toHaveBeenCalled();
  });

  it("401 with an unknown token", async () => {
    db.findUnique.mockResolvedValue(null);
    const res = await location.POST(req("POST", { body: { lat: 1, lon: 2 }, token: "bad" }));
    expect(res.status).toBe(401);
  });

  it("400 on invalid coordinates", async () => {
    db.findUnique.mockResolvedValue({ id: "d1" });
    const res = await location.POST(req("POST", { body: { lat: "x" }, token: "good" }));
    expect(res.status).toBe(400);
  });

  it("204 and upserts on a valid fix", async () => {
    db.findUnique.mockResolvedValue({ id: "d1" });
    db.locUpsert.mockResolvedValue({});
    const res = await location.POST(req("POST", { body: { lat: 25.7, lon: -80.2, speed: 30 }, token: "good" }));
    expect(res.status).toBe(204);
    expect(db.locUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { driverId: "d1" } }),
    );
  });
});

describe("GET /api/driver/loads", () => {
  it("401 without a token", async () => {
    const res = await loads.GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("returns the driver's offered loads with their bid status", async () => {
    db.findUnique.mockResolvedValue({ id: "d1" });
    db.bidFindMany.mockResolvedValue([
      { amount: 0, status: "sent", load: { id: "l1", loadNumber: 7, pickupAddress: "A" } },
    ]);
    const res = await loads.GET(req("GET", { token: "good" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.loads).toHaveLength(1);
    expect(json.loads[0]).toMatchObject({ id: "l1", loadNumber: 7, bidStatus: "sent", bidAmount: 0 });
  });
});
