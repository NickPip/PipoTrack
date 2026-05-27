import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

// Maps Prisma column names to human labels so the 409 message reads as
// "VIN '...' is already in use" instead of "vin '...' is already in use".
export type FieldLabels = Record<string, string>;

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

  // P2002 — unique constraint failed. Prisma puts the conflicting columns in
  // err.meta.target which is either a string or string[].
  if (err.code === "P2002") {
    const raw = (err.meta as { target?: string | string[] } | undefined)?.target;
    const fields = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const field = fields[0];
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
