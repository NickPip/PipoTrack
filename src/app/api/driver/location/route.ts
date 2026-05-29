import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { driverFromRequest } from "@/lib/driver-auth";

export const runtime = "nodejs";

const schema = z.object({
  lat: z.number(),
  lon: z.number(),
  speed: z.number().nullable().optional(),
  bearing: z.number().nullable().optional(),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
});

export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const data = {
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    speed: parsed.data.speed ?? null,
    bearing: parsed.data.bearing ?? null,
    altitude: parsed.data.altitude ?? null,
    accuracy: parsed.data.accuracy ?? null,
  };

  await prisma.driverLocation.upsert({
    where: { driverId: driver.id },
    update: data,
    create: { driverId: driver.id, ...data },
  });

  return new NextResponse(null, { status: 204 });
}
