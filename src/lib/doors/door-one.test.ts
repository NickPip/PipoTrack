import { describe, it, expect } from "vitest";
import { doorOne } from "./door-one";

describe("doorOne — load type recognition", () => {
  it("matches identical vehicle types case-insensitively", () => {
    expect(doorOne("Sprinter", "Sprinter")).toBe(true);
    expect(doorOne("Small Straight", "small straight")).toBe(true);
    expect(doorOne("Large Straight", "LARGE STRAIGHT")).toBe(true);
  });

  it("treats Sprinter and Cargo Van as interchangeable", () => {
    expect(doorOne("Sprinter", "Cargo Van")).toBe(true);
    expect(doorOne("Cargo Van", "Sprinter")).toBe(true);
    expect(doorOne("sprinter", "cargo van")).toBe(true);
  });

  it("rejects cross-type matches outside the Sprinter group", () => {
    expect(doorOne("Sprinter", "Small Straight")).toBe(false);
    expect(doorOne("Small Straight", "Large Straight")).toBe(false);
    expect(doorOne("Cargo Van", "Large Straight")).toBe(false);
  });

  it("returns false when driver has no vehicle type", () => {
    expect(doorOne("Sprinter", null)).toBe(false);
    expect(doorOne("Sprinter", undefined)).toBe(false);
    expect(doorOne("Sprinter", "")).toBe(false);
  });

  it("trims whitespace on both sides", () => {
    expect(doorOne("  Sprinter  ", "Sprinter")).toBe(true);
    expect(doorOne("Sprinter", "  Cargo Van  ")).toBe(true);
  });
});
