import { describe, expect, it } from 'vitest';
import { planBreakdown } from '@/lib/team-rules';
describe('planBreakdown', () => {
  it('counts only paid orders and computes revenue share', () => {
    const r = planBreakdown([
      { plan_name: 'Bazinis', price: '49', payment_status: 'PAID' },
      { plan_name: 'Premium', price: 199, payment_status: 'PAID' },
      { plan_name: 'Premium', price: 199, payment_status: 'PENDING' },
    ]);
    expect(r.find(p => p.name === 'Bazinis')).toMatchObject({ count: 1, revenue: 49 });
    expect(r.find(p => p.name === 'Premium')).toMatchObject({ count: 1, revenue: 199 });
    expect(r.find(p => p.name === 'Premium')!.share).toBeCloseTo(80.24, 1);
    expect(r.find(p => p.name === 'Standartinis')).toMatchObject({ count: 0, share: 0 });
  });
});
