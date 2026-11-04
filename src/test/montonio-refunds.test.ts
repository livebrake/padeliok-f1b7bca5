// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { processOrderToken, processRefundToken } from '@/lib/montonio.server';
import { moneyCents } from '@/lib/payment-money';
import { montonioApi } from '@/lib/montonio-environment.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), fulfill: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: mocks }));
vi.mock('@/lib/paid-order.server', () => ({ fulfillPaidOrder: mocks.fulfill }));
const uuid = '4a9115b7-8e55-48f4-bd7e-febc2402e8a0';
const refundUuid = 'a721af46-2dcb-4223-a227-5f85d1606cfe';
const claims = { accessKey: 'test-access', refundUuid, orderUuid: uuid, refundStatus: 'SUCCESSFUL', refundStatusDescription: null, refundAmount: 25 };
const snapshot = { uuid, merchantReference: 'PAD-1001', paymentStatus: 'PARTIALLY_REFUNDED', grandTotal: '99.00', currency: 'EUR',
  refunds: [{ uuid: refundUuid, amount: '25.00', status: 'SUCCESSFUL', currency: 'EUR', createdAt: '2026-11-04T12:00:00.000Z' }],
};
async function signed(payload: Record<string, unknown>, secret = 'test-secret') {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
}
describe('documented Montonio refund tokens', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('MONTONIO_ACCESS_KEY', 'test-access'); vi.stubEnv('MONTONIO_SECRET_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(snapshot)));
    mocks.rpc.mockResolvedValue({ data: { order_id: 'id', payment_status: 'PARTIALLY_REFUNDED' }, error: null });
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'id', price: 99, montonio_uuid: uuid }, error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); mocks.from.mockReturnValue(query);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('reconciles documented refund IDs and 2500 cents without sending confirmations', async () => {
    await processRefundToken(await signed(claims));
    expect(mocks.rpc).toHaveBeenCalledWith('record_montonio_event', expect.objectContaining({ provider_uuid: uuid, total_cents: 9900,
      refund_rows: [expect.objectContaining({ uuid: refundUuid, amount_cents: 2500, status: 'SUCCESSFUL' })],
    }));
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
  it('uses an identical event key for duplicate delivery', async () => {
    const token = await signed(claims);
    vi.mocked(fetch).mockImplementation(async () => Response.json(snapshot));
    await processRefundToken(token); await processRefundToken(token);
    expect(mocks.rpc.mock.calls[0]?.[1].event_key).toBe(mocks.rpc.mock.calls[1]?.[1].event_key);
  });
  it('rejects forged signatures before any API or database operation', async () => {
    await expect(processRefundToken(await signed(claims, 'forged'))).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects a signed token from another access key', async () => {
    await expect(processRefundToken(await signed({ ...claims, accessKey: 'other' }))).rejects.toThrow('access key');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects mismatched refund amounts without recording', async () => {
    await expect(processRefundToken(await signed({ ...claims, refundAmount: 26 }))).rejects.toThrow('reconciled');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not regress successful refunds on a delayed PENDING token', async () => {
    await processRefundToken(await signed({ ...claims, refundStatus: 'PENDING' }));
    expect(mocks.rpc.mock.calls[0]?.[1].refund_rows[0].status).toBe('SUCCESSFUL');
  });
  it('retries provider failures rather than acknowledging dropped refunds', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unavailable', { status: 503 }));
    await expect(processRefundToken(await signed(claims))).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('retries network timeouts and malformed provider responses', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network timeout'));
    await expect(processRefundToken(await signed(claims))).rejects.toMatchObject({ status: 503 });
    vi.mocked(fetch).mockResolvedValue(new Response('not-json', { status: 200 }));
    await expect(processRefundToken(await signed(claims))).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects unsupported refund statuses explicitly', async () => {
    await expect(processRefundToken(await signed({ ...claims, refundStatus: 'UNKNOWN' }))).rejects.toMatchObject({ status: 422 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('reconciles orderToken partial refunds instead of ignoring them', async () => {
    await expect(processOrderToken(await signed({ accessKey: 'test-access', merchantReference: 'PAD-1001', uuid, currency: 'EUR', grandTotal: 99, paymentStatus: 'PARTIALLY_REFUNDED' }), 'http://localhost:8080'))
      .resolves.toEqual({ orderNumber: 'PAD-1001', status: 'PARTIALLY_REFUNDED' });
    expect(mocks.rpc.mock.calls[0]?.[1].refund_rows[0].amount_cents).toBe(2500);
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
  it('never re-sends paid fulfillment when a late PAID token meets a refunded order', async () => {
    await processOrderToken(await signed({ accessKey: 'test-access', merchantReference: 'PAD-1001', uuid, currency: 'EUR', grandTotal: 99, paymentStatus: 'PAID' }), 'http://localhost:8080');
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
  it('accepts cents precisely and rejects fractions smaller than a cent', () => {
    expect(moneyCents(33.09)).toBe(3309); expect(moneyCents('0.10')).toBe(10);
    expect(() => moneyCents(0.001)).toThrow(); expect(() => moneyCents(-1)).toThrow();
  });
  it.each(['VOIDED', 'ABANDONED', 'AUTHORIZED', 'PENDING'])('records %s without issuing invoices or email', async status => {
    mocks.rpc.mockResolvedValue({ data: { payment_status: status }, error: null });
    await expect(processOrderToken(await signed({ accessKey: 'test-access', merchantReference: 'PAD-1001', uuid, currency: 'EUR', grandTotal: 99, paymentStatus: status }), 'http://localhost:8080')).resolves.toEqual({ orderNumber: 'PAD-1001', status });
    expect(mocks.rpc).toHaveBeenCalledWith('record_montonio_event', expect.objectContaining({ new_status: status, total_cents: 9900 }));
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
  it('rejects expired refund tokens before reconciling', async () => {
    const token = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(1).sign(new TextEncoder().encode('test-secret'));
    await expect(processRefundToken(token)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects non-EUR refunds without recording', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...snapshot, currency: 'USD' }));
    await expect(processRefundToken(await signed(claims))).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('uses one explicit environment for both payment and refund API calls', async () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'sandbox');
    expect(montonioApi()).toBe('https://sandbox-stargate.montonio.com/api');
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'production');
    expect(montonioApi()).toBe('https://stargate.montonio.com/api');
    await processRefundToken(await signed(claims));
    expect(fetch).toHaveBeenCalledWith(`https://stargate.montonio.com/api/orders/${uuid}`, expect.anything());
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'invalid');
    expect(montonioApi).toThrow('Unsupported');
  });
  it('uses observed time for unrelated refund rows, not delayed token issuance time', async () => {
    const token = await signed({ ...claims, iat: 1 });
    const started = Date.now();
    await processRefundToken(token);
    const observed = Date.parse(mocks.rpc.mock.calls[0]?.[1].refund_rows[0].event_at);
    expect(observed).toBeGreaterThanOrEqual(started);
    expect(observed).toBeLessThanOrEqual(Date.now());
  });
});