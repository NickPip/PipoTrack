import { NextRequest, NextResponse } from "next/server";
import { lookupZip } from "@/lib/zipcodes";

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Invalid ZIP code" }, { status: 400 });
  }

  const result = lookupZip(zip);
  if (!result) {
    return NextResponse.json({ error: "ZIP code not found" }, { status: 404 });
  }

  return NextResponse.json({
    lat: result.latitude,
    lng: result.longitude,
    city: `${result.city}, ${result.state}`,
  });
}
