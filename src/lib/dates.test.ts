import { describe, it, expect } from "vitest";
import { parseDateTime } from "./dates";

describe("parseDateTime", () => {
  it("parses full ISO strings", () => {
    const d = parseDateTime("2026-05-28T09:00:00Z");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // May
    expect(d.getUTCDate()).toBe(28);
    expect(d.getUTCHours()).toBe(9);
  });

  it("parses MM/DD HH:mm shorthand using current year", () => {
    const now = new Date();
    const d = parseDateTime("05/28 09:00");
    expect(d.getFullYear()).toBe(now.getFullYear());
    expect(d.getMonth()).toBe(4); // May
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses single-digit MM/D H:mm shorthand", () => {
    const d = parseDateTime("5/8 9:30");
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it("falls back to new Date(value) for unrecognized strings", () => {
    // "garbage" is not parseable, so new Date returns Invalid Date.
    const d = parseDateTime("garbage");
    expect(isNaN(d.getTime())).toBe(true);
  });
});
