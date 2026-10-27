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
}