import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

const schema = z.object({
  bidId:      z.string().min(1),
  driverId:   z.string().min(1),
  driverRate: z.number().min(0),
  rate:       z.number().min(0),
  notes:      z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (!role || !canAccess(role, "dispatch")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: loadId } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { bidId, driverId, driverRate, rate, notes } = parsed.data;

    // Update load: set rates, assign driver, move to QUOTED
    const load = await prisma.load.update({
      where: { id: loadId },
      data: {
        status:       "QUOTED",
        rate,
        driverRate,
        driverId,
        deliveryNotes: notes || undefined,
      },
    });

    // Mark the winning bid as accepted, all others as declined
    await prisma.bid.updateMany({
      where: { loadId, id: { not: bidId } },
      data:  { status: "declined" },
    });
    await prisma.bid.update({
      where: { id: bidId },
      data:  { status: "accepted", amount: driverRate },
    });

    return NextResponse.json({ load });
  } catch (err) {
    console.error("[dispatch/loads/bid]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
