import type { Tables } from '@/integrations/supabase/types';
export const WORK_STATUSES = ['Naujas', 'Vykdoma', 'Atlikta', 'Atšaukta'] as const;
export type TeamRole = 'super_admin' | 'employee';
export type TeamOrder = Omit<Tables<'orders'>, 'price'> & { price?: number };
export function canManageTeam(role: string | null | undefined) { return role === 'super_admin'; }
export function paymentLabel(status: string) {
  if (status === 'PAID' || status === 'Apmokėta') return 'Apmokėta';
  if (['CANCELED', 'CANCELLED', 'Atšaukta'].includes(status)) return 'Atšaukta';
  return 'Laukia apmokėjimo';
}
export function shortName(name: string) {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.map(n => `${n[0] ?? ''}.`).join(' ')}` : first;
}export function toPrice(v: unknown) { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
export function financeSummary(orders: { payment_status: string; price?: unknown }[]) {
  const paid = orders.filter(o => paymentLabel(o.payment_status) === 'Apmokėta');
  const revenue = paid.reduce((s, o) => s + toPrice(o.price), 0);
  return { revenue, count: paid.length, average: paid.length ? revenue / paid.length : 0 };
}
export const formatEur = (n: number) => `${n.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, ' ')} €`;
export type FinancePeriod = 'month' | 'last_month' | 'quarter' | 'year' | 'all';
export const FINANCE_PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: 'month', label: 'Šis mėnuo' }, { id: 'last_month', label: 'Praėjęs mėnuo' }, { id: 'quarter', label: 'Šis ketvirtis' }, { id: 'year', label: 'Šie metai' }, { id: 'all', label: 'Visas laikas' },
];
export function periodRange(p: FinancePeriod, now = new Date()): [Date, Date] | null {
  const y = now.getFullYear(), m = now.getMonth();
  if (p === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if (p === 'last_month') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (p === 'quarter') { const q = m - (m % 3); return [new Date(y, q, 1), new Date(y, q + 3, 1)]; }
  if (p === 'year') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return null;
}
/** Paid orders are dated by paid_at, falling back to created_at. */
export function inPeriod(o: { paid_at?: string | null; created_at: string }, p: FinancePeriod, now = new Date()) {
  const r = periodRange(p, now); if (!r) return true;
  const t = new Date(o.paid_at ?? o.created_at).getTime();
  return t >= r[0].getTime() && t < r[1].getTime();
}
export const PLAN_KEYS = ['Bazinis', 'Standartinis', 'Premium'] as const;
/** Paid-order count, revenue and revenue share per package. */
export function planBreakdown(orders: { payment_status: string; price?: unknown; plan_name: string }[]) {
  const paid = orders.filter(o => paymentLabel(o.payment_status) === 'Apmokėta');
  const total = paid.reduce((s, o) => s + toPrice(o.price), 0);
  return PLAN_KEYS.map(name => {
    const list = paid.filter(o => o.plan_name.trim().toLowerCase() === name.toLowerCase());
    const revenue = list.reduce((s, o) => s + toPrice(o.price), 0);
    return { name, count: list.length, revenue, share: total ? (revenue / total) * 100 : 0 };
  });
}
/** Discounts granted on paid orders, with per-plan and per-code breakdowns. Uses order snapshots only. */
export function discountSummary(orders: { payment_status: string; plan_name: string; promo_code?: string | null; promo_note?: string | null; discount_amount?: unknown }[]) {
  const used = orders.filter(o => paymentLabel(o.payment_status) === 'Apmokėta' && o.promo_code);
  const sum = (l: typeof used) => l.reduce((s, o) => s + toPrice(o.discount_amount), 0);
  const codes = [...new Set(used.map(o => o.promo_code!))].sort();
  return {
    total: sum(used), count: used.length,
    byPlan: PLAN_KEYS.map(name => { const l = used.filter(o => o.plan_name.trim().toLowerCase() === name.toLowerCase()); return { name, count: l.length, total: sum(l) }; }),
    byCode: codes.map(code => { const l = used.filter(o => o.promo_code === code); const note = l.find(o => o.promo_note)?.promo_note ?? null; return { code, count: l.length, total: sum(l), note }; }),
  };
}
