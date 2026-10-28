import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ adminRpc: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder,
    handler: (handler: (args: unknown) => unknown) => handler };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.adminRpc } }));
import { ensureInvoice } from '@/lib/invoices.functions';

function invoke(role: string, existing: unknown = null, error: unknown = null) {
  const lookup = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: existing, error }) };
  lookup.select.mockReturnValue(lookup); lookup.eq.mockReturnValue(lookup);
  const fn = ensureInvoice as unknown as (args: unknown) => Promise<unknown>;
  return fn({ data: { orderId: 'paid-order' }, context: { supabase: {
    rpc: vi.fn().mockResolvedValue({ data: role, error: null }), from: vi.fn().mockReturnValue(lookup),
  } } });
}

describe('super-admin invoice backfill', () => {
  beforeEach(() => vi.resetAllMocks());
  it('issues a missing paid-order invoice before returning the row for download', async () => {
    const invoice = { id: 'new-invoice', invoice_number: 'PAD0002' };
    mocks.adminRpc.mockResolvedValue({ data: invoice, error: null });
    await expect(invoke('super_admin')).resolves.toEqual({ ...invoice, generated: true });
    expect(mocks.adminRpc).toHaveBeenCalledWith('issue_invoice', { order_uuid: 'paid-order' });
  });
  it('returns an existing invoice without issuing another one', async () => {
    const invoice = { id: 'existing-invoice' };
    await expect(invoke('super_admin', invoice)).resolves.toEqual({ ...invoice, generated: false });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it('denies employees before any privileged invoice operation', async () => {
    await expect(invoke('employee')).rejects.toThrow('tik vadovas');
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it('does not issue an invoice when lookup failed', async () => {
    await expect(invoke('super_admin', null, new Error('lookup failed'))).rejects.toThrow('patikrinti');
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
});