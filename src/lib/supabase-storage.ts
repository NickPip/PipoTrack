import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "paste-your-service-role-key-here") {
    throw new Error(
      "Supabase Storage is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local"
    );
  }
  return createClient(url, key);
}

const SIGNED_URL_TTL = 10 * 365 * 24 * 3600; // ~10 years

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error: signError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signError || !data?.signedUrl) {
    throw new Error(signError?.message ?? "Failed to create signed URL");
  }

  return data.signedUrl;
}
