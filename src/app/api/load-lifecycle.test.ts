import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable auth role — switch between DISPATCHER (bid/book) and OPERATIONS (PUT).
const auth = vi.hoisted(() => ({ role: "DISPATCHER" as string }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "u1", name: "Test User", email: "t@test.com", role: auth.role },
  })),
}));

// Stateful in-memory store standing in for the database. Mutations persist
// across handler calls so we can walk a single load through its whole lifecycle.
type Bid = { id: string; loadId: string; driverId: string; status: string; amount: number };
type Load = Record<string, unknown> & { id: string; status: string };
const db = vi.hoisted(() => ({
  load: null as Load | null,
  bids: [] as Bid[],
  notes: [] as Record<string, unknown>[],
  drivers: {} as Record<string, { id: string; unitId: string | null; telegramId: string | null; name: string }>,
}));

vi.mock("@/lib/prisma", () => {
  const load = {
    findUnique: vi.fn(async ({ select, include }: { select?: Record<string, unknown>; include?: { bids?: { where?: { status?: string } } } }) => {
      if (!db.load) return null;
      if (include?.bids) {
        const accepted = db.bids
          .filter((b) => b.status === (include.bids!.where?.status ?? b.status))
          .slice(0, 1)
          .map((b) => ({ ...b, driver: db.drivers[b.driverId] ?? null }));
        return { ...db.load, bids: accepted };
      }
      if (select?.status) return { status: db.load.status };
      return { ...db.load };
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      db.load = { ...(db.load as Load), ...data } as Load;
      return { ...db.load };
    }),
  };
  const bid = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => db.bids.find((b) => b.id === where.id) ?? null),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const b = db.bids.find((x) => x.id === where.id);
      if (b) Object.assign(b, data);
      return b;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id?: { not: string } }; data: Record<string, unknown> }) => {
      const exclude = where.id?.not;
      let count = 0;
      for (const b of db.bids) {
        if (b.id !== exclude) { Object.assign(b, data); count++; }
      }
      return { count };
    }),
  };
  const loadNote = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { db.notes.push(data); return data; }),
  };
  const prisma = {
    load,
    bid,
    loadNote,
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : [],
    ),
  };
  return { prisma };
});

vi.mock("@/bot/bot", () => ({
  getBot: () => ({ api: { sendMessage: vi.fn().mockResolvedValue(undefined) } }),
}));

import * as bidRoute from "./dispatch/loads/[id]/bid/route";
import * as bookRoute from "./dispatch/loads/[id]/book/route";
import * as loadRoute from "./loads/[id]/route";

const ctx = { params: Promise.resolve({ id: "load-1" }) };

function req(method: string, body?: unknown): Request {
  return new Request("http://test/api", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function putStatus(status: string) {
  auth.role = "OPERATIONS";
  return loadRoute.PUT(req("PUT", { status }) as never, ctx as never);
}

beforeEach(() => {
  db.drivers = { "driver-1": { id: "driver-1", unitId: "unit-1", telegramId: "tg-1", name: "Joe" } };
  db.bids = [{ id: "bid-1", loadId: "load-1", driverId: "driver-1", status: "pending", amount: 1000 }];
  db.load = { id: "load-1", status: "HAS_BIDS", driverId: null };
  db.notes = [];
});

describe("load lifecycle — dispatch handoff through operations delivery", () => {
  it("walks HAS_BIDS → QUOTED → BOOKED(PENDING) → ... → DELIVERED", async () => {
    // 1. Dispatcher accepts a bid → load becomes QUOTED, bid accepted.
    auth.role = "DISPATCHER";
    const bidRes = await bidRoute.POST(
      req("POST", { bidId: "bid-1", driverId: "driver-1", driverRate: 900, rate: 1100 }) as never,
      ctx as never,
    );
    expect(bidRes.status).toBe(200);
    expect(db.load!.status).toBe("QUOTED");
    expect(db.bids[0].status).toBe("accepted");

    // 2. Dispatcher books the quoted load → enters operations as PENDING.
    const bookRes = await bookRoute.POST(req("POST") as never, ctx as never);
    expect(bookRes.status).toBe(200);
    expect(db.load!.status).toBe("PENDING");

    // 3. Operations advances through each lifecycle step.
    const steps = [
      "DISPATCHED_TO_PICKUP",
      "ONSITE_FOR_PICKUP",
      "LOADED_AND_DELIVERING",
      "ONSITE_FOR_DELIVERY",
      "DELIVERED",
    ];
    for (const next of steps) {
      const res = await putStatus(next);
      expect(res.status).toBe(200);
      expect(db.load!.status).toBe(next);
    }

    // Each status change wrote a system audit note (5 operations steps).
    expect(db.notes.length).toBe(5);
    expect(db.notes[0]).toMatchObject({ isSystem: true });
  });

  it("rejects an illegal status jump (PENDING → DELIVERED)", async () => {
    db.load = { id: "load-1", status: "PENDING", driverId: "driver-1" };
    const res = await putStatus("DELIVERED");
    expect(res.status).toBe(400);
    expect(db.load!.status).toBe("PENDING"); // unchanged
    expect(db.notes.length).toBe(0);
  });

  it("rejects changing a terminal (DELIVERED) load", async () => {
    db.load = { id: "load-1", status: "DELIVERED", driverId: "driver-1" };
    const res = await putStatus("PENDING");
    expect(res.status).toBe(400);
    expect(db.load!.status).toBe("DELIVERED");
  });

  it("allows cancelling from mid-transit", async () => {
    db.load = { id: "load-1", status: "LOADED_AND_DELIVERING", driverId: "driver-1" };
    const res = await putStatus("CANCELED");
    expect(res.status).toBe(200);
    expect(db.load!.status).toBe("CANCELED");
  });
});
