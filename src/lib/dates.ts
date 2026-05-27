// Parses date strings the API accepts on Load create/update.
//
// Accepts:
//   - ISO 8601 ("2026-05-28T09:00:00Z" or anything `new Date()` handles)
//   - "MM/DD HH:mm" shorthand (current year assumed, server local time)
//
// Behavior preserved exactly from the previous inline copies in
// /api/loads/route.ts and /api/loads/[id]/route.ts so we don't change
// observable behavior.
export function parseDateTime(value: string): Date {
  if (value.includes("T") || value.includes("-")) return new Date(value);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, month, day, hour, minute] = match;
    const year = new Date().getFullYear();
    return new Date(
      year,
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
    );
  }
  return new Date(value);
}
