// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { processOrderToken } from '@/lib/montonio.server';

const mocks = vi.hoisted(() => ({ from: vi.fn(), fulfill: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('@/lib/paid-order.server', () => ({ fulfillPaidOrder: mocks.fulfill }));

const order = { id: 'order-id', order_number: 'PAD-1001', payment_status: 'PENDING', price: '49', montonio_uuid: null };
async function token(amount = 49) {
  return new SignJWT({ accessKey: 'test-access', merchantReference: 'PAD-1001', paymentStatus: 'PAID', grandTotal: amount })
    .setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('test-secret'));
}
describe('verified Montonio post-payment flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('MONTONIO_ACCESS_KEY', 'test-access'); vi.stubEnv('MONTONIO_SECRET_KEY', 'test-secret');
    const lookup = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }) };
    lookup.select.mockReturnValue(lookup); lookup.eq.mockReturnValue(lookup);
    const update = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
    update.update.mockReturnValue(update);
    mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(update);
    mocks.fulfill.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());
  it('completes invoice/email fulfillment immediately after recording verified PAID', async () => {
    await expect(processOrderToken(await token(), 'http://localhost:8080')).resolves.toEqual({ orderNumber: 'PAD-1001', status: 'PAID', fulfillment: 'complete' });
    expect(mocks.fulfill).toHaveBeenCalledWith('order-id');
    expect(mocks.from.mock.invocationCallOrder[1]).toBeLessThan(mocks.fulfill.mock.invocationCallOrder[0] ?? 0);
  });
  it('keeps payment PAID when PDF or email fails and signals a retry', async () => {
    mocks.fulfill.mockRejectedValue(new Error('email API error'));
    await expect(processOrderToken(await token(), 'http://localhost:8080')).resolves.toEqual({ orderNumber: 'PAD-1001', status: 'PAID', fulfillment: 'pending' });
  });
  it('never issues an invoice for an amount-mismatched token', async () => {
    await expect(processOrderToken(await token(99), 'http://localhost:8080')).rejects.toThrow('suma nesutampa');
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
});