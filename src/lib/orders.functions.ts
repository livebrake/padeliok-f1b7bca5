import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { validateCheckout, normalizePhone, FILE_EXT } from "@/lib/order-validation";
import { applyPromo, normalizeCode, type PromoResult } from "@/lib/promo";

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
async function resolvePromo(admin: AdminClient, rawCode: string, planKey: string, price: number) {
  const code = normalizeCode(rawCode);
  const { data: row } = await admin.from("promo_codes").select("*").eq("code", code).maybeSingle();
  if (!row) return { row: null, result: { ok: false, message: "Nuolaidos kodas negalioja." } as PromoResult };
  const { count } = await admin.from("orders").select("id", { count: "exact", head: true })
    .eq("promo_code_id", row.id).eq("payment_status", "PAID");
  return { row, result: applyPromo(row, planKey, price, count ?? 0) };
}

/** Public preview of a promo code; never reveals code details beyond the discount label. */
export const checkPromo = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; plan: string }) => z.object({ code: z.string().max(60), plan: z.string().max(50) }).parse(d))
  .handler(async ({ data }): Promise<PromoResult> => {
    if (!normalizeCode(data.code)) return { ok: false, message: "Įveskite nuolaidos kodą." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pr } = await supabaseAdmin.from("plan_prices").select("price").eq("plan_key", data.plan.toLowerCase()).maybeSingle();
    if (!pr) return { ok: false, message: "Nepasirinktas planas." };
    return (await resolvePromo(supabaseAdmin, data.code, data.plan, Number(pr.price))).result;
  });

// Allowed plan keys only; actual prices live in the plan_prices table.
const PRICES: Record<string, true> = { bazinis: true, standartinis: true, premium: true };

const sanitize = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

const PROJECT_GOALS = [
  "Keisti sklypo paskirtį",
  "Statyti vienbutį / dvibutį",
  "Statyti daugiabutį",
  "Statyti komercines patalpas",
  "Kita",
] as const;

// Files are uploaded straight from the browser into the storage `incoming/` folder;
// only their paths travel in this payload, so large attachments never hit the
// serverless request body limit.
const payload = z.object({
  plan: z.string().max(50),
  clientType: z.enum(["fizinis", "juridinis"]),
  fullName: z.string().trim().max(120),
  email: z.string().trim().max(255),
  phone: z.string().trim().max(30),
  projectGoal: z.string().max(120),
  komentaras: z.string().trim().max(1000),
  companyName: z.string().trim().max(200).default(""),
  companyCode: z.string().trim().max(20).default(""),
  companyAddress: z.string().trim().max(300).default(""),
  vatCode: z.string().trim().max(20).default(""),
  noVat: z.boolean().default(false),
  agreement: z.string().max(5).default("0"),
  filePaths: z.array(z.string().max(300)).max(5).default([]),
  paymentMethod: z.string().trim().min(1).max(40),
  promoCode: z.string().max(60).default(""),
});

export type SubmitResult =
  | { ok: true; orderNumber: string; paymentUrl: string }
  | { ok: false; code: "validation" | "storage" | "database" | "payment"; message: string };

const invalid = (message: string): SubmitResult => ({ ok: false, code: "validation", message });

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => data)
  .handler(async ({ data }): Promise<SubmitResult> => {
    const parsed = payload.safeParse(data);
    if (!parsed.success) return invalid("Neteisingi užsakymo duomenys.");
    const v = parsed.data;
    const isCo = v.clientType === "juridinis";

    // Shared eligibility rules — the same browser-safe module the form uses.
    const fileMeta = v.filePaths.map((p) => ({ name: p.split("/").pop() ?? p, size: 1 }));
    const errs = validateCheckout({ ...v, noVat: v.noVat ? "1" : "0" }, fileMeta);
    if (Object.keys(errs).length) return invalid(Object.values(errs)[0]!);

    if (!isCo && v.fullName.split(/\s+/).length < 2)
      return invalid("Prašome įrašyti ir pavardę (mažiausiai du žodžius).");
    const phone = normalizePhone(v.phone);
    if (!phone) return invalid("Įveskite teisingą telefono numerį (pvz., +370 600 00000 arba 0 600 00000).");
    if (!PROJECT_GOALS.includes(v.projectGoal as (typeof PROJECT_GOALS)[number]))
      return invalid("Pasirinkite, ką planuojate.");

    let company: { company_name: string; company_code: string; company_address: string | null; vat_code: string } | null = null;
    if (isCo) {
      const name = sanitize(v.companyName).replace(/\s+/g, " ").slice(0, 200);
      const code = v.companyCode.replace(/\s/g, "");
      const addr = sanitize(v.companyAddress).replace(/\s+/g, " ").slice(0, 300);
      const vat = v.vatCode.replace(/\s/g, "").toUpperCase();
      if (name.length < 2 || !/^\d{9}$/.test(code))
        return invalid("Patikrinkite įmonės pavadinimą ir įmonės kodą (9 skaitmenys).");
      if (addr && (!/\d/.test(addr) || addr.length < 5))
        return invalid("Nurodykite gatvę, namo numerį ir miestą (pvz., Gedimino pr. 1, Vilnius).");
      if (!v.noVat && !/^LT(\d{9}|\d{12})$/.test(vat))
        return invalid("PVM kodas turi prasidėti „LT“ ir turėti 9 arba 12 skaitmenų (pvz., LT123456789).");
      company = { company_name: name, company_code: code, company_address: addr || null, vat_code: v.noVat ? "Ne PVM mokėtojas" : vat };
    }
    if (!PRICES[v.plan.toLowerCase()]) return invalid("Nepasirinktas planas.");
    const comment = sanitize(v.komentaras);
    if (!comment) return invalid("Aprašykite savo užduotį – šis laukas būtinas.");

    // Only paths the browser uploaded into incoming/ are accepted; the move below
    // also proves each file actually exists in storage.
    if (v.filePaths.some((p) => !/^incoming\/[a-zA-Z0-9._-]+$/.test(p) || !FILE_EXT.test(p)))
      return invalid("Neteisinga įkelto failo nuoroda. Įkelkite failus iš naujo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Price always comes from the database so admin price changes apply to checkout and Montonio.
    const { data: priceRow } = await supabaseAdmin
      .from("plan_prices").select("name, price").eq("plan_key", v.plan.toLowerCase()).maybeSingle();
    const plan = priceRow ? { name: priceRow.name, price: Number(priceRow.price) } : null;
    if (!plan || !(plan.price > 0)) return invalid("Nepavyko nustatyti plano kainos. Bandykite dar kartą.");
    // Discount is recomputed server-side; the order keeps a snapshot so later code edits never change history.
    let promo: { id: string; code: string; label: string; discount: number; final: number } | null = null;
    if (normalizeCode(v.promoCode)) {
      const { row, result } = await resolvePromo(supabaseAdmin, v.promoCode, v.plan, plan.price);
      if (!result.ok || !row) return invalid(result.ok ? "Nuolaidos kodas negalioja." : result.message);
      promo = { id: row.id, code: row.code, label: result.label, discount: result.discount, final: result.final };
    }
    const charged = promo ? promo.final : plan.price;
    const { data: seq } = await supabaseAdmin.rpc("next_order_number");
    const orderNumber = seq ?? `PAD-${Date.now().toString().slice(-6)}`;

    const finalPaths: string[] = [];
    for (const p of v.filePaths) {
      const dest = `${orderNumber}/${p.slice("incoming/".length)}`;
      const { error } = await supabaseAdmin.storage.from("order-documents").move(p, dest);
      if (error) {
        console.error("storage move failed", error);
        return { ok: false, code: "storage", message: `Nepavyko apdoroti įkelto failo: ${error.message}` };
      }
      finalPaths.push(dest);
    }

    const fullName = sanitize(v.fullName);
    const { error } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber,
      full_name: fullName,
      email: v.email,
      phone,
      plan_name: plan.name,
      price: charged,
      original_price: plan.price,
      discount_amount: promo?.discount ?? 0,
      promo_code: promo?.code ?? null,
      promo_code_id: promo?.id ?? null,
      discount_label: promo?.label ?? null,
      status: "Naujas",
      payment_status: "PENDING",
      payment_method: v.paymentMethod,
      client_type: isCo ? "company" : "private",
      company_name: company?.company_name ?? null,
      company_code: company?.company_code ?? null,
      company_address: company?.company_address ?? null,
      vat_code: company?.vat_code ?? null,
      contact_person: isCo ? fullName || null : null,
      project_goal: v.projectGoal,
      comment,
      file_paths: finalPaths,
    });
    if (error) {
      console.error("db insert failed", error);
      return { ok: false, code: "database", message: `Nepavyko išsaugoti užsakymo: ${error.message}` };
    }

    // Emails are sent only after Montonio confirms the payment (see montonio.server.ts).
    const [firstName, ...rest] = (fullName || company?.company_name || "Klientas").split(/\s+/);
    try {
      const { createPayment } = await import("@/lib/montonio.server");
      const pay = await createPayment({
        orderNumber, price: charged, planName: plan.name, method: v.paymentMethod,
        firstName: firstName!, lastName: rest.join(" ") || firstName!, email: v.email, phone,
        origin: new URL(getRequest().url).origin,
      });
      await supabaseAdmin.from("orders").update({ montonio_uuid: pay.uuid }).eq("order_number", orderNumber);
      return { ok: true, orderNumber, paymentUrl: pay.paymentUrl };
    } catch (e) {
      console.error("montonio create failed", e);
      return { ok: false, code: "payment", message: `Nepavyko inicijuoti mokėjimo: ${e instanceof Error ? e.message : "nežinoma klaida"}` };
    }
  });
