/** Monetary boundaries use cents; accepts Montonio decimal strings and numbers. */
export function moneyCents(value: unknown): number {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Neteisinga pinigų suma.');
  const [whole = '0', fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('Piniginė suma per didelė.');
  return cents;
}