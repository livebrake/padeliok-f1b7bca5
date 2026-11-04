import { SignJWT, jwtVerify } from "jose";
import { z } from 'zod';
import { moneyCents } from '@/lib/payment-money';
import { eventFingerprint, MontonioEventError, orderStatus, refundClaims, refundSnapshot } from '@/lib/montonio-refunds.server';
import { montonioApi } from '@/lib/montonio-environment.server';

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
  const res = await fetch(`${montonioApi()}/stores/payment-methods`, {
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
  const res = await fetch(`${montonioApi()}/orders`, {
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
  const parsed = z.object({ accessKey: z.string(), merchantReference: z.string().min(1).max(200),
    paymentStatus: z.string(), grandTotal: z.number().nonnegative(), uuid: z.string().uuid(),
    currency: z.literal('EUR'), iat: z.number().int().nonnegative(), exp: z.number().int(),
  }).safeParse(payload);
  if (!parsed.success) throw new MontonioEventError('Invalid order claims', 400);
  const p = parsed.data;
  if (p.accessKey !== accessKey || !p.merchantReference) throw new Error("Neteisingas mokėjimo patvirtinimas.");
  const orderNumber = p.merchantReference;
  const status = p.paymentStatus ?? "UNKNOWN";
  if (!orderStatus.safeParse(status).success) {
    console.warn('montonio.unsupported_order_status', { status });
    throw new MontonioEventError('Unsupported order status', 422);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error: orderError } = await supabaseAdmin.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (orderError || !order) throw new MontonioEventError('Order lookup unavailable');
  if (moneyCents(p.grandTotal) !== moneyCents(order.price)) throw new Error("Apmokėta suma nesutampa.");
  if (order.montonio_uuid && order.montonio_uuid !== p.uuid) throw new Error('Neteisingas užsakymo identifikatorius.');

  const eventAt = new Date(p.iat * 1000).toISOString();
  let refunds: Awaited<ReturnType<typeof refundSnapshot>>['rows'] = [];
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    const { snapshot, rows } = await refundSnapshot(p.uuid, await sign({ accessKey }), eventAt);
    if (snapshot.merchantReference !== orderNumber || moneyCents(snapshot.grandTotal) !== moneyCents(order.price)) throw new Error('Refund order mismatch');
    refunds = rows;
  }
  const { data: result, error: recordError } = await supabaseAdmin.rpc('record_montonio_event', {
    order_reference: orderNumber, provider_uuid: p.uuid, new_status: status,
    total_cents: moneyCents(p.grandTotal), occurred_at: eventAt,
    event_key: await eventFingerprint(token), refund_rows: refunds,
  });
   if (recordError) {
     console.error('montonio.payment_reconciliation_failed', {
       orderId: order.id, code: recordError.code, message: recordError.message,
       details: recordError.details, hint: recordError.hint,
     });
     throw new MontonioEventError('Payment reconciliation failed');
   }
  const effective = z.object({ payment_status: z.string() }).parse(result).payment_status;
  if (status !== 'PAID' || effective !== 'PAID') return { orderNumber, status: effective };
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

/** Refund notifications never reissue invoices or send client payment confirmations. */
export async function processRefundToken(token: string) {
  const { accessKey, secret } = keys();
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  const parsed = refundClaims.safeParse(payload);
  if (!parsed.success) {
    console.warn('montonio.unsupported_refund_claims');
    throw new MontonioEventError('Unsupported refund claims', 422);
  }
  const p = parsed.data;
  if (p.accessKey !== accessKey) throw new Error('Invalid access key');
  const eventAt = new Date(p.iat * 1000).toISOString();
  const { snapshot, rows } = await refundSnapshot(p.orderUuid, await sign({ accessKey }), eventAt);
  const row = rows.find(r => r.uuid === p.refundUuid);
  if (!row || row.amount_cents !== moneyCents(p.refundAmount)) throw new MontonioEventError('Refund not yet reconciled');
  // A delayed PENDING token must not regress the authoritative successful refund.
  if (row.status === p.refundStatus) row.description = p.refundStatusDescription ?? null;
  if (p.refundStatus === 'SUCCESSFUL' && row.status !== 'SUCCESSFUL') throw new MontonioEventError('Successful refund not yet reconciled');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.rpc('record_montonio_event', {
    order_reference: snapshot.merchantReference, provider_uuid: p.orderUuid,
    new_status: snapshot.paymentStatus, total_cents: moneyCents(snapshot.grandTotal),
    occurred_at: eventAt, event_key: await eventFingerprint(token), refund_rows: rows,
  });
   if (error) {
     console.error('montonio.refund_reconciliation_failed', {
       refundId: p.refundUuid, code: error.code, message: error.message,
       details: error.details, hint: error.hint,
     });
     throw new MontonioEventError('Refund reconciliation failed');
   }
  console.info('montonio.refund_processed', { refundId: p.refundUuid });
}
