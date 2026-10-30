// Browser-safe promo code rules shared by checkout preview, order submission and admin UI.
export type PromoRow = {
  id: string; code: string; discount_type: string; discount_value: number | string;
  valid_from: string | null; valid_to: string | null; max_uses: number | null;
  plan_key: string | null; plan_keys?: string[] | null; is_active: boolean;
};
export type PromoResult =
  | { ok: true; discount: number; final: number; label: string }
  | { ok: false; message: string };

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

export function promoLabel(type: string, value: number) {
  return type === "percent" ? `Pritaikyta ${value}% nuolaida` : `Pritaikyta ${value} € nuolaida`;
}

export function isExpired(p: Pick<PromoRow, "valid_to" | "max_uses">, used: number, now = new Date()) {
  return (!!p.valid_to && new Date(p.valid_to).getTime() < now.getTime()) || (p.max_uses != null && used >= p.max_uses);
}

/** Plans a code applies to; empty list = all plans. Legacy single plan_key is honoured. */
export function promoPlans(p: Pick<PromoRow, "plan_key" | "plan_keys">): string[] {
  if (p.plan_keys && p.plan_keys.length) return p.plan_keys;
  return p.plan_key ? [p.plan_key] : [];
}

export function applyPromo(p: PromoRow | null, planKey: string, price: number, used: number, now = new Date()): PromoResult {
  const bad = { ok: false as const, message: "Nuolaidos kodas negalioja." };
  if (!p || !p.is_active) return bad;
  if (p.valid_from && new Date(p.valid_from).getTime() > now.getTime()) return bad;
  if (isExpired(p, used, now)) return bad;
  const plans = promoPlans(p);
  if (plans.length && !plans.includes(planKey.toLowerCase()))
    return { ok: false, message: "Šis kodas netaikomas pasirinktam planui." };
  const v = Number(p.discount_value);
  const discount = round2(p.discount_type === "percent" ? (price * v) / 100 : v);
  const final = round2(price - discount);
  if (!(v > 0) || final < 1) return bad;
  return { ok: true, discount, final, label: promoLabel(p.discount_type, v) };
}
