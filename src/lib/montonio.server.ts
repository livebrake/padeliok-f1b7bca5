import { SignJWT, jwtVerify } from "jose";

const API = "https://sandbox-stargate.montonio.com/api";

function keys() {
  const accessKey = process.env["MONTONIO_ACCESS_KEY"];
  const secretKey = process.env["MONTONIO_SECRET_KEY"];
  if (!accessKey || !secretKey) throw new Error("Montonio raktai nesukonfigūruoti.");
  return { accessKey, secret: new TextEncoder().encode(secretKey) };
}

async function sign(payload: Record<string, unknown>) {
  const { secret } = keys();
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret);
}

export type PaymentMethod = { code: string; name: string; logoUrl: string; kind: "bank" | "card" };

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { accessKey } = keys();
  const res = await fetch(`${API}/stores/payment-methods`, {
    headers: { Authorization: `Bearer ${await sign({ accessKey })}` },
  });
  if (!res.ok) throw new Error(`Montonio [${res.status}]: ${await res.text()}`);
  const j = (await res.json()) as {
    paymentMethods: Record<string, { logoUrl?: string; setup?: Record<string, { paymentMethods: { code: string; name: string; logoUrl: string }[] }> }>;
  };
  const banks = (j.paymentMethods["paymentInitiation"]?.setup?.["LT"]?.paymentMethods ?? []).map(
    (m) => ({ code: m.code, name: m.name.replace(/ Lithuania$/, ""), logoUrl: m.logoUrl, kind: "bank" as const }),
  );
  const card = j.paymentMethods["cardPayments"];
  return card ? [...banks, { code: "card", name: "Mokėjimo kortelė", logoUrl: card.logoUrl ?? "", kind: "card" }] : banks;
}

export async function createPayment(o: {
  orderNumber: string; price: number; planName: string; method: string;
  firstName: string; lastName: string; email: string; phone: string; origin: string;
}) {
  const { accessKey } = keys();
  const payment =
    o.method === "card"
      ? { method: "cardPayments", amount: o.price, currency: "EUR" }
      : {
          method: "paymentInitiation", amount: o.price, currency: "EUR",
          methodOptions: { preferredProvider: o.method, preferredCountry: "LT", preferredLocale: "lt", paymentDescription: o.orderNumber },
        };
  const data = await sign({
    accessKey,
    merchantReference: o.orderNumber,
    returnUrl: `${o.origin}/order-success`,
    // Montonio requires a public webhook URL; local dev falls back to the stable preview host.
    notificationUrl: `${/localhost|127\.0\.0\.1/.test(o.origin) ? "https://project--520e88e5-eb85-446d-a690-6d6ae9612c69-dev.lovable.app" : o.origin}/api/public/montonio`,
    currency: "EUR",
    grandTotal: o.price,
    locale: "lt",
    billingAddress: { firstName: o.firstName, lastName: o.lastName, email: o.email, phoneNumber: o.phone },
    lineItems: [{ name: `Planas „${o.planName}“`, quantity: 1, finalPrice: o.price }],
    payment,
  });
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Montonio [${res.status}]: ${await res.text()}`);
  return (await res.json()) as { uuid: string; paymentUrl: string };
}

export type OrderTokenResult = { orderNumber: string; status: string };

/** Verifies a Montonio order token signature and, when PAID, marks the order paid and sends the confirmation once. */
export async function processOrderToken(token: string, origin: string): Promise<OrderTokenResult> {
  const { accessKey, secret } = keys();
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  const p = payload as { accessKey?: string; merchantReference?: string; paymentStatus?: string; grandTotal?: number; uuid?: string };
  if (p.accessKey !== accessKey || !p.merchantReference) throw new Error("Neteisingas mokėjimo patvirtinimas.");
  const orderNumber = p.merchantReference;
  const status = p.paymentStatus ?? "UNKNOWN";
  if (status !== "PAID") return { orderNumber, status };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (!order) throw new Error("Užsakymas nerastas.");
  if (Number(p.grandTotal) !== Number(order.price)) throw new Error("Apmokėta suma nesutampa.");

  if (order.payment_status !== "PAID") {
    await supabaseAdmin.from("orders")
      .update({ payment_status: "PAID", paid_at: new Date().toISOString(), montonio_uuid: p.uuid ?? order.montonio_uuid })
      .eq("id", order.id);
  }
  // Claim the email slot atomically so return page + webhook never double-send.
  const { data: claimed } = await supabaseAdmin.from("orders")
    .update({ payment_email_sent_at: new Date().toISOString() })
    .eq("id", order.id).is("payment_email_sent_at", null).select("id");
  if (claimed?.length) {
    const fileLinks: { name: string; url: string }[] = [];
    for (const fp of order.file_paths) {
      const { data: s } = await supabaseAdmin.storage.from("order-documents").createSignedUrl(fp, 60 * 60 * 24 * 7);
      if (s?.signedUrl) fileLinks.push({ name: fp.split("/").pop()!.slice(9), url: s.signedUrl });
    }
    // Invoice failure must never block payment confirmation; it can be regenerated from the admin panel.
    let invoice: { filename: string; content: string } | null = null;
    try {
      const { data: inv, error } = await supabaseAdmin.rpc("issue_invoice", { order_uuid: order.id });
      if (error || !inv) throw error ?? new Error("no invoice");
      const { renderInvoicePdf, loadInvoiceFonts, toBase64 } = await import("@/lib/invoice-pdf");
      const pdf = await renderInvoicePdf(inv, await loadInvoiceFonts(origin));
      invoice = { filename: `${inv.invoice_number}.pdf`, content: toBase64(pdf) };
    } catch (e) { console.error("invoice generation failed", e); }
    const isCo = order.client_type === "company" || order.client_type === "juridinis";
    const { sendOrderEmails } = await import("@/lib/order-emails.server");
    await sendOrderEmails({
      orderNumber, isCompany: isCo, fullName: order.full_name ?? "", email: order.email, phone: order.phone,
      planName: order.plan_name, price: order.price, projectGoal: order.project_goal ?? "", comment: order.comment ?? "",
      company: isCo ? { company_name: order.company_name ?? "", company_code: order.company_code ?? "", company_address: order.company_address, vat_code: order.vat_code ?? "" } : null,
      fileLinks, invoice,
    });
  }
  return { orderNumber, status: "PAID" };
}
