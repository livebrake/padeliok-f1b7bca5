export type InvoiceSettingsInput = { company_code: string; vat_code: string; bank_iban: string; is_vat_payer: boolean; last_number: string };
export type InvoiceSettingsField = 'company_code' | 'vat_code' | 'bank_iban' | 'last_number';

/** Per-field Lithuanian error messages; empty object when valid. */
export function invoiceSettingsErrors(f: InvoiceSettingsInput): Partial<Record<InvoiceSettingsField, string>> {
  const e: Partial<Record<InvoiceSettingsField, string>> = {};
  if (!/^\d{9}$/.test(f.company_code.trim())) e.company_code = 'Įmonės kodas turi sudaryti 9 skaitmenis';
  if (f.is_vat_payer && !/^LT(\d{9}|\d{12})$/.test(f.vat_code.replace(/\s+/g, '').toUpperCase())) e.vat_code = 'Neteisingas PVM kodo formatas (pvz., LT100000000)';
  if (!/^LT\d{18}$/.test(f.bank_iban.replace(/\s+/g, '').toUpperCase())) e.bank_iban = 'Neteisingas IBAN formatas (pvz., LT123456789012345678)';
  if (!/^\d+$/.test(f.last_number.trim())) e.last_number = 'Skaičius turi būti teigiamas sveikasis skaičius';
  return e;
}

/** Returns the first error message, or null when the settings are valid. */
export function invoiceSettingsError(f: InvoiceSettingsInput): string | null {
  return Object.values(invoiceSettingsErrors(f))[0] ?? null;
}
