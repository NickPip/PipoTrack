import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role, LoadStatus, FinStatus } from "@/generated/prisma/enums";
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

function parseDateTime(value: string): Date {
  if (value.includes("T") || value.includes("-")) return new Date(value);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, month, day, hour, minute] = match;
    const year = new Date().getFullYear();
    return new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  return new Date(value);
}

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
  rcUrl: z.string().nullable().optional(),
  bolUrls: z.array(z.string()).optional(),
  podUrl: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
  if (d.unitId !== undefined) update.unitId = d.unitId;
  if (d.rcUrl !== undefined) update.rcUrl = d.rcUrl;
  if (d.bolUrls !== undefined) update.bolUrls = d.bolUrls;
  if (d.podUrl !== undefined) update.podUrl = d.podUrl;

  // Detect status change before updating
  let prevStatus: string | null = null;
  if (d.status !== undefined) {
    const current = await prisma.load.findUnique({ where: { id }, select: { status: true } });
    if (current && current.status !== d.status) {
      prevStatus = current.status;
    }
  }

  const load = await prisma.load.update({ where: { id }, data: update });

  // Post system note if status changed
  if (prevStatus !== null && d.status !== undefined) {
    const userName = `${session?.user?.name ?? "Unknown"}`;
    const userId = (session?.user as { id?: string } | undefined)?.id ?? "";
    const from = STATUS_LABELS[prevStatus] ?? prevStatus;
    const to = STATUS_LABELS[d.status] ?? d.status;
    await prisma.loadNote.create({
      data: {
        loadId: id,
        userId,
        userName,
        body: `Status changed: ${from} → ${to}`,
        isSystem: true,
      },
    });
  }

  return NextResponse.json(load);
}

const accountingSchema = z.object({
  financialStatus: z.nativeEnum(FinStatus).optional(),
  factoringStatus: z.enum(["YES", "NO", "WARNING"]).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = accountingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
  if (!role || !canAccess(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.load.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
