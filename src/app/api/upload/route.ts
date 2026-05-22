import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { uploadFile } from "@/lib/supabase-storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) || "piptrack_files";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const url = await uploadFile(bucket, path, buffer, file.type);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
