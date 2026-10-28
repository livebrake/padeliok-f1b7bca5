import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Tables } from "@/integrations/supabase/types";

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

export async function loadInvoiceFonts(origin = "") {
  const get = async (f: string) => {
    const response = await fetch(`${origin}/fonts/${f}`);
    if (!response.ok) throw new Error('Nepavyko įkelti sąskaitos šriftų. Bandykite dar kartą.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const [regular, bold] = await Promise.all([get("DejaVuSans.ttf"), get("DejaVuSans-Bold.ttf")]);
  return { regular, bold };
}

export async function renderInvoicePdf(inv: Invoice, fonts: { regular: Uint8Array; bold: Uint8Array }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Sąskaita faktūra ${inv.invoice_number}`);
  const f = await doc.embedFont(fonts.regular, { subset: true });
  const b = await doc.embedFont(fonts.bold, { subset: true });
  const page = doc.addPage([595.28, 841.89]);
  const grey = rgb(0.4, 0.4, 0.4);
  const t = (s: string, x: number, y: number, size = 10, font = f, color = rgb(0.1, 0.1, 0.1)) =>
    page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 10, font = f) => t(s, xr - font.widthOfTextAtSize(s, size), y, size, font);
  const s = inv.seller_details as Party, buyer = inv.buyer_details as Party;
  const vatPayer = Number(inv.vat_rate) > 0;

  t(vatPayer ? "PVM SĄSKAITA FAKTŪRA" : "SĄSKAITA FAKTŪRA", 50, 780, 18, b);
  t(`Serija ir Nr.: ${inv.invoice_number}`, 50, 756, 11);
  t(`Išrašymo data: ${ltDate(inv.issue_date)}`, 50, 740, 11);
  if (buyer.order_number) t(`Užsakymo Nr.: ${buyer.order_number}`, 50, 724, 11);

  const block = (title: string, lines: string[], x: number) => {
    t(title, x, 680, 11, b);
    lines.filter(Boolean).forEach((l, i) => t(l, x, 662 - i * 15, 9.5));
  };
  block("Pardavėjas", [
    String(s.company_name || "—"), s.company_code ? `Įmonės kodas: ${s.company_code}` : "",
    s.vat_code ? `PVM kodas: ${s.vat_code}` : "", String(s.company_address || ""),
    s.bank_name ? `Bankas: ${s.bank_name}` : "", s.bank_iban ? `A. s.: ${s.bank_iban}` : "",
  ], 50);
  block("Pirkėjas", [
    String(buyer.name || "—"), buyer.is_company && buyer.company_code ? `Įmonės kodas: ${buyer.company_code}` : "",
    buyer.is_company && buyer.vat_code ? `PVM kodas: ${buyer.vat_code}` : "", String(buyer.address || ""),
    String(buyer.email || ""), String(buyer.phone || ""),
  ], 310);

  const y0 = 540;
  page.drawRectangle({ x: 50, y: y0 - 6, width: 495, height: 22, color: rgb(0.94, 0.94, 0.94) });
  t("Pavadinimas", 58, y0, 9.5, b); right("Kiekis", 330, y0, 9.5, b); right("Kaina be PVM", 430, y0, 9.5, b); right("Suma be PVM", 537, y0, 9.5, b);
  const net = Number(inv.amount_without_vat), vat = Number(inv.vat_amount), total = Number(inv.total_amount);
  t(inv.line_item, 58, y0 - 26); right("1 vnt.", 330, y0 - 26); right(eur(net), 430, y0 - 26); right(eur(net), 537, y0 - 26);
  page.drawLine({ start: { x: 50, y: y0 - 38 }, end: { x: 545, y: y0 - 38 }, thickness: 0.5, color: grey });

  let y = y0 - 62;
  const sum = (k: string, v: string, bold = false) => { right(k, 430, y, 10, bold ? b : f); right(v, 537, y, 10, bold ? b : f); y -= 18; };
  sum("Suma be PVM:", eur(net));
  sum(`PVM (${vatPayer ? "21" : "0"} %):`, eur(vat));
  sum("Iš viso mokėti:", eur(total), true);
  if (!vatPayer) t(NON_VAT_NOTE, 50, y - 12, 9, f, grey);
  t("Apmokėta per Montonio mokėjimų sistemą.", 50, y - 30, 9, f, grey);
  t("Sąskaita sugeneruota elektroniniu būdu ir galioja be parašo.", 50, 60, 8.5, f, grey);
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
