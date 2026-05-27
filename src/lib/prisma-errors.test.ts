import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { handlePrismaError } from "./prisma-errors";

function p2002(meta: object): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    { code: "P2002", clientVersion: "test", meta: meta as never },
  );
}

const UNIT_LABELS = {
  unitNumber: "Unit number",
  vin: "VIN",
  plateNumber: "Plate number",
};

async function bodyOf(res: Response): Promise<{ error: string }> {
  return JSON.parse(await res.text()) as { error: string };
}

describe("handlePrismaError — P2002", () => {
  it("returns null for non-Prisma errors", () => {
    expect(handlePrismaError(new Error("plain"))).toBe(null);
    expect(handlePrismaError("string error")).toBe(null);
    expect(handlePrismaError(null)).toBe(null);
  });

  it("handles native engine shape: meta.target as string[]", async () => {
    const err = p2002({ target: ["vin"] });
    const res = handlePrismaError(err, UNIT_LABELS, { vin: "ABC123" });
    expect(res?.status).toBe(409);
    expect((await bodyOf(res!)).error).toBe('VIN "ABC123" is already in use.');
  });

  it("handles native engine shape: meta.target as string", async () => {
    const err = p2002({ target: "unitNumber" });
    const res = handlePrismaError(err, UNIT_LABELS, { unitNumber: "U-001" });
    expect((await bodyOf(res!)).error).toBe('Unit number "U-001" is already in use.');
  });

  it("parses Postgres constraint name shape (Unit_vin_key)", async () => {
    const err = p2002({ target: "Unit_vin_key" });
    const res = handlePrismaError(err, UNIT_LABELS, { vin: "ABC123" });
    expect((await bodyOf(res!)).error).toBe('VIN "ABC123" is already in use.');
  });

  it("handles pg-adapter shape via driverAdapterError.cause.originalMessage", async () => {
    const err = p2002({
      modelName: "Unit",
      driverAdapterError: {
        cause: {
          originalMessage: 'duplicate key value violates unique constraint "Unit_vin_key"',
          kind: "UniqueConstraintViolation",
        },
      },
    });
    const res = handlePrismaError(err, UNIT_LABELS, { vin: "ABC123" });
    expect((await bodyOf(res!)).error).toBe('VIN "ABC123" is already in use.');
  });

  it("handles pg-adapter shape via constraint.fields array", async () => {
    const err = p2002({
      driverAdapterError: {
        cause: {
          constraint: { fields: ["plateNumber"] },
          originalMessage: "",
        },
      },
    });
    const res = handlePrismaError(err, UNIT_LABELS, { plateNumber: "FL-001" });
    expect((await bodyOf(res!)).error).toBe('Plate number "FL-001" is already in use.');
  });

  it("falls back to constraint name when no known field matches", async () => {
    const err = p2002({ target: "Custom_unknown_index" });
    const res = handlePrismaError(err, UNIT_LABELS);
    // No matching token, no value → raw target shown
    expect((await bodyOf(res!)).error).toBe("Custom_unknown_index is already in use.");
  });

  it("falls back to generic 'value' when meta is empty", async () => {
    const err = p2002({});
    const res = handlePrismaError(err, UNIT_LABELS);
    expect((await bodyOf(res!)).error).toBe("value is already in use.");
  });

  it("P2025 returns 404", async () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "test", meta: {} as never },
    );
    const res = handlePrismaError(err);
    expect(res?.status).toBe(404);
  });

  it("P2003 returns 409 with related-record message", async () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      "FK violation",
      { code: "P2003", clientVersion: "test", meta: { field_name: "ownerId" } as never },
    );
    const res = handlePrismaError(err, { ownerId: "Owner" });
    expect(res?.status).toBe(409);
    expect((await bodyOf(res!)).error).toBe("Referenced Owner no longer exists.");
  });
});
