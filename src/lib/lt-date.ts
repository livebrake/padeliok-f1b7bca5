// Lithuanian date formatting used by legal pages (browser-safe: no Node APIs here).

const LT_MONTHS_GENITIVE = [
  "sausio",
  "vasario",
  "kovo",
  "balandžio",
  "gegužės",
  "birželio",
  "liepos",
  "rugpjūčio",
  "rugsėjo",
  "spalio",
  "lapkričio",
  "gruodžio",
];

/** "2026-11-10" -> "2026 m. lapkričio 10 d." (null when the input is not a valid ISO date). */
export function formatLtDateFromIso(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year} m. ${LT_MONTHS_GENITIVE[month - 1]} ${day} d.`;
}

/** Today's date as YYYY-MM-DD in Vilnius time. */
export function todayIsoVilnius(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
