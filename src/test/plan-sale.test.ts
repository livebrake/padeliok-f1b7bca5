import { describe, expect, it } from 'vitest';
import { planSale, saleTimeLeft } from '@/lib/plan-sale';

const now = new Date('2026-12-01T12:00:00Z');
const row = (o: Partial<Parameters<typeof planSale>[0]> = {}) => ({
  price: 99, sale_active: true, sale_type: 'percent', sale_value: 30, sale_starts_at: null,
  sale_ends_at: null, sale_badge: null, sale_allow_promo: false, ...o,
});

describe('plan sales', () => {
  it('30% off Standartinis 99 € gives 69,30 €', () => {
    expect(planSale(row(), now)).toMatchObject({ status: 'active', final: 69.3, discount: 29.7 });
  });
  it('fixed 20 € off', () => {
    expect(planSale(row({ sale_type: 'fixed', sale_value: 20 }), now).final).toBe(79);
  });
  it('scheduled sale keeps base price until start', () => {
    const s = planSale(row({ sale_starts_at: '2026-12-05T00:00:00Z' }), now);
    expect(s.status).toBe('scheduled');
    expect(s.final).toBe(99);
  });
  it('expired sale keeps base price', () => {
    expect(planSale(row({ sale_ends_at: '2026-11-30T00:00:00Z' }), now)).toMatchObject({ status: 'expired', final: 99 });
  });
  it('blocks promo codes during a sale by default', () => {
    expect(planSale(row(), now).allowPromo).toBe(false);
    expect(planSale(row({ sale_allow_promo: true }), now).allowPromo).toBe(true);
  });
  it('no end date shows no countdown', () => {
    expect(saleTimeLeft(null, now)).toBeNull();
  });
  it('under 48h shows remaining time', () => {
    expect(saleTimeLeft('2026-12-02T18:00:00Z', now)).toBe('Liko 1 d. 6 val.');
  });
});
