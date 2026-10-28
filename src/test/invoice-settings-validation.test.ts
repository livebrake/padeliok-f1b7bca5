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

import { invoiceSettingsErrors } from '@/lib/invoice-settings-validation';
describe('inline field errors', () => {
  it('maps each invalid field to its message', () => {
    const e = invoiceSettingsErrors({ company_code: '1', vat_code: 'X', bank_iban: 'LT1', is_vat_payer: true, last_number: '-1' });
    expect(e.company_code).toBe('Įmonės kodas turi sudaryti 9 skaitmenis');
    expect(e.vat_code).toBe('Neteisingas PVM kodo formatas (pvz., LT100000000)');
    expect(e.bank_iban).toBe('Neteisingas IBAN formatas (pvz., LT123456789012345678)');
    expect(e.last_number).toBe('Skaičius turi būti teigiamas sveikasis skaičius');
  });
  it('ignores VAT code when not a VAT payer', () => expect(invoiceSettingsErrors({ ...ok, vat_code: 'bad' }).vat_code).toBeUndefined());
});
