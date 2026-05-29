import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { driverFromRequest } from "@/lib/driver-auth";

export const runtime = "nodejs";

// Loads this driver has been offered (a Bid exists) that are still open for a
// response. The driver's own bid status/amount rides along so the app can show
// "awaiting your bid" vs "bid submitted".
export async function GET(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bids = await prisma.bid.findMany({
    where: {
      driverId: driver.id,
      status: { in: ["sent", "pending"] },
      load: { status: { in: ["PENDING_DISTRIBUTION", "HAS_BIDS"] } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      amount: true,
      status: true,
      load: {
        select: {
          id: true,
          loadNumber: true,
          brokerReference: true,
          pickupAddress: true,
          pickupZip: true,
          pickupDate: true,
          deliveryAddress: true,
          deliveryZip: true,
          deliveryDate: true,
          miles: true,
          weight: true,
          rate: true,
          vehicleRequired: true,
          dimensions: true,
        },
      },
    },
  });

  const loads = bids.map((b) => ({
    ...b.load,
    bidStatus: b.status,
    bidAmount: b.amount,
  }));

  return NextResponse.json({ loads });
}
