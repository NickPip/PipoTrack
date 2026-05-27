import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

// Maps Prisma column names to human labels so the 409 message reads as
// "VIN '...' is already in use" instead of "vin '...' is already in use".
export type FieldLabels = Record<string, string>;

// Pulls a column name out of P2002's error meta. Shapes seen in the wild:
//
// Native Prisma engine:
//   meta.target = ["vin"] | "vin" | "Unit_vin_key"
//
// @prisma/adapter-pg wraps the raw Postgres error and does NOT set
// meta.target. The constraint name lives at:
//   meta.driverAdapterError.cause.originalMessage =
//     'duplicate key value violates unique constraint "Unit_vin_key"'
//   meta.driverAdapterError.cause.constraint =
//     { fields: ["vin"] }   (sometimes — depends on driver version)
//
// `knownFields` is the set of column names we have human labels for. We use
// it to pick the right token out of constraint names like `Unit_vin_key`
// and to filter out the table prefix.
function parseConstraintName(name: string, knownFields: string[]): string | null {
  const stripped = name.replace(/_key$/, "").replace(/_unique$/, "");
  const tokens = stripped.split("_");
  const match = tokens.find((t) => knownFields.includes(t));
  return match ?? null;
}

function extractField(err: unknown, knownFields: string[]): string | null {
  const meta = (err as { meta?: Record<string, unknown> } | undefined)?.meta;
  if (!meta) return null;

  // 1. Native engine path: meta.target.
  const target = meta.target as string | string[] | undefined;
  if (Array.isArray(target) && target.length) {
    return target.find((t) => knownFields.includes(t)) ?? target[0];
  }
  if (typeof target === "string") {
    if (knownFields.includes(target)) return target;
    const fromName = parseConstraintName(target, knownFields);
    if (fromName) return fromName;
    return target; // last resort: show raw constraint name
  }

  // 2. pg adapter path: meta.driverAdapterError.cause
  const cause = (
    meta.driverAdapterError as { cause?: Record<string, unknown> } | undefined
  )?.cause;
  if (cause) {
    // 2a. constraint.fields is an array of column names (when present).
    const constraint = cause.constraint as { fields?: string[] } | undefined;
    if (Array.isArray(constraint?.fields) && constraint.fields.length) {
      return (
        constraint.fields.find((f) => knownFields.includes(f)) ??
        constraint.fields[0]
      );
    }
    // 2b. parse the constraint name out of originalMessage.
    const msg = typeof cause.originalMessage === "string" ? cause.originalMessage : "";
    const m = msg.match(/unique constraint "([^"]+)"/);
    if (m) {
      const fromName = parseConstraintName(m[1], knownFields);
      if (fromName) return fromName;
      return m[1]; // last resort: raw constraint name
    }
  }

  return null;
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
    const field = extractField(err, Object.keys(labels));

    // If we ended up with no field, the meta shape didn't match anything we
    // know how to parse — log so we can extend the helper.
    if (!field && process.env.NODE_ENV !== "production") {
      console.warn("[prisma-errors] P2002 with unrecognized meta:", err.meta);
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
