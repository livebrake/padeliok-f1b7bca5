import { describe, expect, it } from 'vitest';
import { financePeriodSummary, financeSummary, paymentLabel, planBreakdown, promoCodeStats } from '@/lib/team-rules';

describe('refund finance rules', () => {
  const orders = [
    { payment_status: 'PAID', price: 49, captured_amount_cents: 4900, refunded_amount_cents: 0, plan_name: 'Bazinis' },
    { payment_status: 'PARTIALLY_REFUNDED', price: 99, captured_amount_cents: 9900, refunded_amount_cents: 2500, plan_name: 'Standartinis', promo_code_id: 'partner', discount_amount: 10 },
    { payment_status: 'REFUNDED', price: 199, captured_amount_cents: 19900, refunded_amount_cents: 19900, plan_name: 'Premium' },
    { payment_status: 'VOIDED', price: 199, captured_amount_cents: 0, refunded_amount_cents: 0, plan_name: 'Premium' },
    { payment_status: 'ABANDONED', price: 49, captured_amount_cents: 0, refunded_amount_cents: 0, plan_name: 'Bazinis' },
  ];
  it('separates captured gross 347 EUR, refunds 224 EUR and net 123 EUR', () => {
    expect(financeSummary(orders)).toMatchObject({ gross: 347, refunds: 224, revenue: 123, count: 3, average: 347 / 3 });
  });
  it('shows exact lifecycle labels', () => {
    expect(paymentLabel('REFUNDED')).toBe('Grąžinta');
    expect(paymentLabel('PARTIALLY_REFUNDED')).toBe('Dalinai grąžinta');
    expect(paymentLabel('VOIDED')).toBe('Atmesta banko');
    expect(paymentLabel('ABANDONED')).toBe('Nutraukta');
  });
  it('uses remaining net revenue in package and partner reports', () => {
    expect(planBreakdown(orders).find(r => r.name === 'Standartinis')).toMatchObject({ count: 1, revenue: 74 });
    expect(promoCodeStats(orders, 'partner')).toEqual({ count: 1, revenue: 74, discount: 10 });
  });
  it('adds monetary values in integer cents', () => {
    expect(financeSummary([{ payment_status: 'PAID', price: 0.1 }, { payment_status: 'PAID', price: 0.2 }]).revenue).toBe(0.3);
  });
  it('records a February refund of a January payment in February, not January', () => {
    const rows = [{ id: 'order', payment_status: 'PARTIALLY_REFUNDED', price: 99, captured_amount_cents: 9900, refunded_amount_cents: 2500, paid_at: '2026-01-10T12:00:00Z', created_at: '2026-01-10T12:00:00Z' }];
    const refunds = [{ order_id: 'order', amount_cents: 2500, status: 'SUCCESSFUL', event_at: '2026-02-10T12:00:00Z' }];
    expect(financePeriodSummary(rows, refunds, 'month', new Date(2026, 0, 15))).toMatchObject({ gross: 99, refunds: 0, revenue: 99 });
    expect(financePeriodSummary(rows, refunds, 'month', new Date(2026, 1, 15))).toMatchObject({ gross: 0, refunds: 25, revenue: -25 });
    expect(financePeriodSummary(rows, refunds, 'all')).toMatchObject({ gross: 99, refunds: 25, revenue: 74 });
  });
  it('does not count a legacy fully refunded order as net revenue when the new ledger defaults to zero', () => {
    expect(financeSummary([{ payment_status: 'REFUNDED', price: 99, refunded_amount_cents: 0 }])).toMatchObject({ gross: 99, refunds: 99, revenue: 0 });
  });
});