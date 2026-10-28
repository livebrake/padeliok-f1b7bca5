import { loadInvoiceFonts, renderInvoicePdf, type Invoice } from '@/lib/invoice-pdf';

let fonts: ReturnType<typeof loadInvoiceFonts> | null = null;
export const invoicePdfBlob = async (inv: Invoice) => {
  fonts ??= loadInvoiceFonts();
  let bytes: Uint8Array;
  try { bytes = await renderInvoicePdf(inv, await fonts); }
  catch (error) { fonts = null; throw error; }
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
