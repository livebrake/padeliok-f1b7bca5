import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const fields = z.object({
  plan: z.string().max(50),
  fullName: z.string().trim().min(1).max(120).refine((v) => !/\d/.test(v)),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(1).max(30).refine((v) => normalizePhone(v) !== null),
  komentaras: z.string().max(1000).optional().default(""),
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
    const parsed = fields.safeParse({
      plan: data.get("plan"), fullName: data.get("fullName"), email: data.get("email"),
      phone: data.get("phone"), komentaras: data.get("komentaras") ?? "",
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
      if (name.length < 2 || !/^(\d{7}|\d{9})$/.test(code) || !/\d/.test(addr) || addr.length < 5) return { ok: false, code: "validation" };
      if (!noVat && !/^LT(\d{9}|\d{12})$/.test(vat)) return { ok: false, code: "validation" };
      company = { company_name: name, company_code: code, company_address: addr, vat_code: noVat ? "Ne PVM mokėtojas" : vat };
    }
    const plan = PRICES[f.plan.toLowerCase()];
    if (!plan) return { ok: false, code: "validation" };
    const files = data.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
    if (!files.length || files.length > 20 || files.some((x) => x.size > MAX_FILE || !EXT.test(x.name)))
      return { ok: false, code: "validation" };

    const name = sanitize(f.fullName).split(/\s+/);
    const first = name.shift() ?? "";
    const last = name.join(" ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orderNumber = `PAD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
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
    const { error } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber, plan_id: f.plan.toLowerCase(), plan_name: plan.name, price: plan.price,
      first_name: first, last_name: last, email: f.email, phone: normalizePhone(f.phone)!,
      comment: sanitize(f.komentaras) || null, file_paths: paths,
      client_type: isCo ? "juridinis" : "fizinis",
      ...(company ?? {}), contact_person: isCo ? sanitize(f.fullName) : null,
    });
    if (error) { console.error("db insert failed", error); return { ok: false, code: "database" }; }
    return { ok: true, orderNumber };
  });
