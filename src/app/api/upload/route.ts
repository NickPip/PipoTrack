import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/supabase-storage";
import { clientIp, getLimiter } from "@/lib/rate-limit";
import { sniffMime } from "@/lib/file-sniff";

export const runtime = "nodejs";

// 20 uploads per minute per IP. Generous enough for batch driver-doc uploads,
// tight enough to stop a script trying to fill the bucket.
const uploadLimiter = getLimiter("upload", 20, "1 m");

// Buckets the client is allowed to request, mapped to the actual Supabase
// bucket. Keeps the API surface unchanged for existing callers (they send
// "piptrack_files") while preventing arbitrary bucket injection.
const ALLOWED_BUCKETS: Record<string, string> = {
  piptrack_files: "piptrack_files",
};
const DEFAULT_BUCKET = "piptrack_files";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Documents (DLs, registrations, BOLs, PODs, W9s) + photos. Deliberately
// excludes text/html and image/svg+xml — both can execute script when served
// via a signed URL and rendered in a browser tab.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXT_FROM_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(req: NextRequest) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  // Key by authenticated user id so one logged-in user can't burn another's
  // budget from the same office IP.
  const identifier = guard.userId || clientIp(req);
  const { success, reset } = await uploadLimiter.limit(identifier);
  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many uploads — slow down" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestedBucket = (formData.get("bucket") as string) || DEFAULT_BUCKET;
  const bucket = ALLOWED_BUCKETS[requestedBucket];

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!bucket) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The declared MIME (file.type) is client-controlled and spoofable. Sniff the
  // real type from the file's magic bytes and reject anything that isn't a
  // genuine allowed binary format — this is what actually blocks an HTML/SVG
  // payload masquerading as image/png.
  const detected = sniffMime(buffer);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    return NextResponse.json(
      { error: "File content does not match an allowed type" },
      { status: 415 },
    );
  }

  // Derive extension and stored content-type from the *detected* type, not the
  // user-supplied filename or declared MIME.
  const ext = EXT_FROM_MIME[detected];
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const url = await uploadFile(bucket, path, buffer, detected);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
