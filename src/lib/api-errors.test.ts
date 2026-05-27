import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "./api-errors";

describe("extractErrorMessage", () => {
  it("returns null for nullish input", () => {
    expect(extractErrorMessage(null)).toBe(null);
    expect(extractErrorMessage(undefined)).toBe(null);
    expect(extractErrorMessage("")).toBe(null);
  });

  it("returns strings as-is", () => {
    expect(extractErrorMessage("VIN already in use")).toBe("VIN already in use");
  });

  it("prefers .message when present", () => {
    expect(extractErrorMessage({ message: "boom" })).toBe("boom");
  });

  it("formats Zod flattenError shape (fieldErrors)", () => {
    const flat = {
      formErrors: [],
      fieldErrors: { email: ["Invalid email"], name: ["Required"] },
    };
    const msg = extractErrorMessage(flat);
    expect(msg).toContain("email: Invalid email");
    expect(msg).toContain("name: Required");
  });

  it("formats Zod flattenError with only formErrors", () => {
    const flat = { formErrors: ["Top-level problem"], fieldErrors: {} };
    expect(extractErrorMessage(flat)).toBe("Top-level problem");
  });

  it("skips empty fieldErrors entries", () => {
    const flat = {
      formErrors: [],
      fieldErrors: { email: ["Invalid"], name: [] },
    };
    expect(extractErrorMessage(flat)).toBe("email: Invalid");
  });

  it("returns null when nothing extractable", () => {
    expect(extractErrorMessage({})).toBe(null);
    expect(extractErrorMessage({ unrelated: "stuff" })).toBe(null);
  });
});
