import { z } from 'zod';
import { moneyCents } from '@/lib/payment-money';
import { montonioApi } from '@/lib/montonio-environment.server';

export class MontonioEventError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export const refundStatus = z.enum(['PENDING', 'PROCESSING', 'SUCCESSFUL', 'REJECTED', 'CANCELED']);
export const orderStatus = z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'VOIDED', 'ABANDONED', 'PARTIALLY_REFUNDED', 'REFUNDED']);
export const refundClaims = z.object({
  accessKey: z.string(), refundUuid: z.string().uuid(), orderUuid: z.string().uuid(),
  refundStatus, refundStatusDescription: z.string().max(2000).nullable().optional(),
  refundAmount: z.number().positive(), iat: z.number().int().nonnegative(), exp: z.number().int(),
});
const snapshotSchema = z.object({
  uuid: z.string().uuid(), merchantReference: z.string().min(1).max(200),
  paymentStatus: orderStatus, grandTotal: z.union([z.string(), z.number()]), currency: z.literal('EUR'),
  refunds: z.array(z.object({ uuid: z.string().uuid(), amount: z.union([z.string(), z.number()]),
    status: refundStatus, currency: z.literal('EUR'), createdAt: z.string().datetime(),
  })).max(1000),
});

/** GET /orders/:uuid is the documented reconciliation source, including its refunds array. */
export async function refundSnapshot(uuid: string, authorization: string, _eventAt: string) {
  const response = await fetch(`${montonioApi()}/orders/${uuid}`, {
    headers: { Authorization: `Bearer ${authorization}` }, signal: AbortSignal.timeout(10000),
  }).catch(() => { throw new MontonioEventError('Montonio reconciliation request failed'); });
  if (!response.ok) throw new MontonioEventError('Montonio reconciliation unavailable');
  const parsed = snapshotSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || parsed.data.uuid !== uuid) throw new MontonioEventError('Unsupported Montonio reconciliation response');
  const snapshot = parsed.data;
  // The API exposes creation, not settlement time. Record when each status was observed;
  // never assign an unrelated notification's issuance time to fetched refund rows.
  const observedAt = new Date().toISOString();
  return { snapshot, rows: snapshot.refunds.map(r => ({ uuid: r.uuid, amount_cents: moneyCents(r.amount),
    status: r.status, created_at: r.createdAt, event_at: observedAt, description: null as string | null,
  })) };
}

export async function eventFingerprint(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}