import { describe, expect, it } from 'vitest';
import { fillTemplate, isRetentionExpired, reportVars } from '@/lib/report-email';
import { FILE_EXT } from '@/lib/order-validation';

describe('report email', () => {
  it('fills company name and order number', () => {
    const v = reportVars({ company_name: 'MB AA Namai', contact_person: 'Algirdas V', order_number: 'PAD-1027', plan_name: 'Standartinis' });
    expect(fillTemplate('Sveiki, {{vardas}} #{{uzsakymo_numeris}}', v)).toBe('Sveiki, MB AA Namai #PAD-1027');
  });
  it('greets private client by first name', () => {
    expect(reportVars({ full_name: 'Jonas Jonaitis', order_number: 1 }).vardas).toBe('Jonas');
  });
  it('expires documents after 6 months', () => {
    const now = new Date('2026-11-25T12:00:00Z');
    expect(isRetentionExpired('2026-05-24T12:00:00Z', now)).toBe(true);
    expect(isRetentionExpired('2026-06-26T12:00:00Z', now)).toBe(false);
  });
  it('rejects DOCX uploads', () => { expect(FILE_EXT.test('a.docx')).toBe(false); expect(FILE_EXT.test('a.pdf')).toBe(true); });
});
