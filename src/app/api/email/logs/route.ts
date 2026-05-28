import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireRole("dispatch", "read");
  if (guard instanceof NextResponse) return guard;

  const loads = await prisma.load.findMany({
    where: { brokerReference: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      loadNumber: true,
      status: true,
      broker: true,
      brokerName: true,
      brokerEmail: true,
      brokerPhone: true,
      brokerReference: true,
      pickupAddress: true,
      pickupZip: true,
      pickupDate: true,
      deliveryAddress: true,
      deliveryZip: true,
      deliveryDate: true,
      vehicleRequired: true,
      miles: true,
      weight: true,
      dimensions: true,
      rate: true,
      createdAt: true,
      bids: { select: { id: true }, take: 1 },
    },
  });

  return NextResponse.json({ loads });
}
