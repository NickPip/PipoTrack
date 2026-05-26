import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "dispatch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
