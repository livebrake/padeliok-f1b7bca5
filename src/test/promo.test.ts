import { describe, expect, it } from 'vitest';
import { applyPromo, type PromoRow } from '@/lib/promo';
import { discountSummary } from '@/lib/team-rules';
const base: PromoRow = { id: '1', code: 'VIP-10', discount_type: 'percent', discount_value: 10, valid_from: null, valid_to: null, max_uses: null, plan_key: null, is_active: true };
const now = new Date('2026-10-30T12:00:00Z');
describe('promo codes', () => {
  it('percent discount on 199 €', () => expect(applyPromo(base, 'premium', 199, 0, now)).toEqual({ ok: true, discount: 19.9, final: 179.1, label: 'Pritaikyta 10% nuolaida' }));
  it('fixed 40 € discount', () => expect(applyPromo({ ...base, discount_type: 'fixed', discount_value: 40 }, 'premium', 199, 0, now)).toMatchObject({ ok: true, final: 159, label: 'Pritaikyta 40 € nuolaida' }));
  it('plan-bound code rejects other plans', () => expect(applyPromo({ ...base, plan_key: 'standartinis' }, 'premium', 199, 0, now).ok).toBe(false));
  it('two-plan code accepts both selected plans', () => {
    const p = { ...base, plan_keys: ['bazinis', 'premium'] };
    expect(applyPromo(p, 'premium', 199, 0, now).ok).toBe(true);
    expect(applyPromo(p, 'bazinis', 49, 0, now).ok).toBe(true);
  });
  it('two-plan code rejects the unselected plan', () => expect(applyPromo({ ...base, plan_keys: ['bazinis', 'premium'] }, 'standartinis', 99, 0, now).ok).toBe(false));
  it('inactive code rejected', () => expect(applyPromo({ ...base, is_active: false }, 'premium', 199, 0, now).ok).toBe(false));
  it('expired code rejected', () => expect(applyPromo({ ...base, valid_to: '2026-10-29T00:00:00Z' }, 'premium', 199, 0, now).ok).toBe(false));
  it('usage limit reached rejected', () => expect(applyPromo({ ...base, max_uses: 2 }, 'premium', 199, 2, now).ok).toBe(false));
  it('summary counts only paid orders with codes', () => {
    const s = discountSummary([
      { payment_status: 'PAID', plan_name: 'Premium', promo_code: 'VIP-10', discount_amount: 19.9 },
      { payment_status: 'PENDING', plan_name: 'Premium', promo_code: 'VIP-10', discount_amount: 19.9 },
      { payment_status: 'PAID', plan_name: 'Bazinis', promo_code: null, discount_amount: 0 },
    ]);
    expect(s.total).toBe(19.9); expect(s.count).toBe(1); expect(s.byCode).toEqual([{ code: 'VIP-10', count: 1, total: 19.9, note: null }]);
  });
});

describe('promo note snapshot', () => {
  it('reports the note saved on the order even when the code no longer exists', () => {
    const s = discountSummary([{ payment_status: 'PAID', plan_name: 'Bazinis', promo_code: 'JONAS10', promo_note: 'Architektas Jonas', discount_amount: 5 }]);
    expect(s.byCode[0]?.note).toBe('Architektas Jonas');
  });
});
