import { describe, expect, it } from 'vitest';
import { WORK_STATUSES, canManageTeam, paymentLabel, shortName } from '@/lib/team-rules';
describe('Team rules',()=>{
  it('only super administrators manage accounts and finance',()=>{expect(canManageTeam('super_admin')).toBe(true);expect(canManageTeam('employee')).toBe(false);expect(canManageTeam(null)).toBe(false);});
  it('work statuses exclude payment statuses',()=>{expect([...WORK_STATUSES]).toEqual(['Naujas','Vykdoma','Atlikta','Atšaukta']);});
  it('payment labels follow provider state only',()=>{expect(paymentLabel('PAID')).toBe('Apmokėta');expect(paymentLabel('PENDING')).toBe('Laukia apmokėjimo');expect(paymentLabel('CANCELED')).toBe('Atšaukta');expect(paymentLabel('Vykdoma')).toBe('Laukia apmokėjimo');});
  it('shortens authenticated actor display and preserves system',()=>{expect(shortName('Jonas Antanaitis')).toBe('Jonas A.');expect(shortName('SISTEMA')).toBe('SISTEMA');});
});
import { financeSummary as fs2, formatEur as fe2 } from '@/lib/team-rules';
describe('finance', () => {
  it('sums only paid orders numerically', () => {
    const r = fs2([{ payment_status: 'PAID', price: '49' as unknown as number }, { payment_status: 'PAID', price: 199 }, { payment_status: 'PENDING', price: 99 }]);
    expect(r).toEqual({ revenue: 248, count: 2, average: 124 });
  });
  it('formats euros', () => expect(fe2(248)).toBe('248,00 €'));
});
