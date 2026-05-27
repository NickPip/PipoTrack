import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/rbac";
import { Role, LoadStatus, FinStatus } from "@/generated/prisma/enums";
import { parseDateTime } from "@/lib/dates";
import { z } from "zod";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED_TO_PICKUP: "Dispatched to Pickup",
  ONSITE_FOR_PICKUP: "OnSite for Pickup",
  LOADED_AND_DELIVERING: "Loaded and Delivering",
  ONSITE_FOR_DELIVERY: "OnSite for Delivery",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

const schema = z.object({
  broker: z.string().min(1).optional(),
  brokerReference: z.string().optional(),
  dispatcherId: z.string().optional(),
  trackingId: z.string().optional(),
  status: z.nativeEnum(LoadStatus).optional(),
  driverRate: z.number().optional(),
  rate: z.number().optional(),
  pickupAddress: z.string().optional(),
  pickupDate: z.string().optional(),
  pickupNotes: z.string().nullable().optional(),
  deliveryAddress: z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryNotes: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  rcUrl: z.string().nullable().optional(),
  bolUrls: z.array(z.string()).optional(),
  podUrl: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  // Logistics mutation — only OPERATIONS/ADMIN. ACCOUNTING has read access to
  // operations data but must not change logistics status.
  if (!role || !canMutate(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const d = parsed.data;
  const update: Record<string, unknown> = {};

  if (d.broker !== undefined) update.broker = d.broker;
  if (d.brokerReference !== undefined) update.brokerReference = d.brokerReference;
  if (d.dispatcherId !== undefined) update.dispatcherId = d.dispatcherId;
  if (d.trackingId !== undefined) update.trackingId = d.trackingId;
  if (d.status !== undefined) update.status = d.status;
  if (d.rate !== undefined) update.rate = d.rate;
  if (d.driverRate !== undefined) update.driverRate = d.driverRate;
  if (d.pickupAddress !== undefined) update.pickupAddress = d.pickupAddress;
  if (d.pickupDate !== undefined) update.pickupDate = parseDateTime(d.pickupDate);
  if (d.pickupNotes !== undefined) update.pickupNotes = d.pickupNotes;
  if (d.deliveryAddress !== undefined) update.deliveryAddress = d.deliveryAddress;
  if (d.deliveryDate !== undefined) update.deliveryDate = parseDateTime(d.deliveryDate);
  if (d.deliveryNotes !== undefined) update.deliveryNotes = d.deliveryNotes;
  if (d.unitId    !== undefined) update.unitId    = d.unitId;
  if (d.driverId  !== undefined) update.driverId  = d.driverId;
  if (d.rcUrl !== undefined) update.rcUrl = d.rcUrl;
  if (d.bolUrls !== undefined) update.bolUrls = d.bolUrls;
  if (d.podUrl !== undefined) update.podUrl = d.podUrl;

  // Read previous status, update, and (if status changed) write the audit
  // note as one transaction. Without this, the update could succeed and the
  // note write fail, leaving the load history inaccurate.
  const userName = `${session?.user?.name ?? "Unknown"}`;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  const load = await prisma.$transaction(async (tx) => {
    let prevStatus: string | null = null;
    if (d.status !== undefined) {
      const current = await tx.load.findUnique({ where: { id }, select: { status: true } });
      if (current && current.status !== d.status) {
        prevStatus = current.status;
      }
    }

    const updated = await tx.load.update({ where: { id }, data: update });

    if (prevStatus !== null && d.status !== undefined) {
      const from = STATUS_LABELS[prevStatus] ?? prevStatus;
      const to = STATUS_LABELS[d.status] ?? d.status;
      await tx.loadNote.create({
        data: {
          loadId: id,
          userId,
          userName,
          body: `Status changed: ${from} → ${to}`,
          isSystem: true,
        },
      });
    }

    return updated;
  });

  return NextResponse.json(load);
}

const accountingSchema = z.object({
  financialStatus: z.nativeEnum(FinStatus).optional(),
  factoringStatus: z.enum(["YES", "NO", "WARNING"]).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canMutate(role, "accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = accountingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.financialStatus !== undefined) update.financialStatus = parsed.data.financialStatus;
  if (parsed.data.factoringStatus !== undefined) update.factoringStatus = parsed.data.factoringStatus;

  const load = await prisma.load.update({ where: { id }, data: update });
  return NextResponse.json(load);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canMutate(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // Atomic delete: bids → notes → load. If any step fails the others roll
  // back, so we never end up with orphan bids/notes pointing at a load that
  // no longer exists.
  await prisma.$transaction([
    prisma.bid.deleteMany({ where: { loadId: id } }),
    prisma.loadNote.deleteMany({ where: { loadId: id } }),
    prisma.load.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
