import { describe, it, expect } from "vitest";
import { doorThree } from "./door-three";

// Reference dimensions (loose units — the formula is unit-agnostic).
const SPRINTER = { length: 170, width: 70, height: 72 };

describe("doorThree — volumetric freight fit", () => {
  it("passes when one piece fits comfortably", () => {
    expect(
      doorThree(SPRINTER, { pieces: 1, L: 48, W: 40, H: 60 }),
    ).toBe(true);
  });

  it("passes when many small pieces stack inside the vehicle", () => {
    // 10×10×10 box in a 170×70×72 vehicle = 17 × 7 × 7 = 833 capacity.
    expect(
      doorThree(SPRINTER, { pieces: 500, L: 10, W: 10, H: 10 }),
    ).toBe(true);
  });

  it("fails when freight is too tall to fit", () => {
    expect(
      doorThree(SPRINTER, { pieces: 1, L: 48, W: 40, H: 200 }),
    ).toBe(false);
  });

  it("passes by rotating the freight when natural orientation doesn't fit", () => {
    // Vehicle 100×50×50, freight L=30 W=40 H=90.
    // Natural orientation: floor(100/30) * floor(50/40) * floor(50/90)
    //                    = 3 * 1 * 0 = 0 — fails.
    // Rotated so the long axis (90) lies along the vehicle's length:
    //                      floor(100/90) * floor(50/30) * floor(50/40)
    //                    = 1 * 1 * 1 = 1 — passes.
    const vehicle = { length: 100, width: 50, height: 50 };
    const freight = { pieces: 1, L: 30, W: 40, H: 90 };
    expect(doorThree(vehicle, freight)).toBe(true);
  });

  it("fails when the requested pieces exceed total capacity", () => {
    // 50×50×50 box × 1000 pieces. SPRINTER capacity = floor(170/50) *
    // floor(70/50) * floor(72/50) = 3 * 1 * 1 = 3. 1000 > 3.
    expect(
      doorThree(SPRINTER, { pieces: 1000, L: 50, W: 50, H: 50 }),
    ).toBe(false);
  });

  it("lets through when freight piece count is 0 (no constraint)", () => {
    expect(
      doorThree(SPRINTER, { pieces: 0, L: 999, W: 999, H: 999 }),
    ).toBe(true);
  });

  it("lets through when freight dims are missing — can't validate fit", () => {
    expect(doorThree(SPRINTER, { pieces: 10 })).toBe(true);
    expect(doorThree(SPRINTER, { pieces: 10, L: 48 })).toBe(true); // partial
  });

  it("lets through when either dims object is null", () => {
    expect(doorThree(null, { pieces: 1, L: 1, W: 1, H: 1 })).toBe(true);
    expect(doorThree(SPRINTER, null)).toBe(true);
  });

  it("fails when vehicle dims are required but missing", () => {
    expect(
      doorThree({ length: 0 }, { pieces: 1, L: 1, W: 1, H: 1 }),
    ).toBe(false);
  });
});
