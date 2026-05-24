import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getParams(request: NextRequest): Promise<URLSearchParams> {
  const { searchParams } = request.nextUrl;
  if (request.method === "POST") {
    try {
      const text = await request.text();
      return new URLSearchParams(text);
    } catch {
      return searchParams;
    }
  }
  return searchParams;
}

async function saveLocation(params: URLSearchParams): Promise<NextResponse> {
  const deviceId = params.get("id");
  const lat = params.get("lat");
  const lon = params.get("lon");

  if (!deviceId || !lat || !lon) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const driver = await prisma.driver.findFirst({
    where: { traccarDeviceId: deviceId },
  });

  if (!driver) {
    return NextResponse.json({ error: "Device not registered" }, { status: 404 });
  }

  const data = {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    speed:    params.get("speed")    ? parseFloat(params.get("speed")!)    : null,
    bearing:  params.get("bearing")  ? parseFloat(params.get("bearing")!)  : null,
    altitude: params.get("altitude") ? parseFloat(params.get("altitude")!) : null,
    accuracy: params.get("accuracy") ? parseFloat(params.get("accuracy")!) : null,
  };

  await prisma.driverLocation.upsert({
    where: { driverId: driver.id },
    update: data,
    create: { driverId: driver.id, ...data },
  });

  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  return saveLocation(await getParams(request));
}

export async function POST(request: NextRequest) {
  return saveLocation(await getParams(request));
}
