import design from '@/assets/invoice/design.json';

const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export function invoiceDesignAssets() {
  return { regular: decode(design.regular), bold: decode(design.bold), mono: decode(design.mono), logo: decode(design.logo) };
}