import { cached } from "@/lib/cache";

// Shared Mapbox helpers. Centralizes the API call, caches results, and
// rounds inputs so we get cache hits across requests that are "close enough"
// (driver moved 200 meters → same cell → same cached distance).

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Driving distance cache TTL. Roads don't change minute-to-minute and most
// of the cost is the round trip, not the freshness — 1h is generous.
const DISTANCE_TTL_SEC = 60 * 60;

// Round to ~100m precision. Driver positions wobble by GPS noise alone,
// rounding stops every wobble from invalidating the cache.
const PRECISION = 3;

function roundCoord(n: number): number {
  return Math.round(n * 10 ** PRECISION) / 10 ** PRECISION;
}

function metersToMiles(m: number): number {
  return Math.round(m / 1609.34);
}

export type Coords = { latitude: number; longitude: number };

// Returns driving miles between two points using Mapbox Directions API.
// Cached by (rounded from, rounded to) so back-to-back requests for the
// same pair are free.
//
// Returns null if the token is missing or the call fails — callers should
// treat null as "distance unknown" and degrade gracefully.
export async function drivingMiles(from: Coords, to: Coords): Promise<number | null> {
  if (!MAPBOX_TOKEN) return null;

  const fromLat = roundCoord(from.latitude);
  const fromLng = roundCoord(from.longitude);
  const toLat = roundCoord(to.latitude);
  const toLng = roundCoord(to.longitude);

  const cacheKey = `mapbox:dm:${fromLat},${fromLng}->${toLat},${toLng}`;

  const result = await cached(cacheKey, DISTANCE_TTL_SEC, async () => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as { routes?: { distance: number }[] };
      const meters = data.routes?.[0]?.distance;
      return meters != null ? metersToMiles(meters) : null;
    } catch {
      return null;
    }
  });

  return result;
}
