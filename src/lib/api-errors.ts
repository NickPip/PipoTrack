// Client-side helper: normalize the various shapes our API returns in the
// `error` field into a single human-readable string. Backend can send:
//   - a string ("VIN '...' is already in use")
//   - a Zod-flattened object ({ formErrors: [], fieldErrors: { ... } })
//   - a Zod issues array
//   - undefined
export function extractErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;

  // Zod v4 flattenError shape
  if (typeof err === "object" && err !== null) {
    const e = err as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };
    if (e.message) return e.message;

    const fieldMsgs = e.fieldErrors
      ? Object.entries(e.fieldErrors)
          .filter(([, msgs]) => msgs?.length)
          .map(([field, msgs]) => `${field}: ${msgs![0]}`)
      : [];
    const all = [...(e.formErrors ?? []), ...fieldMsgs];
    if (all.length) return all.join("; ");

    // Zod issues array fallback
    if (Array.isArray(err)) {
      const msgs = err
        .map((i) => (i as { message?: string }).message)
        .filter(Boolean);
      if (msgs.length) return msgs.join("; ");
    }
  }

  return null;
}
