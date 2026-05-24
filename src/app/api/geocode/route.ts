import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number; city: string; state: string } | null;
};

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Invalid ZIP code" }, { status: 400 });
  }

  const result = zipcodes.lookup(zip);
  if (!result) {
    return NextResponse.json({ error: "ZIP code not found" }, { status: 404 });
  }

  return NextResponse.json({
    lat: result.latitude,
    lng: result.longitude,
    city: `${result.city}, ${result.state}`,
  });
}
