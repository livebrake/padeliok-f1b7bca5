import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Tables } from "@/integrations/supabase/types";
import { invoiceDesignAssets } from '@/lib/invoice-design';

export type Invoice = Tables<"invoices">;
type V = string | boolean | null | undefined;
type Party = { name?: V; company_name?: V; company_code?: V; vat_code?: V; company_address?: V; address?: V; bank_name?: V; bank_iban?: V; email?: V; phone?: V; order_number?: V; is_company?: V };

export const NON_VAT_NOTE = "PVM neskaičiuojamas remiantis LR PVM įstatymo nuostatomis (Ne PVM mokėtojas)";
export const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;
export const formatInvoiceNumber = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, "0")}`;
export const ltDate = (d: string) => new Date(d).toLocaleDateString("lt-LT", { timeZone: "Europe/Vilnius" });

/** Splits a VAT-inclusive total into net + 21% VAT (back-calculated) or 0% for non-VAT payers. */
export function invoiceTotals(total: number, vatPayer: boolean) {
  const t = Math.round(total * 100) / 100;
  const vat = vatPayer ? Math.round((t * 21) / 121 * 100) / 100 : 0;
  return { total: t, vat, net: Math.round((t - vat) * 100) / 100 };
}

export async function loadInvoiceFonts() {
  return invoiceDesignAssets();
}

export async function renderInvoicePdf(inv: Invoice, fonts: { regular: Uint8Array; bold: Uint8Array; mono?: Uint8Array; logo?: Uint8Array }) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date(inv.issue_date));
  doc.setModificationDate(new Date(inv.issue_date));
  doc.registerFontkit(fontkit);
  doc.setTitle(`Sąskaita faktūra ${inv.invoice_number}`);
  const f = await doc.embedFont(fonts.regular, { subset: true });
  const b = await doc.embedFont(fonts.bold, { subset: true });
  const assets = invoiceDesignAssets();
  const mono = await doc.embedFont(fonts.mono ?? assets.mono, { subset: true });
  const logo = await doc.embedPng(fonts.logo ?? assets.logo);
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.035, 0.035, 0.043), grey = rgb(0.443, 0.443, 0.478), border = rgb(0.894, 0.894, 0.906);
  const t = (s: string, x: number, y: number, size = 10, font = f, color = ink) =>
    page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 10, font = f) => t(s, xr - font.widthOfTextAtSize(s, size), y, size, font);
  const s = inv.seller_details as Party, buyer = inv.buyer_details as Party;
  const vatPayer = Number(inv.vat_rate) > 0;

  const line = (y: number, color = border, x = 36, end = 559) => page.drawLine({ start: { x, y }, end: { x: end, y }, thickness: 0.6, color });
  // Wrap even unbroken names/addresses, keeping both party columns and table cells separate.
  const wrap = (text: string, width: number, font = f, size = 9) => {
    const lines: string[] = []; let current = '';
    for (const char of text.replace(/\r/g, '')) {
      if (char === '\n' || font.widthOfTextAtSize(current + char, size) > width) {
        lines.push(current.trim()); current = char === '\n' ? '' : char;
      } else current += char;
    }
    if (current) lines.push(current.trim());
    return lines;
  };
  page.drawImage(logo, { x: 36, y: 774, width: 27 * logo.width / logo.height, height: 27 });
  right(vatPayer ? 'PVM SĄSKAITA FAKTŪRA' : 'SĄSKAITA FAKTŪRA', 559, 786, 12, b);
  line(757); line(706);
  const meta = (label: string, value: string, x: number) => { t(label, x, 739, 7.5, f, grey); t(value, x, 721, 11, mono); };
  meta('SERIJA IR NR.', inv.invoice_number, 36);
  meta('IŠRAŠYMO DATA', ltDate(inv.issue_date), 211);
  meta('UŽSAKYMO NR.', String(buyer.order_number || '—'), 390);
  const block = (title: string, name: string, lines: string[], x: number) => {
    t(title, x, 677, 7.5, f, grey); let y = 659;
    for (const l of wrap(name, 242, b, 10.5)) { t(l, x, y, 10.5, b); y -= 14; }
    y -= 3;
    for (const value of lines.filter(Boolean)) for (const l of wrap(value, 242)) { t(l, x, y, 9); y -= 13; }
    return y;
  };
  const sellerBottom = block('PARDAVĖJAS', String(s.company_name || '—'), [
    s.company_code ? `Įm. k. ${s.company_code}` : '', s.vat_code ? `PVM kodas: ${s.vat_code}` : '', String(s.company_address || ''),
    s.bank_name ? `Bankas: ${s.bank_name}` : '', s.bank_iban ? `A. s. ${s.bank_iban}` : '',
  ], 36);
  const buyerBottom = block('PIRKĖJAS', String(buyer.name || '—'), [
    buyer.is_company && buyer.company_code ? `Įm. k. ${buyer.company_code}` : '',
    buyer.is_company && buyer.vat_code ? `PVM kodas: ${buyer.vat_code}` : '', String(buyer.address || ''), String(buyer.email || ''), String(buyer.phone || ''),
  ], 310);
  const y0 = Math.min(sellerBottom, buyerBottom) - 30;
  t('PAVADINIMAS', 36, y0, 7.5, f, grey); right('KIEKIS', 355, y0, 7.5); right('KAINA BE PVM', 457, y0, 7.5); right('SUMA BE PVM', 559, y0, 7.5);
  line(y0 - 10, ink);
  const net = Number(inv.amount_without_vat), vat = Number(inv.vat_amount), total = Number(inv.total_amount);
  const itemLines = wrap(inv.line_item, 260);
  itemLines.forEach((l, i) => t(l, 36, y0 - 29 - i * 13, 9));
  right('1 vnt.', 355, y0 - 29, 9, mono); right(eur(net), 457, y0 - 29, 9, mono); right(eur(net), 559, y0 - 29, 9, mono);
  const rowBottom = y0 - 43 - Math.max(0, itemLines.length - 1) * 13;
  line(rowBottom);
  let y = rowBottom - 28;
  const sum = (k: string, v: string) => { t(k, 350, y, 9, f, grey); right(v, 559, y, 9, mono); y -= 19; };
  sum('Suma be PVM:', eur(net)); sum(`PVM (${inv.vat_rate} %):`, eur(vat));
  line(y + 6, ink, 350); y -= 13;
  t('Iš viso mokėti:', 350, y, 11, b); right(eur(total), 559, y, 11, mono);
  y -= 37;
  if (!vatPayer) for (const l of wrap(NON_VAT_NOTE, 523, f, 8)) { t(l, 36, y, 8, f, grey); y -= 12; }
  t('Apmokėta per Montonio mokėjimų sistemą.', 36, y, 8, f, grey);
  const footerY = Math.min(y - 38, 160);
  line(footerY);
  t('padeliok.lt', 36, footerY - 20, 8.5, b);
  right('Sąskaita sugeneruota elektroniniu būdu ir galioja be parašo.', 559, footerY - 20, 8);
  return doc.save();
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Accounting CSV (semicolon-separated, Excel-friendly with BOM). */
export function invoicesCsv(rows: Invoice[]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const n = (v: unknown) => Number(v).toFixed(2).replace(".", ",");
  const lines = [["Data", "Sąskaitos Nr.", "Pirkėjas", "Įmonės kodas", "PVM kodas", "Adresas", "El. paštas", "Suma su PVM", "Suma be PVM", "PVM"].map(q).join(";")];
  for (const r of rows) {
    const bd = r.buyer_details as Party;
    lines.push([ltDate(r.issue_date), r.invoice_number, bd.name, bd.company_code, bd.vat_code, bd.address, bd.email].map(q)
      .concat([n(r.total_amount), n(r.amount_without_vat), n(r.vat_amount)]).join(";"));
  }
  return "\uFEFF" + lines.join("\r\n");
}
