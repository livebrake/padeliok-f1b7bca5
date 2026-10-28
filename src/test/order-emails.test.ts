import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendOrderEmails } from '@/lib/order-emails.server';
import type { Invoice } from '@/lib/invoice-pdf';

const invoice: Invoice = { id: 'invoice-1', order_id: 'order-1', invoice_number: 'PAD0001', issue_date: '2026-10-28T13:00:00Z',
  line_item: 'Sklypo analizė', total_amount: 99, vat_rate: 0, vat_amount: 0, amount_without_vat: 99,
  buyer_details: { name: 'Jonas Jonaitis' }, seller_details: { company_name: 'Padeliok' } };
const data = { orderNumber: 'PAD-1001', isCompany: false, fullName: 'Jonas Jonaitis', email: 'jonas@example.test', phone: '+37060000000',
  planName: 'Standartinis', price: 99, projectGoal: '', comment: '', company: null, fileLinks: [], invoice };

describe('confirmation email PDF delivery', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it('requires a configured sender rather than silently skipping delivery', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendOrderEmails(data)).rejects.toThrow('nesukonfigūruotas');
  });
  it('generates a real PDF attachment with embedded Lithuanian fonts and stable retry content', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendOrderEmails(data);
    await sendOrderEmails(data);
    const first = fetchMock.mock.calls[0]?.[1];
    const retry = fetchMock.mock.calls[2]?.[1];
    const payload = JSON.parse(first.body);
    expect(payload.to).toEqual(['jonas@example.test']);
    expect(payload.attachments[0].filename).toBe('PAD0001.pdf');
    expect(atob(payload.attachments[0].content).slice(0, 5)).toBe('%PDF-');
    expect(first.headers['Idempotency-Key']).toBe('paid-client-invoice-1');
    expect(retry.body).toBe(first.body);
  });
  it('propagates provider errors so failed sends can retry', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('test rejection', { status: 403 })));
    await expect(sendOrderEmails(data)).rejects.toThrow('(403)');
  });
});