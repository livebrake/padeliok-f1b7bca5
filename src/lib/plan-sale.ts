// Browser-safe plan sale rules shared by pricing cards, checkout, submitOrder and admin settings.
export type SaleRow = {
  price: number | string;
  sale_active: boolean; sale_type: string; sale_value: number | string | null;
  sale_starts_at: string | null; sale_ends_at: string | null;
  sale_badge: string | null; sale_allow_promo: boolean;
};
export type SaleStatus = "none" | "active" | "scheduled" | "expired";
export type PlanSale = {
  status: SaleStatus; base: number; final: number; discount: number;
  tag: string; badge: string | null; endsAt: string | null; startsAt: string | null; allowPromo: boolean;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => String(n).replace(".", ",");

export function saleStatus(r: SaleRow, now = new Date()): SaleStatus {
  const v = Number(r.sale_value);
  if (!r.sale_active || !(v > 0)) return "none";
  const t = now.getTime();
  if (r.sale_starts_at && new Date(r.sale_starts_at).getTime() > t) return "scheduled";
  if (r.sale_ends_at && new Date(r.sale_ends_at).getTime() <= t) return "expired";
  return "active";
}

export function planSale(r: SaleRow, now = new Date()): PlanSale {
  const base = Number(r.price);
  const v = Number(r.sale_value);
  let status = saleStatus(r, now);
  const discount = status === "active" ? round2(r.sale_type === "fixed" ? v : (base * v) / 100) : 0;
  const final = round2(base - discount);
  if (status === "active" && final < 1) status = "none";
  const on = status === "active";
  return {
    status, base, final: on ? final : base, discount: on ? discount : 0,
    tag: r.sale_type === "fixed" ? `-${fmt(v)} €` : `-${fmt(v)}%`,
    badge: r.sale_badge?.trim() || null,
    endsAt: r.sale_ends_at, startsAt: r.sale_starts_at, allowPromo: !on || r.sale_allow_promo,
  };
}

/** Countdown text; null when no end date. Under 48h shows urgency. */
export function saleTimeLeft(endsAt: string | null, now = new Date()): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  if (ms < 48 * 3600e3) {
    const sameDay = end.toDateString() === now.toDateString();
    if (sameDay) return "Paskutinė diena!";
    const d = Math.floor(ms / 86400e3), h = Math.floor((ms % 86400e3) / 3600e3);
    return d > 0 ? `Liko ${d} d. ${h} val.` : `Liko ${h} val.`;
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `Pasiūlymas galioja iki ${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
}

export const SALE_PROMO_BLOCKED = "Šiam planui jau taikoma akcija, papildomi nuolaidų kodai netaikomi.";
