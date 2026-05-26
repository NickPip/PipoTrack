const SPRINTER_TYPES = ["sprinter", "cargo van"];

export function doorOne(
  loadVehicle: string,
  driverVehicle: string | null | undefined
): boolean {
  if (!driverVehicle) return false;
  const norm = (v: string) => v.toLowerCase().trim();
  const lv = norm(loadVehicle);
  const dv = norm(driverVehicle);
  if (SPRINTER_TYPES.includes(lv) && SPRINTER_TYPES.includes(dv)) return true;
  return lv === dv;
}
