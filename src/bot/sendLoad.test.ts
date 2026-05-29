import { describe, it, expect, vi, beforeEach } from "vitest";

// getBot is imported at module load; stub so importing sendLoad never inits Grammy.
vi.mock("@/bot/bot", () => ({
  getBot: () => ({ api: { sendMessage: vi.fn().mockResolvedValue(undefined) } }),
}));

const driverFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    driver: { findMany: (...args: unknown[]) => driverFindMany(...args) },
    bid: { upsert: vi.fn() },
    load: { findUnique: vi.fn() },
  },
}));

import { findMatchingDrivers, invalidateDriverCache } from "./sendLoad";

// Minimal driver shape the 3 Doors read; ZIPs are real so geolib runs for real.
function driver(over: Record<string, unknown>) {
  return {
    id: "d",
    name: "Driver",
    vehicleType: "Cargo Van",
    currentZip: "33135", // Miami
    searchRadius: 150,
    telegramId: "tg",
    unitId: "u",
    unit: { dimensions: null, unitNumber: "U1" },
    ...over,
  };
}

beforeEach(() => {
  invalidateDriverCache();
  driverFindMany.mockReset();
});

describe("findMatchingDrivers (match-before-save)", () => {
  it("returns [] and does not query when the load has no vehicle requirement", async () => {
    const matches = await findMatchingDrivers({ vehicleRequired: null, pickupZip: "33101", dimensions: null });
    expect(matches).toEqual([]);
    expect(driverFindMany).not.toHaveBeenCalled();
  });

  it("keeps only drivers whose vehicle type matches (Door One)", async () => {
    driverFindMany.mockResolvedValue([
      driver({ id: "van", vehicleType: "Cargo Van" }),
      driver({ id: "straight", vehicleType: "Large Straight" }),
    ]);

    const matches = await findMatchingDrivers({ vehicleRequired: "Cargo Van", pickupZip: "33101", dimensions: null });
    expect(matches.map((d) => d.id)).toEqual(["van"]);
  });

  it("treats Sprinter and Cargo Van as interchangeable (Door One)", async () => {
    driverFindMany.mockResolvedValue([driver({ id: "sprinter", vehicleType: "Sprinter" })]);

    const matches = await findMatchingDrivers({ vehicleRequired: "Cargo Van", pickupZip: "33101", dimensions: null });
    expect(matches.map((d) => d.id)).toEqual(["sprinter"]);
  });

  it("excludes drivers whose radius doesn't reach the pickup (Door Two)", async () => {
    driverFindMany.mockResolvedValue([
      driver({ id: "near", currentZip: "33135", searchRadius: 150 }), // ~5mi to 33101
      driver({ id: "far", currentZip: "30309", searchRadius: 150 }),  // ~600mi to 33101
    ]);

    const matches = await findMatchingDrivers({ vehicleRequired: "Cargo Van", pickupZip: "33101", dimensions: null });
    expect(matches.map((d) => d.id)).toEqual(["near"]);
  });

  it("returns nothing when no driver matches (load would be dropped)", async () => {
    driverFindMany.mockResolvedValue([
      driver({ id: "wrong-type", vehicleType: "Large Straight" }),
      driver({ id: "too-far", currentZip: "30309", searchRadius: 50 }),
    ]);

    const matches = await findMatchingDrivers({ vehicleRequired: "Cargo Van", pickupZip: "33101", dimensions: null });
    expect(matches).toEqual([]);
  });
});
