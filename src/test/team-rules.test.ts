import { describe, expect, it } from 'vitest';
import { WORK_STATUSES, canManageTeam, paymentLabel, shortName } from '@/lib/team-rules';
describe('Team rules',()=>{
  it('only super administrators manage accounts and finance',()=>{expect(canManageTeam('super_admin')).toBe(true);expect(canManageTeam('employee')).toBe(false);expect(canManageTeam(null)).toBe(false);});
  it('work statuses exclude payment statuses',()=>{expect([...WORK_STATUSES]).toEqual(['Naujas','Vykdoma','Atlikta','Atšaukta']);});
  it('payment labels follow provider state only',()=>{expect(paymentLabel('PAID')).toBe('Apmokėta');expect(paymentLabel('PENDING')).toBe('Laukia apmokėjimo');expect(paymentLabel('CANCELED')).toBe('Atšaukta');expect(paymentLabel('Vykdoma')).toBe('Laukia apmokėjimo');});
  it('shortens authenticated actor display and preserves system',()=>{expect(shortName('Jonas Antanaitis')).toBe('Jonas A.');expect(shortName('SISTEMA')).toBe('SISTEMA');});
});