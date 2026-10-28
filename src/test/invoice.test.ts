import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, invoiceTotals, invoicesCsv } from '@/lib/invoice-pdf';

describe('invoices', () => {
  it('pads numbers to 4 digits with series prefix', () => {
    expect(formatInvoiceNumber('PAD', 1)).toBe('PAD0001');
    expect(formatInvoiceNumber('PAD', 12345)).toBe('PAD12345');
  });
  it('non-VAT payer: 0 VAT', () => expect(invoiceTotals(99, false)).toEqual({ total: 99, vat: 0, net: 99 }));
  it('VAT payer: back-calculates 21%', () => expect(invoiceTotals(121, true)).toEqual({ total: 121, vat: 21, net: 100 }));
  it('CSV includes net and VAT columns', () => {
    const csv = invoicesCsv([{ issue_date: '2026-10-01T10:00:00Z', invoice_number: 'PAD0001', buyer_details: { name: 'Jonas' }, total_amount: 121, amount_without_vat: 100, vat_amount: 21 } as never]);
    expect(csv).toContain('"PAD0001"');
    expect(csv).toContain('121,00;100,00;21,00');
  });
});
