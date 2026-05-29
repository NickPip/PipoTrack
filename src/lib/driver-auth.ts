import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Driver } from "@/generated/prisma/client";

// Opaque per-driver session token for the mobile app. Rotated on each login,
// stored on Driver.appToken (unique), and presented as `Authorization: Bearer`.
export function generateAppToken(): string {
  return randomBytes(32).toString("hex");
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length ? token : null;
}

// Resolve the driver behind a request's Bearer appToken, or null if the token
// is missing/unknown. Used by every authenticated mobile endpoint.
export async function driverFromRequest(req: Request): Promise<Driver | null> {
  const token = bearerToken(req);
  if (!token) return null;
  return prisma.driver.findUnique({ where: { appToken: token } });
}
