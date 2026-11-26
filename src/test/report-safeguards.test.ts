import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), download: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: (args: unknown) => unknown) => handler };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  from: () => { const chain = { select: () => chain, eq: () => chain, maybeSingle: mocks.lookup }; return chain; },
  storage: { from: () => ({ download: mocks.download }) },
} }));
import { sendReportEmail } from '@/lib/report.functions';

const invoke = (expectedSentAt: string | null, confirmResend: boolean) => {
  const fn = sendReportEmail as unknown as (args: unknown) => Promise<unknown>;
  return fn({ data: { orderId: 'order', path: 'report.pdf', subject: 'Ataskaita', body: 'Sveiki', expectedSentAt, confirmResend }, context: { supabase: { rpc: vi.fn().mockResolvedValue({ data: 'employee', error: null }) } } });
};

describe('server repeat-send protection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'unit-test-only');
    mocks.lookup.mockResolvedValue({ data: { id: 'order', report_sent_at: '2026-11-25T16:40:00Z', response_file_paths: ['report.pdf'] }, error: null });
  });
  it('blocks unconfirmed resend before downloading or sending', async () => {
    await expect(invoke('2026-11-25T16:40:00Z', false)).rejects.toThrow('Patvirtinkite');
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('blocks stale first-send dialog even with confirmation', async () => {
    await expect(invoke(null, true)).rejects.toThrow('informacija pasikeitė');
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('allows explicitly confirmed current resend to reach the attachment lookup', async () => {
    mocks.download.mockResolvedValue({ data: null, error: new Error('Missing test attachment') });
    await expect(invoke('2026-11-25T16:40:00Z', true)).rejects.toThrow('failo');
    expect(mocks.download).toHaveBeenCalledWith('report.pdf');
  });
});