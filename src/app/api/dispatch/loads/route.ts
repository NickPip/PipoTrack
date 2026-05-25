import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

export async function GET() {
  try {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "dispatch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loads = await prisma.load.findMany({
    where: {
      status: { in: ["PENDING_DISTRIBUTION", "HAS_BIDS", "QUOTED"] },
    },
    orderBy: { createdAt: "desc" },
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
      miles: true,
      weight: true,
      vehicleRequired: true,
      dimensions: true,
      stackable: true,
      rate: true,
      driverRate: true,
      createdAt: true,
      bids: {
        select: {
          id: true,
          driverId: true,
          amount: true,
          status: true,
          createdAt: true,
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              citizenshipType: true,
              cleanBackground: true,
              vehicleType: true,
              outMiles: true,
              currentZip: true,
              address: true,
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  type: true,
                  dimensions: true,
                  payload: true,
                  equipment: true,
                },
              },
              location: {
                select: { lat: true, lon: true, updatedAt: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ loads });
  } catch (err) {
    console.error("[dispatch/loads]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
