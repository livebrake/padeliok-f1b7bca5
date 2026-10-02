import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PRICES: Record<string, { name: string; price: number }> = {
  bazinis: { name: "Bazinis", price: 49 },
  standartinis: { name: "Standartinis", price: 99 },
  premium: { name: "Premium", price: 199 },
};

const fields = z.object({
  plan: z.string().max(50),
  vardas: z.string().trim().min(1).max(100),
  pavarde: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  tel: z.string().trim().min(5).max(30),
  komentaras: z.string().max(1000).optional().default(""),
});

const MAX = 25 * 1024 * 1024;

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => {
    if (!(data instanceof FormData)) throw new Error("Invalid form data");
    return data;
  })
  .handler(async ({ data }) => {
    const f = fields.parse({
      plan: data.get("plan"), vardas: data.get("vardas"), pavarde: data.get("pavarde"),
      email: data.get("email"), tel: data.get("tel"), komentaras: data.get("komentaras") ?? "",
    });
    const plan = PRICES[f.plan.toLowerCase()];
    if (!plan) throw new Error("Nežinomas planas");
    const files = data.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
    if (files.length > 20 || files.reduce((s, x) => s + x.size, 0) > MAX) throw new Error("Failų dydis viršija 25 MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orderNumber = `PAD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const paths: string[] = [];
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const path = `${orderNumber}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const { error } = await supabaseAdmin.storage.from("order-documents").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw new Error("Nepavyko įkelti failo");
      paths.push(path);
    }
    const { error } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber, plan_id: f.plan.toLowerCase(), plan_name: plan.name, price: plan.price,
      first_name: f.vardas, last_name: f.pavarde, email: f.email, phone: f.tel,
      comment: f.komentaras || null, file_paths: paths,
    });
    if (error) throw new Error("Nepavyko išsaugoti užsakymo");
    return { orderNumber };
  });
