// Canonical public site address used in emails and other links that leave the app.
// Never derive from preview/request hosts: emails must always point to production.
export const DEFAULT_SITE_URL = "https://padeliok.lt";

export function siteUrl(override?: string | null): string {
  const raw = (override ?? "").trim();
  if (raw && /^https:\/\//.test(raw) && !/lovable\.app|lovableproject\.com/.test(raw)) return raw.replace(/\/+$/, "");
  return DEFAULT_SITE_URL;
}
