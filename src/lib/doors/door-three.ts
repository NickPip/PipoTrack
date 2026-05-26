type Dims = { L: number; W: number; H: number };

function capacity(vehicle: Dims, freight: Dims): number {
  return (
    Math.floor(vehicle.L / freight.L) *
    Math.floor(vehicle.W / freight.W) *
    Math.floor(vehicle.H / freight.H)
  );
}

// All 6 rotations of the freight box
function maxCapacity(vehicle: Dims, freight: Dims): number {
  const { L, W, H } = freight;
  const rotations: Dims[] = [
    { L, W, H }, { L: L, W: H, H: W },
    { L: W, W: L, H }, { L: W, W: H, H: L },
    { L: H, W: L, H: W }, { L: H, W, H: L },
  ];
  return Math.max(...rotations.map((r) => capacity(vehicle, r)));
}

export function doorThree(
  unitDimensions: { length?: number; width?: number; height?: number } | null | undefined,
  loadDimensions: { pieces?: number; L?: number; W?: number; H?: number } | null | undefined
): boolean {
  if (!unitDimensions || !loadDimensions) return false;

  const { length: vL, width: vW, height: vH } = unitDimensions;
  const { pieces, L: fL, W: fW, H: fH } = loadDimensions;

  // If no freight dims or pieces specified, can't validate — fail safe
  if (!vL || !vW || !vH || !fL || !fW || !fH || !pieces) return false;

  return maxCapacity({ L: vL, W: vW, H: vH }, { L: fL, W: fW, H: fH }) >= pieces;
}
