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

export type OrderTokenResult = { orderNumber: string; status: string; fulfillment?: 'complete' | 'pending' };

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
  const { data: order, error: orderError } = await supabaseAdmin.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (orderError || !order) throw orderError ?? new Error("Užsakymas nerastas.");
  if (Number(p.grandTotal) !== Number(order.price)) throw new Error("Apmokėta suma nesutampa.");

  if (order.payment_status !== "PAID") {
    const { error } = await supabaseAdmin.from("orders")
      .update({ payment_status: "PAID", paid_at: new Date().toISOString(), montonio_uuid: p.uuid ?? order.montonio_uuid })
      .eq("id", order.id);
    if (error) throw error;
    console.info('montonio.payment_paid', { orderId: order.id, paymentStatus: 'PAID' });
  } else {
    console.info('montonio.payment_already_paid', { orderId: order.id });
  }
  try {
    const { fulfillPaidOrder } = await import('@/lib/paid-order.server');
    await fulfillPaidOrder(order.id);
  } catch (error) {
    console.error('paid order fulfillment failed', { orderId: order.id, error });
    // Payment remains verified; the webhook gets a retryable response, not a false unpaid result.
    return { orderNumber, status: 'PAID', fulfillment: 'pending' };
  }
  return { orderNumber, status: "PAID", fulfillment: 'complete' };
}
