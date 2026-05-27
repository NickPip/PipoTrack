import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Constant-time string compare. Returns false if lengths differ instead of
// short-circuiting, so timing doesn't reveal partial matches.
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Pulls the shared secret from header or `key` query param so trackers that
// can't customize headers (e.g. some Traccar configs) can still authenticate.
function presentedSecret(req: NextRequest, params: URLSearchParams): string | null {
  return req.headers.get("x-location-secret") ?? params.get("key");
}

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

async function saveLocation(req: NextRequest, params: URLSearchParams): Promise<NextResponse> {
  // Auth gate. If LOCATION_INGEST_SECRET is set in env, requests MUST present
  // it (header or `key=` query param). When unset, we accept unauthenticated
  // writes and log a warning so existing trackers don't break on rollout;
  // set the env var after updating device configs to lock the endpoint down.
  const expected = process.env.LOCATION_INGEST_SECRET;
  if (expected) {
    const presented = presentedSecret(req, params);
    if (!presented || !safeEqual(presented, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.warn("[location] LOCATION_INGEST_SECRET unset — endpoint is publicly writable");
  }

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
  return saveLocation(request, await getParams(request));
}

export async function POST(request: NextRequest) {
  return saveLocation(request, await getParams(request));
}
