import { invoiceDesignAssets } from '@/lib/invoice-design';

/** Embedded font bytes avoid authenticated preview URLs and network fetches in callbacks. */
export function invoiceServerFonts() {
  return invoiceDesignAssets();
}