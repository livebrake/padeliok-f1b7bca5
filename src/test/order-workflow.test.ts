import { describe, expect, it } from 'vitest';
import { needsReopeningReason, validateStatusChange, validateReportResend, reportSendKey } from '@/lib/order-workflow';

describe('completed order safeguards', () => {
  it('requires a nonempty reason for every exit from Atlikta', () => {
    for (const next of ['Naujas', 'Vykdoma', 'Atšaukta']) {
      expect(needsReopeningReason('Atlikta', next)).toBe(true);
      expect(() => validateStatusChange('Atlikta', next, '  ')).toThrow();
    }
  });
  it('accepts one character rather than requiring five', () => {
    expect(() => validateStatusChange('Atlikta', 'Vykdoma', 'a')).not.toThrow();
  });
  it('does not require a reason when retaining Atlikta', () => {
    expect(() => validateStatusChange('Atlikta', 'Atlikta')).not.toThrow();
  });
  it('requires explicit repeat-send confirmation', () => {
    expect(() => validateReportResend('2026-11-25T16:40:00Z', '2026-11-25T16:40:00Z', false)).toThrow();
    expect(() => validateReportResend('2026-11-25T16:40:00Z', '2026-11-25T16:40:00Z', true)).not.toThrow();
  });
  it('rejects stale dialogs even when repeat-send is confirmed', () => {
    expect(() => validateReportResend('2026-11-26T09:00:00Z', null, true)).toThrow();
  });
  it('uses the same provider key for concurrent first-send requests and a new key for intentional resends', () => {
    expect(reportSendKey('PAD-1027', null)).toBe('report-PAD-1027-first');
    expect(reportSendKey('PAD-1027', '2026-11-25T16:40:00Z')).not.toBe(reportSendKey('PAD-1027', null));
  });
});