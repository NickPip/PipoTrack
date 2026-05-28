import { LoadStatus } from "@/generated/prisma/enums";

// Operations-phase lifecycle. Key = current status; value = the statuses an
// OPERATIONS user may move the load to next. CANCELED is reachable from any
// active step. DELIVERED and CANCELED are terminal (empty list).
//
// Dispatch-phase statuses (PENDING_DISTRIBUTION, HAS_BIDS, QUOTED, BOOKED) are
// driven by dedicated endpoints (bid/book), not the generic load PUT, so they
// are intentionally NOT constrained here — a transition out of one of them is
// allowed through so the dispatch→operations handoff keeps working.
const OPERATIONS_TRANSITIONS: Partial<Record<LoadStatus, LoadStatus[]>> = {
  PENDING: ["DISPATCHED_TO_PICKUP", "CANCELED"],
  DISPATCHED_TO_PICKUP: ["ONSITE_FOR_PICKUP", "CANCELED"],
  ONSITE_FOR_PICKUP: ["LOADED_AND_DELIVERING", "CANCELED"],
  LOADED_AND_DELIVERING: ["ONSITE_FOR_DELIVERY", "CANCELED"],
  ONSITE_FOR_DELIVERY: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

export function isValidStatusTransition(from: LoadStatus, to: LoadStatus): boolean {
  if (from === to) return true;
  const allowed = OPERATIONS_TRANSITIONS[from];
  // `from` is a dispatch-phase status, governed elsewhere — let it through.
  if (allowed === undefined) return true;
  return allowed.includes(to);
}
