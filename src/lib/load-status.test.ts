import { describe, it, expect } from "vitest";
import { isValidStatusTransition } from "./load-status";

describe("isValidStatusTransition", () => {
  it("allows each forward step of the operations lifecycle", () => {
    expect(isValidStatusTransition("PENDING", "DISPATCHED_TO_PICKUP")).toBe(true);
    expect(isValidStatusTransition("DISPATCHED_TO_PICKUP", "ONSITE_FOR_PICKUP")).toBe(true);
    expect(isValidStatusTransition("ONSITE_FOR_PICKUP", "LOADED_AND_DELIVERING")).toBe(true);
    expect(isValidStatusTransition("LOADED_AND_DELIVERING", "ONSITE_FOR_DELIVERY")).toBe(true);
    expect(isValidStatusTransition("ONSITE_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("allows cancelling from any active step", () => {
    expect(isValidStatusTransition("PENDING", "CANCELED")).toBe(true);
    expect(isValidStatusTransition("LOADED_AND_DELIVERING", "CANCELED")).toBe(true);
    expect(isValidStatusTransition("ONSITE_FOR_DELIVERY", "CANCELED")).toBe(true);
  });

  it("rejects skipping steps", () => {
    expect(isValidStatusTransition("PENDING", "DELIVERED")).toBe(false);
    expect(isValidStatusTransition("PENDING", "ONSITE_FOR_PICKUP")).toBe(false);
    expect(isValidStatusTransition("DISPATCHED_TO_PICKUP", "DELIVERED")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(isValidStatusTransition("ONSITE_FOR_PICKUP", "PENDING")).toBe(false);
    expect(isValidStatusTransition("DELIVERED", "PENDING")).toBe(false);
  });

  it("treats DELIVERED and CANCELED as terminal", () => {
    expect(isValidStatusTransition("DELIVERED", "CANCELED")).toBe(false);
    expect(isValidStatusTransition("CANCELED", "PENDING")).toBe(false);
    expect(isValidStatusTransition("CANCELED", "DELIVERED")).toBe(false);
  });

  it("treats setting the same status as a no-op (allowed)", () => {
    expect(isValidStatusTransition("PENDING", "PENDING")).toBe(true);
    expect(isValidStatusTransition("DELIVERED", "DELIVERED")).toBe(true);
  });

  it("lets dispatch-phase statuses through (governed by other endpoints)", () => {
    expect(isValidStatusTransition("QUOTED", "PENDING")).toBe(true);
    expect(isValidStatusTransition("BOOKED", "PENDING")).toBe(true);
  });
});
