import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validateCheckout } from "@/lib/order-validation";

const PRICES: Record<string, { name: string; price: number }> = {
  bazinis: { name: "Bazinis", price: 49 },
  standartinis: { name: "Standartinis", price: 99 },
  premium: { name: "Premium", price: 199 },
};

const sanitize = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

const normalizePhone = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) return null; // senasis „8“ prefiksas nebenaudojamas
  const national = digits.startsWith("370") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^6\d{7}$/.test(national) ? `+370${national}` : null;
};

const PROJECT_GOALS = [
  "Keisti sklypo paskirtį",
  "Statyti vienbutį / dvibutį",
  "Statyti daugiabutį",
  "Statyti komercines patalpas",
  "Kita",
] as const;

const fields = z.object({
  plan: z.string().max(50),
  fullName: z.string().trim().min(1).max(120).refine((v) => !/\d/.test(v)),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(1).max(30).refine((v) => normalizePhone(v) !== null),
  projectGoal: z.enum(PROJECT_GOALS, { message: "Pasirinkite, ką planuojate." }),
  komentaras: z.string().trim().min(1, "Aprašymas būtinas.").max(1000),
});

const MAX_FILE = 20 * 1024 * 1024;
const EXT = /\.(pdf|png|jpe?g|docx)$/i;

export type SubmitResult =
  | { ok: true; orderNumber: string }
  | { ok: false; code: "validation" | "storage" | "database" };

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => {
    if (!(data instanceof FormData)) throw new Error("Invalid form data");
    return data;
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    const filesToValidate = data.getAll("files").filter((value): value is File => value instanceof File);
    if (Object.keys(validateCheckout(Object.fromEntries(data), filesToValidate)).length)
      return { ok: false, code: "validation" };
    const parsed = fields.safeParse({
      plan: data.get("plan"), fullName: data.get("fullName"), email: data.get("email"),
      phone: data.get("phone"), projectGoal: data.get("projectGoal"),
      komentaras: String(data.get("komentaras") ?? "").trim(),
    });
    if (!parsed.success) return { ok: false, code: "validation" };
    const f = parsed.data;
    const isCo = data.get("clientType") === "juridinis";
    if (!isCo && f.fullName.split(/\s+/).length < 2) return { ok: false, code: "validation" };
    const noVat = data.get("noVat") === "1";
    const str = (k: string) => sanitize(String(data.get(k) ?? "")).replace(/\s+/g, " ");
    let company: { company_name: string; company_code: string; company_address: string; vat_code: string } | null = null;
    if (isCo) {
      const name = str("companyName").slice(0, 200);
      const code = str("companyCode").replace(/\s/g, "");
      const addr = str("companyAddress").slice(0, 300);
      const vat = str("vatCode").replace(/\s/g, "").toUpperCase();
      if (name.length < 2 || !/^\d{9}$/.test(code) || !/\d/.test(addr) || addr.length < 5) return { ok: false, code: "validation" };
      if (!noVat && !/^LT(\d{9}|\d{12})$/.test(vat)) return { ok: false, code: "validation" };
      company = { company_name: name, company_code: code, company_address: addr, vat_code: noVat ? "Ne PVM mokėtojas" : vat };
    }
    const plan = PRICES[f.plan.toLowerCase()];
    if (!plan) return { ok: false, code: "validation" };
    const comment = sanitize(f.komentaras);
    if (!comment) return { ok: false, code: "validation" };
    const files = data.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
    if (!files.length || files.length > 20 || files.some((x) => x.size > MAX_FILE || !EXT.test(x.name)))
      return { ok: false, code: "validation" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: seq } = await supabaseAdmin.rpc("next_order_number");
    const orderNumber = seq ?? `PAD-${Date.now().toString().slice(-6)}`;
    const paths: string[] = [];
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const path = `${orderNumber}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const { error } = await supabaseAdmin.storage.from("order-documents").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) { console.error("storage upload failed", error); return { ok: false, code: "storage" }; }
      paths.push(path);
    }
    const fullName = sanitize(f.fullName);
    const phone = normalizePhone(f.phone);
    if (!phone) return { ok: false, code: "validation" };
    const { error } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber,
      full_name: fullName,
      email: f.email,
      phone,
      plan_name: plan.name,
      price: plan.price,
      status: "Naujas",
      payment_status: "Laukia apmokėjimo",
      client_type: isCo ? "company" : "private",
      company_name: company?.company_name ?? null,
      company_code: company?.company_code ?? null,
      company_address: company?.company_address ?? null,
      vat_code: company?.vat_code ?? null,
      contact_person: isCo ? fullName : null,
      project_goal: f.projectGoal,
      comment,
      file_paths: paths,
    });
    if (error) { console.error("db insert failed", error); return { ok: false, code: "database" }; }
    return { ok: true, orderNumber };
  });
