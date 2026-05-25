import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (!role || !canAccess(role, "dispatch")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: loadId } = await params;

    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: {
        bids: {
          where: { status: "accepted" },
          include: { driver: { select: { id: true, unitId: true } } },
          take: 1,
        },
      },
    });

    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });
    if (load.status !== "QUOTED") {
      return NextResponse.json({ error: "Load must be in QUOTED status to book" }, { status: 400 });
    }

    const acceptedBid = load.bids[0];
    const unitId = acceptedBid?.driver?.unitId ?? load.unitId;
    const driverId = acceptedBid?.driver?.id ?? load.driverId;
    const dispatcherId = session?.user?.id ?? null;

    const updated = await prisma.load.update({
      where: { id: loadId },
      data: {
        status: "PENDING",
        dispatcherId,
        unitId:   unitId   ?? undefined,
        driverId: driverId ?? undefined,
      },
    });

    return NextResponse.json({ load: updated });
  } catch (err) {
    console.error("[dispatch/loads/book]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
