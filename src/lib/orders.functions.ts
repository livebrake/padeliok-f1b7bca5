import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PRICES: Record<string, { name: string; price: number }> = {
  bazinis: { name: "Bazinis", price: 49 },
  standartinis: { name: "Standartinis", price: 99 },
  premium: { name: "Premium", price: 199 },
};

const sanitize = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

const fields = z.object({
  plan: z.string().max(50),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
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
      first_name: first, last_name: last, email: f.email, phone: f.phone,
      comment: sanitize(f.komentaras) || null, file_paths: paths,
    });
    if (error) { console.error("db insert failed", error); return { ok: false, code: "database" }; }
    return { ok: true, orderNumber };
  });
