import type { Tables } from '@/integrations/supabase/types';
import { moneyCents } from '@/lib/payment-money';
export const WORK_STATUSES = ['Naujas', 'Vykdoma', 'Atlikta', 'Atšaukta'] as const;
export type TeamRole = 'super_admin' | 'employee';
export type TeamOrder = Omit<Tables<'orders'>, 'price'> & { price?: number };
export function canManageTeam(role: string | null | undefined) { return role === 'super_admin'; }
export function paymentLabel(status: string) {
  if (status === 'PAID' || status === 'Apmokėta') return 'Apmokėta';
  if (status === 'REFUNDED') return 'Grąžinta';
  if (status === 'PARTIALLY_REFUNDED') return 'Dalinai grąžinta';
  if (status === 'VOIDED') return 'Atmesta banko';
  if (status === 'ABANDONED') return 'Nutraukta';
  if (status === 'AUTHORIZED') return 'Autorizuota';
  if (['CANCELED', 'CANCELLED', 'Atšaukta'].includes(status)) return 'Atšaukta';
  return 'Laukia apmokėjimo';
}
export function shortName(name: string) {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.map(n => `${n[0] ?? ''}.`).join(' ')}` : first;
}export function toPrice(v: unknown) { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
export type FinancialOrder = { payment_status: string; price?: unknown; captured_amount_cents?: number | null; refunded_amount_cents?: number | null };
export function wasCaptured(o: FinancialOrder) {
  return o.payment_status !== 'VOIDED' && (o.captured_amount_cents != null ? o.captured_amount_cents > 0 : ['PAID', 'Apmokėta', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.payment_status));
}
export function capturedCents(o: FinancialOrder) { return wasCaptured(o) ? o.captured_amount_cents ?? moneyCents(toPrice(o.price)) : 0; }
export function refundedCents(o: FinancialOrder) { return wasCaptured(o) ? Math.min(capturedCents(o), o.payment_status === 'REFUNDED' ? capturedCents(o) : o.refunded_amount_cents ?? 0) : 0; }
export function netCents(o: FinancialOrder) { return capturedCents(o) - refundedCents(o); }
export function financeSummary(orders: FinancialOrder[]) {
  const paid = orders.filter(wasCaptured);
  const gross = paid.reduce((s, o) => s + capturedCents(o), 0) / 100;
  const refunds = paid.reduce((s, o) => s + refundedCents(o), 0) / 100;
  const revenue = paid.reduce((s, o) => s + netCents(o), 0) / 100;
  return { gross, refunds, revenue, count: paid.length, average: paid.length ? gross / paid.length : 0 };
}
export const formatEur = (n: number) => `${n.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, ' ')} €`;
export type FinancePeriod = 'month' | 'last_month' | 'quarter' | 'year' | 'all' | 'custom';
/** Custom range as YYYY-MM-DD dates, both inclusive (local time). */
export type CustomRange = { from?: string; to?: string };
export const FINANCE_PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: 'month', label: 'Šis mėnuo' }, { id: 'last_month', label: 'Praėjęs mėnuo' }, { id: 'quarter', label: 'Šis ketvirtis' }, { id: 'year', label: 'Šie metai' }, { id: 'all', label: 'Visas laikas' }, { id: 'custom', label: 'Pasirinktinis' },
];
export function periodRange(p: FinancePeriod, now = new Date(), custom?: CustomRange): [Date, Date] | null {
  if (p === 'custom') {
    const d = (v?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? ''); return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
    const f = d(custom?.from), t = d(custom?.to);
    if (!f && !t) return null;
    const end = t ? new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1) : new Date(8.64e15);
    return [f ?? new Date(0), end];
  }
  const y = now.getFullYear(), m = now.getMonth();
  if (p === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if (p === 'last_month') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (p === 'quarter') { const q = m - (m % 3); return [new Date(y, q, 1), new Date(y, q + 3, 1)]; }
  if (p === 'year') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return null;
}
/** Paid orders are dated by paid_at, falling back to created_at. */
export function inPeriod(o: { paid_at?: string | null; created_at: string }, p: FinancePeriod, now = new Date(), custom?: CustomRange) {
  const r = periodRange(p, now, custom); if (!r) return true;
  const t = new Date(o.paid_at ?? o.created_at).getTime();
  return t >= r[0].getTime() && t < r[1].getTime();
}
/** Captures use payment dates; refunds use observed successful transaction dates. */
export function financePeriodSummary(orders: (FinancialOrder & { id: string; paid_at?: string | null; created_at: string })[], refunds: { order_id: string; amount_cents: number; status: string; event_at: string }[], period: FinancePeriod, now = new Date(), custom?: CustomRange) {
  const paid = orders.filter(o => wasCaptured(o) && inPeriod(o, period, now, custom));
  const gross = paid.reduce((s, o) => s + capturedCents(o), 0);
  const refunded = periodRange(period, now, custom) === null
    ? orders.reduce((s, o) => s + refundedCents(o), 0)
    : refunds.filter(r => r.status === 'SUCCESSFUL' && orders.some(o => o.id === r.order_id && wasCaptured(o)) && inPeriod({ created_at: r.event_at }, period, now, custom)).reduce((s, r) => s + r.amount_cents, 0);
  return { gross: gross / 100, refunds: refunded / 100, revenue: (gross - refunded) / 100, count: paid.length, average: paid.length ? gross / 100 / paid.length : 0 };
}
export const PLAN_KEYS = ['Bazinis', 'Standartinis', 'Premium'] as const;
/** Paid-order count, revenue and revenue share per package. */
export function planBreakdown(orders: (FinancialOrder & { plan_name: string })[]) {
  const paid = orders.filter(wasCaptured);
  const total = paid.reduce((s, o) => s + netCents(o), 0) / 100;
  return PLAN_KEYS.map(name => {
    const list = paid.filter(o => o.plan_name.trim().toLowerCase() === name.toLowerCase());
    const revenue = list.reduce((s, o) => s + netCents(o), 0) / 100;
    return { name, count: list.length, revenue, share: total ? (revenue / total) * 100 : 0 };
  });
}
/** Discounts granted on paid orders, with per-plan and per-code breakdowns. Uses order snapshots only. */
export function discountSummary(orders: (FinancialOrder & { plan_name: string; promo_code?: string | null; promo_note?: string | null; discount_amount?: unknown })[]) {
  const used = orders.filter(o => wasCaptured(o) && o.promo_code);
  const sum = (l: typeof used) => l.reduce((s, o) => s + moneyCents(toPrice(o.discount_amount)), 0) / 100;
  const codes = [...new Set(used.flatMap(o => o.promo_code ? [o.promo_code] : []))].sort();
  return {
    total: sum(used), count: used.length,
    byPlan: PLAN_KEYS.map(name => { const l = used.filter(o => o.plan_name.trim().toLowerCase() === name.toLowerCase()); return { name, count: l.length, total: sum(l) }; }),
    byCode: codes.map(code => { const l = used.filter(o => o.promo_code === code); const note = l.find(o => o.promo_note)?.promo_note ?? null; return { code, count: l.length, total: sum(l), revenue: l.reduce((s, o) => s + netCents(o), 0) / 100, note }; }),
  };
}
/** Per-code performance on paid orders: usage count, revenue (charged amount) and discount given. */
export function promoCodeStats(orders: (FinancialOrder & { discount_amount?: unknown; promo_code_id?: string | null })[], id: string) {
  const l = orders.filter(o => o.promo_code_id === id && wasCaptured(o));
  return { count: l.length, revenue: l.reduce((s, o) => s + netCents(o), 0) / 100, discount: l.reduce((s, o) => s + moneyCents(toPrice(o.discount_amount)), 0) / 100 };
}
/** Report filter: matches promo code or internal note, case-insensitive. */
export function matchesPromoFilter(r: { code: string; note?: string | null }, q: string) {
  const t = q.trim().toLowerCase(); if (!t) return true;
  return r.code.toLowerCase().includes(t) || (r.note ?? '').toLowerCase().includes(t);
}

/** Plan-sale label from the order snapshot ("Akcija -30% (badge)"), or null when bought without a sale. */
export function saleLabelOf(o: { discount_label?: string | null }) {
  return (o.discount_label ?? '').split(' + ').find(p => p.startsWith('Akcija ')) ?? null;
}
/** Sale vs full-price comparison on paid orders, plus per-sale and per-plan breakdowns. Uses order snapshots only. */
export function saleSummary(orders: (FinancialOrder & { plan_name: string; discount_label?: string | null; promo_code?: string | null; discount_amount?: unknown })[]) {
  const paid = orders.filter(wasCaptured);
  const onSale = paid.filter(o => saleLabelOf(o));
  const full = paid.filter(o => !saleLabelOf(o));
  const rev = (l: typeof paid) => l.reduce((s, o) => s + netCents(o), 0) / 100;
  const disc = (l: typeof paid) => l.reduce((s, o) => s + moneyCents(toPrice(o.discount_amount)), 0) / 100;
  const avg = (l: typeof paid) => l.length ? rev(l) / l.length : 0;
  const share = (n: number) => paid.length ? (n / paid.length) * 100 : 0;
  const labels = [...new Set(onSale.map(o => saleLabelOf(o)!))];
  const bySale = labels.map(label => { const l = onSale.filter(o => saleLabelOf(o) === label); const plans = [...new Set(l.map(o => o.plan_name))].sort(); return { label, plans, count: l.length, revenue: rev(l), discount: disc(l), average: avg(l) }; }).sort((a, b) => b.revenue - a.revenue);
  const byPlan = PLAN_KEYS.map(name => { const m = (o: { plan_name: string }) => o.plan_name.trim().toLowerCase() === name.toLowerCase(); const s = onSale.filter(m), f = full.filter(m); return { name, saleCount: s.length, fullCount: f.length, saleRevenue: rev(s), fullRevenue: rev(f) }; });
  const promoOnly = paid.filter(o => o.promo_code && !saleLabelOf(o));
  return {
    sale: { count: onSale.length, revenue: rev(onSale), discount: disc(onSale), average: avg(onSale), share: share(onSale.length) },
    full: { count: full.length, revenue: rev(full), average: avg(full), share: share(full.length) },
    channels: { sale: rev(onSale), promo: rev(promoOnly), none: rev(full.filter(o => !o.promo_code)) },
    bySale, byPlan,
  };
}
