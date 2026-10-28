import { describe, expect, it } from 'vitest';
import { invoiceSettingsError } from '@/lib/invoice-settings-validation';

const ok = { company_code: '123456789', vat_code: '', bank_iban: 'LT12 3456 7890 1234 5678', is_vat_payer: false, last_number: '0' };

describe('invoice settings validation', () => {
  it('accepts valid settings', () => expect(invoiceSettingsError(ok)).toBeNull());
  it('requires 9-digit company code', () => expect(invoiceSettingsError({ ...ok, company_code: '12345678' })).not.toBeNull());
  it('requires LT VAT code with 9 or 12 digits when VAT payer', () => {
    expect(invoiceSettingsError({ ...ok, is_vat_payer: true, vat_code: 'LT123456789' })).toBeNull();
    expect(invoiceSettingsError({ ...ok, is_vat_payer: true, vat_code: 'LT123456789012' })).toBeNull();
    expect(invoiceSettingsError({ ...ok, is_vat_payer: true, vat_code: 'LT1234567890' })).not.toBeNull();
  });
  it('requires LT IBAN with 18 digits', () => expect(invoiceSettingsError({ ...ok, bank_iban: 'LT1234' })).not.toBeNull());
  it('rejects negative or fractional last number', () => {
    expect(invoiceSettingsError({ ...ok, last_number: '-1' })).not.toBeNull();
    expect(invoiceSettingsError({ ...ok, last_number: '1.5' })).not.toBeNull();
  });
});
