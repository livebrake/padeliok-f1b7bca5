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
