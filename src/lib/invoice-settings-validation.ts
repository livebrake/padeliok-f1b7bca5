export type InvoiceSettingsInput = { company_code: string; vat_code: string; bank_iban: string; is_vat_payer: boolean; last_number: string };

/** Returns a Lithuanian error message, or null when the settings are valid. */
export function invoiceSettingsError(f: InvoiceSettingsInput): string | null {
  if (!/^\d{9}$/.test(f.company_code.trim())) return 'Įmonės kodas turi būti sudarytas iš 9 skaitmenų.';
  if (f.is_vat_payer && !/^LT(\d{9}|\d{12})$/.test(f.vat_code.replace(/\s+/g, '').toUpperCase())) return 'PVM kodas turi prasidėti „LT“ ir turėti 9 arba 12 skaitmenų.';
  if (!/^LT\d{18}$/.test(f.bank_iban.replace(/\s+/g, '').toUpperCase())) return 'IBAN turi būti formatu LT ir 18 skaitmenų.';
  if (!/^\d+$/.test(f.last_number.trim())) return 'Paskutinis numeris turi būti sveikasis skaičius (0 ar daugiau).';
  return null;
}
