export type SearchableOrder = {
  order_number: string;
  full_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const SEPARATOR = /[\s#\-_./+()]+/g;

export function compactToken(value: string): string {
  return value.toLowerCase().replace(SEPARATOR, "");
}

export function digitsOnly(value: string): string {
  const digits = value.replace(/\D/g, "");
  const trimmed = digits.replace(/^0+/, "");
  return trimmed.length > 0 ? trimmed : digits;
}

function digitsMatch(hay: string | null | undefined, query: string, min = 3): boolean {
  const needle = digitsOnly(query);
  if (needle.length < min) return false;
  const target = digitsOnly(hay ?? "");
  return target.length >= needle.length && target.includes(needle);
}

export function matchesOrderQuery(query: string, order: SearchableOrder): boolean {
  const q = query.trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  const compact = compactToken(q);

  if (compact && compactToken(order.order_number ?? "").includes(compact)) return true;
  if (digitsMatch(order.order_number, q, 3)) return true;
  if ((order.full_name ?? "").toLowerCase().includes(lower)) return true;
  if ((order.company_name ?? "").toLowerCase().includes(lower)) return true;
  if ((order.email ?? "").toLowerCase().includes(lower)) return true;
  if (digitsMatch(order.phone, q, 3)) return true;
  return false;
}
