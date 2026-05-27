// Typed wrapper around the `zipcodes` package, which ships no types.
// Centralizes the eslint-disable noise that used to be scattered across
// five files, and gives every caller a real TypeScript signature.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (
    zip: string,
  ) => { latitude: number; longitude: number; city: string; state: string } | null;
  lookupByCoords: (
    lat: number,
    lon: number,
  ) => { zip: string; city: string; state: string } | null;
};

export type ZipLookup = {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
};

export type CoordsLookup = {
  zip: string;
  city: string;
  state: string;
};

export function lookupZip(zip: string): ZipLookup | null {
  return zipcodes.lookup(zip);
}

export function lookupByCoords(lat: number, lon: number): CoordsLookup | null {
  return zipcodes.lookupByCoords(lat, lon);
}
