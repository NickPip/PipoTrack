// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number } | null;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDistance } = require("geolib") as {
  getDistance: (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ) => number;
};

export function doorTwo(
  driverZip: string | null | undefined,
  searchRadius: number | null | undefined,
  pickupZip: string | null | undefined
): boolean {
  if (!driverZip || !pickupZip || !searchRadius) return false;
  const a = zipcodes.lookup(driverZip);
  const b = zipcodes.lookup(pickupZip);
  if (!a || !b) return false;
  const miles = getDistance(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  ) / 1609.34;
  return miles <= searchRadius;
}
