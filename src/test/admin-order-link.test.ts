import { describe, expect, it } from 'vitest';
import { adminOrderSearch, adminOrderUrl } from '@/lib/admin-order-link';

describe('admin order deep links', () => {
  it('links to the exact order on the production domain', () => {
    expect(adminOrderUrl('order-1')).toBe('https://padeliok.lt/misko-skydas?order_id=order-1');
  });
  it('falls back to the main admin view for a missing legacy ID', () => {
    expect(adminOrderUrl()).toBe('https://padeliok.lt/misko-skydas');
    expect(adminOrderUrl(null)).toBe('https://padeliok.lt/misko-skydas');
    expect(adminOrderUrl('  ')).toBe('https://padeliok.lt/misko-skydas');
  });
  it('encodes the ID without allowing additional query parameters', () => {
    const url = new URL(adminOrderUrl('order&other=1'));
    expect(url.searchParams.get('order_id')).toBe('order&other=1');
    expect(url.searchParams.has('other')).toBe(false);
  });
  it('preserves only a valid order selector through login', () => {
    expect(adminOrderSearch({ order_id: 'order-1', redirect: 'https://example.test' })).toEqual({ order_id: 'order-1' });
    expect(adminOrderSearch({ order_id: ['order-1'] })).toEqual({});
    expect(adminOrderSearch({ order_id: 123 })).toEqual({});
  });
  it('never links to a temporary Lovable origin', () => {
    expect(adminOrderUrl('order-1', 'https://padeliok.lovable.app')).toBe('https://padeliok.lt/misko-skydas?order_id=order-1');
  });
});