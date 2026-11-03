import { siteUrl } from '@/lib/site-url';

/** Only the order selector is carried through login, never an arbitrary redirect URL. */
export function adminOrderSearch(search: Record<string, unknown>): { order_id?: string } {
  const id = typeof search.order_id === 'string' ? search.order_id.trim() : '';
  return id && id.length <= 128 ? { order_id: id } : {};
}

export function adminOrderUrl(orderId?: string | null, siteOverride?: string | null): string {
  const base = `${siteUrl(siteOverride)}/misko-skydas`;
  const { order_id } = adminOrderSearch({ order_id: orderId });
  return order_id ? `${base}?${new URLSearchParams({ order_id })}` : base;
}