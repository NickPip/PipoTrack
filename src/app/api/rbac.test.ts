import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable session — set per test. `auth()` returns whatever we put here.
const hoisted = vi.hoisted(() => ({ session: null as null | { user: Record<string, unknown> } }));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => hoisted.session),
}));

// Generic Prisma stub: every `prisma.<model>.<method>(...)` resolves to [].
// `$transaction` runs a callback with the same stub, or resolves an array of
// queued writes. Enough for handlers to get *past* the auth gate without I/O.
vi.mock("@/lib/prisma", () => {
  const method = () => vi.fn().mockResolvedValue([]);
  const modelProxy = () => new Proxy({}, { get: () => method() });
  const prisma: Record<string, unknown> = new Proxy(
    {
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : [],
      ),
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        return modelProxy();
      },
    },
  );
  return { prisma };
});

// Network-heavy modules: stub so "allowed" cases don't do real I/O or hang.
vi.mock("@/bot/bot", () => ({
  getBot: () => ({
    api: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setWebhook: vi.fn().mockResolvedValue(undefined),
      getWebhookInfo: vi.fn().mockResolvedValue({}),
      deleteWebhook: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));
vi.mock("@/bot/sendLoad", () => ({ distributeLoad: vi.fn().mockResolvedValue(0) }));
vi.mock("@/lib/email/imap", () => ({ pollInbox: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/mapbox", () => ({ drivingMiles: vi.fn().mockResolvedValue(0) }));
vi.mock("@/lib/supabase-storage", () => ({ uploadFile: vi.fn().mockResolvedValue("http://x/y") }));

import * as bid from "./dispatch/loads/[id]/bid/route";
import * as book from "./dispatch/loads/[id]/book/route";
import * as hold from "./dispatch/loads/[id]/hold/route";
import * as dispatchLoads from "./dispatch/loads/route";
import * as driversId from "./drivers/[id]/route";
import * as availabilities from "./drivers/availabilities/route";
import * as driversMap from "./drivers/map/route";
import * as drivers from "./drivers/route";
import * as emailLogs from "./email/logs/route";
import * as emailTrigger from "./email/trigger/route";
import * as notes from "./loads/[id]/notes/route";
import * as loadsId from "./loads/[id]/route";
import * as loads from "./loads/route";
import * as ownersId from "./owners/[id]/route";
import * as owners from "./owners/route";
import * as telegramDistribute from "./telegram/distribute/route";
import * as telegramSetup from "./telegram/setup/route";
import * as unitsId from "./units/[id]/route";
import * as units from "./units/route";
import * as upload from "./upload/route";
import * as usersId from "./users/[id]/route";
import * as users from "./users/route";

type Role = "ADMIN" | "RECRUITING" | "DISPATCHER" | "OPERATIONS" | "ACCOUNTING";
const ROLES: Role[] = ["ADMIN", "RECRUITING", "DISPATCHER", "OPERATIONS", "ACCOUNTING"];

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
type Case = {
  name: string;
  fn: Handler;
  method: string;
  // "role": denied subjects get 403; "auth": only unauthenticated denied (401).
  kind: "role" | "auth";
  allowed?: Role[];
  form?: boolean;
};

// Shorthand role sets matching lib/rbac.ts ACCESS/MUTATE maps.
const RECRUITING = ["ADMIN", "RECRUITING"] as Role[];
const RECRUITING_READ_WIDE = ["ADMIN", "RECRUITING", "OPERATIONS", "ACCOUNTING"] as Role[];
const DISPATCH = ["ADMIN", "DISPATCHER"] as Role[];
const OPS_READ = ["ADMIN", "OPERATIONS", "ACCOUNTING"] as Role[];
const OPS_MUTATE = ["ADMIN", "OPERATIONS"] as Role[];
const ACCOUNTING = ["ADMIN", "ACCOUNTING"] as Role[];
const ADMIN_ONLY = ["ADMIN"] as Role[];

const cases: Case[] = [
  // Admin-only
  { name: "GET /users", fn: users.GET as unknown as Handler, method: "GET", kind: "role", allowed: ADMIN_ONLY },
  { name: "POST /users", fn: users.POST as unknown as Handler, method: "POST", kind: "role", allowed: ADMIN_ONLY },
  { name: "PUT /users/[id]", fn: usersId.PUT as unknown as Handler, method: "PUT", kind: "role", allowed: ADMIN_ONLY },
  { name: "DELETE /users/[id]", fn: usersId.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: ADMIN_ONLY },
  { name: "GET /telegram/setup", fn: telegramSetup.GET as unknown as Handler, method: "GET", kind: "role", allowed: ADMIN_ONLY },
  { name: "DELETE /telegram/setup", fn: telegramSetup.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: ADMIN_ONLY },

  // Recruiting read
  { name: "GET /drivers", fn: drivers.GET as unknown as Handler, method: "GET", kind: "role", allowed: RECRUITING },
  { name: "GET /owners", fn: owners.GET as unknown as Handler, method: "GET", kind: "role", allowed: RECRUITING },
  // Units read is wider (recruiting OR operations OR accounting)
  { name: "GET /units", fn: units.GET as unknown as Handler, method: "GET", kind: "role", allowed: RECRUITING_READ_WIDE },

  // Recruiting mutate
  { name: "POST /drivers", fn: drivers.POST as unknown as Handler, method: "POST", kind: "role", allowed: RECRUITING },
  { name: "PUT /drivers/[id]", fn: driversId.PUT as unknown as Handler, method: "PUT", kind: "role", allowed: RECRUITING },
  { name: "DELETE /drivers/[id]", fn: driversId.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: RECRUITING },
  { name: "POST /owners", fn: owners.POST as unknown as Handler, method: "POST", kind: "role", allowed: RECRUITING },
  { name: "PUT /owners/[id]", fn: ownersId.PUT as unknown as Handler, method: "PUT", kind: "role", allowed: RECRUITING },
  { name: "DELETE /owners/[id]", fn: ownersId.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: RECRUITING },
  { name: "POST /units", fn: units.POST as unknown as Handler, method: "POST", kind: "role", allowed: RECRUITING },
  { name: "PUT /units/[id]", fn: unitsId.PUT as unknown as Handler, method: "PUT", kind: "role", allowed: RECRUITING },
  { name: "PATCH /units/[id]", fn: unitsId.PATCH as unknown as Handler, method: "PATCH", kind: "role", allowed: RECRUITING },
  { name: "DELETE /units/[id]", fn: unitsId.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: RECRUITING },
  { name: "POST /upload", fn: upload.POST as unknown as Handler, method: "POST", kind: "role", allowed: RECRUITING, form: true },

  // Dispatch read
  { name: "GET /dispatch/loads", fn: dispatchLoads.GET as unknown as Handler, method: "GET", kind: "role", allowed: DISPATCH },
  { name: "GET /email/logs", fn: emailLogs.GET as unknown as Handler, method: "GET", kind: "role", allowed: DISPATCH },

  // Dispatch mutate
  { name: "POST /dispatch/loads/[id]/bid", fn: bid.POST as unknown as Handler, method: "POST", kind: "role", allowed: DISPATCH },
  { name: "POST /dispatch/loads/[id]/book", fn: book.POST as unknown as Handler, method: "POST", kind: "role", allowed: DISPATCH },
  { name: "POST /dispatch/loads/[id]/hold", fn: hold.POST as unknown as Handler, method: "POST", kind: "role", allowed: DISPATCH },
  { name: "POST /email/trigger", fn: emailTrigger.POST as unknown as Handler, method: "POST", kind: "role", allowed: DISPATCH },
  { name: "POST /telegram/distribute", fn: telegramDistribute.POST as unknown as Handler, method: "POST", kind: "role", allowed: DISPATCH },
  { name: "PATCH /drivers/availabilities", fn: availabilities.PATCH as unknown as Handler, method: "PATCH", kind: "role", allowed: DISPATCH },

  // Any authenticated user
  { name: "GET /drivers/availabilities", fn: availabilities.GET as unknown as Handler, method: "GET", kind: "auth" },
  { name: "GET /drivers/map", fn: driversMap.GET as unknown as Handler, method: "GET", kind: "auth" },

  // Operations read (ACCOUNTING can read operations)
  { name: "GET /loads", fn: loads.GET as unknown as Handler, method: "GET", kind: "role", allowed: OPS_READ },
  { name: "GET /loads/[id]/notes", fn: notes.GET as unknown as Handler, method: "GET", kind: "role", allowed: OPS_READ },

  // Operations mutate (ACCOUNTING excluded)
  { name: "POST /loads", fn: loads.POST as unknown as Handler, method: "POST", kind: "role", allowed: OPS_MUTATE },
  { name: "PUT /loads/[id]", fn: loadsId.PUT as unknown as Handler, method: "PUT", kind: "role", allowed: OPS_MUTATE },
  { name: "DELETE /loads/[id]", fn: loadsId.DELETE as unknown as Handler, method: "DELETE", kind: "role", allowed: OPS_MUTATE },

  // Accounting mutate (financial status)
  { name: "PATCH /loads/[id]", fn: loadsId.PATCH as unknown as Handler, method: "PATCH", kind: "role", allowed: ACCOUNTING },

  // Notes write — operations OR accounting
  { name: "POST /loads/[id]/notes", fn: notes.POST as unknown as Handler, method: "POST", kind: "role", allowed: OPS_READ },
];

function makeReq(c: Case): Request {
  if (c.form) return new Request("http://test/api", { method: "POST", body: new FormData() });
  const hasBody = c.method !== "GET" && c.method !== "DELETE";
  return new Request("http://test/api", {
    method: c.method,
    body: hasBody ? JSON.stringify({}) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const ctx = { params: Promise.resolve({ id: "test-id" }) };

beforeEach(() => {
  hoisted.session = null;
});

describe("RBAC matrix — every protected route × every role", () => {
  for (const c of cases) {
    const subjects: (Role | null)[] = [...ROLES, null];
    for (const role of subjects) {
      const label = role ?? "unauthenticated";
      it(`${c.name} — ${label}`, async () => {
        hoisted.session = role
          ? { user: { id: "u1", name: "Test User", email: "t@test.com", role } }
          : null;

        const res = await c.fn(makeReq(c), ctx);

        if (c.kind === "auth") {
          if (role === null) {
            expect(res.status).toBe(401);
          } else {
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
          }
        } else {
          const allowed = role !== null && c.allowed!.includes(role);
          if (allowed) {
            expect(res.status).not.toBe(403);
          } else {
            expect(res.status).toBe(403);
          }
        }
      });
    }
  }
});
