import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

// Maps Prisma column names to human labels so the 409 message reads as
// "VIN '...' is already in use" instead of "vin '...' is already in use".
export type FieldLabels = Record<string, string>;

// Pulls a column name out of whatever Prisma puts in P2002's `meta.target`.
// Shapes seen in the wild:
//   - string[]: ["vin"]                       — native Prisma engine
//   - string:   "vin"                         — sometimes
//   - string:   "Unit_vin_key"                — Postgres constraint name
//                                               (common with @prisma/adapter-pg)
//   - string:   "Unit_unitNumber_vin_key"     — multi-column constraint
//
// `knownFields` is the set of column names we have human labels for; we use
// it to pick the right token out of a constraint name like Unit_vin_key.
function extractField(
  target: string | string[] | undefined,
  knownFields: string[],
): string | null {
  if (!target) return null;
  if (Array.isArray(target)) return target[0] ?? null;

  // Direct column name.
  if (knownFields.includes(target)) return target;

  // Constraint name like `Unit_vin_key`. Strip the `_key` suffix and look
  // for the first token that matches a known field.
  const stripped = target.replace(/_key$/, "");
  const tokens = stripped.split("_");
  const match = tokens.find((t) => knownFields.includes(t));
  if (match) return match;

  // Last resort: return the raw string so the user at least sees the
  // constraint name instead of "value".
  return target;
}

// Catches the most common Prisma write errors and turns them into clean
// JSON responses. Use as the catch arm of an API route:
//
//   try { ... } catch (err) {
//     const res = handlePrismaError(err, { vin: "VIN", unitNumber: "Unit number" });
//     if (res) return res;
//     throw err;
//   }
//
// Returns null when the error isn't one we know how to format — caller
// should rethrow so the default 500 path still runs.
export function handlePrismaError(
  err: unknown,
  labels: FieldLabels = {},
  values: Record<string, unknown> = {},
): NextResponse | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;

  // P2002 — unique constraint failed.
  if (err.code === "P2002") {
    const raw = (err.meta as { target?: string | string[] } | undefined)?.target;
    const field = extractField(raw, Object.keys(labels));

    // If we ended up with the generic "value" label, the meta shape didn't
    // match anything we know how to parse — log so we can extend the helper.
    if (!field && process.env.NODE_ENV !== "production") {
      console.warn("[prisma-errors] P2002 with unrecognized meta.target:", err.meta);
    }

    const label = (field && labels[field]) || field || "value";
    const v = field && values[field];
    const valuePart = v != null && v !== "" ? ` "${v}"` : "";
    return NextResponse.json(
      { error: `${label}${valuePart} is already in use.` },
      { status: 409 },
    );
  }

  // P2003 — foreign-key violation. Usually means the client sent an id that
  // points at a deleted row (e.g. ownerId of a deleted owner).
  if (err.code === "P2003") {
    const fk = (err.meta as { field_name?: string } | undefined)?.field_name;
    const label = (fk && labels[fk]) || "related record";
    return NextResponse.json(
      { error: `Referenced ${label} no longer exists.` },
      { status: 409 },
    );
  }

  // P2025 — record not found (update/delete with no matching row).
  if (err.code === "P2025") {
    return NextResponse.json(
      { error: "Record not found or already deleted." },
      { status: 404 },
    );
  }

  return null;
}
