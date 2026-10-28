import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfillPaidOrder } from '@/lib/paid-order.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), send: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/lib/order-emails.server', () => ({ sendOrderEmails: mocks.send }));

const invoice = { id: 'invoice-id', invoice_number: 'PAD0001', order_id: 'paid-order' };
const order = { id: 'paid-order', payment_status: 'PAID', order_number: 'PAD-1001', file_paths: [],
  client_type: 'private', full_name: 'Jonas Jonaitis', email: 'jonas@example.test', phone: '+37060000000', price: '99', plan_name: 'Standartinis' };

function query(result: unknown) {
  const chain = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), or: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), then: undefined as unknown };
  for (const method of ['update', 'eq', 'is', 'or', 'select'] as const) chain[method].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('paid-order fulfillment', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: invoice, error: null }); mocks.send.mockResolvedValue(undefined); });

  it('issues the invoice immediately and passes it to email before marking delivery successful', async () => {
    const claim = query({ data: order, error: null }), finish = query({ error: null });
    mocks.from.mockReturnValueOnce(claim).mockReturnValueOnce(finish);
    await fulfillPaidOrder('paid-order');
    expect(mocks.rpc).toHaveBeenCalledWith('issue_invoice', { order_uuid: 'paid-order' });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ invoice, price: 99 }));
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0] ?? 0);
    expect(mocks.send.mock.invocationCallOrder[0]).toBeLessThan(finish.update.mock.invocationCallOrder[0] ?? 0);
    expect(finish.update).toHaveBeenCalledWith(expect.objectContaining({ payment_email_sent_at: expect.any(String), payment_email_claimed_at: null }));
    expect(claim.is).toHaveBeenCalledWith('payment_email_sent_at', null);
  });

  it('backfills an invoice even when an email was already sent or another callback holds the lease', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: null }));
    await fulfillPaidOrder('paid-order');
    expect(mocks.rpc).toHaveBeenCalledWith('issue_invoice', { order_uuid: 'paid-order' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not claim email delivery if invoice generation fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('invoice failed') });
    await expect(fulfillPaidOrder('paid-order')).rejects.toThrow('invoice failed');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('releases a failed email lease without recording successful delivery', async () => {
    const claim = query({ data: order, error: null }), release = query({ error: null });
    mocks.from.mockReturnValueOnce(claim).mockReturnValueOnce(release);
    mocks.send.mockRejectedValue(new Error('email failed'));
    await expect(fulfillPaidOrder('paid-order')).rejects.toThrow('email failed');
    expect(release.update).toHaveBeenCalledWith({ payment_email_claimed_at: null });
    expect(release.eq).toHaveBeenCalledWith('payment_email_claimed_at', expect.any(String));
  });
});