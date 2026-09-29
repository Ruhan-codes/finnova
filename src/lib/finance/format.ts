export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Returns YYYY-MM-DD in the viewer's LOCAL timezone. Never use iso.slice(0,10)
 *  for calendar day matching — that returns the UTC date and shifts by ±1 day
 *  in most timezones (e.g. IST pushes midnight-local to the previous UTC day). */
export const localDateKey = (input: string | Date): string => {
  const d = typeof input === "string" ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};