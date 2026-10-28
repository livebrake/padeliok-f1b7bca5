import fonts from '@/assets/invoice/fonts.json';

/** Embedded font bytes avoid authenticated preview URLs and network fetches in callbacks. */
export function invoiceServerFonts() {
  const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return { regular: decode(fonts.regular), bold: decode(fonts.bold) };
}