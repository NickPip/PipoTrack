import { describe, it, expect } from "vitest";
import { doorTwo } from "./door-two";

// Real zipcodes used so the geolib + zipcodes lookup chain is exercised
// end-to-end. Distances are pulled from public sources and rounded.
//
// 33135 (Miami, FL) ↔ 33101 (Miami, FL)         ~5 mi
// 33135 (Miami, FL) ↔ 30309 (Atlanta, GA)       ~600 mi
// 60625 (Chicago)   ↔ 60601 (Chicago downtown) ~7 mi

describe("doorTwo — geospatial radius check", () => {
  it("passes when pickup is well inside the driver's radius", () => {
    expect(doorTwo("33135", 150, "33101")).toBe(true);
    expect(doorTwo("60625", 50, "60601")).toBe(true);
  });

  it("fails when pickup is far outside the radius", () => {
    expect(doorTwo("33135", 100, "30309")).toBe(false);
  });

  it("passes when pickup is just inside a large radius", () => {
    expect(doorTwo("33135", 700, "30309")).toBe(true);
  });

  it("returns false on missing inputs", () => {
    expect(doorTwo(null, 100, "33101")).toBe(false);
    expect(doorTwo("33135", null, "33101")).toBe(false);
    expect(doorTwo("33135", 100, null)).toBe(false);
    expect(doorTwo("33135", 0, "33101")).toBe(false);
  });

  it("returns false on unknown zipcodes", () => {
    expect(doorTwo("00000", 100, "33101")).toBe(false);
    expect(doorTwo("33135", 100, "00000")).toBe(false);
  });
});
