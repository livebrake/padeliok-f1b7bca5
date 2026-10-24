import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOrderEmails } from "@/lib/order-emails.server";

export type MontonioConfig = { accessKey: string; secretKey: string };
const API = "https://sandbox-stargate.montonio.com/api";
const claimsSchema = z.object({
  uuid: z.string().uuid(), accessKey: z.string(), merchantReference: z.string(),
  paymentStatus: z.string(), grandTotal: z.coerce.number().positive(), currency: z.string(),
});
const remoteSchema = claimsSchema.omit({ accessKey: true }).extend({ paymentUrl: z.string().url().optional() });

async function sign(data: Record<string, unknown>, config: MontonioConfig, expiration = "10m") {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt().setExpirationTime(expiration).sign(new TextEncoder().encode(config.secretKey));
}

export async function verifyOrderToken(token: string, config: MontonioConfig) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.secretKey), { algorithms: ["HS256"] });
  const claims = claimsSchema.parse(payload);
  if (claims.accessKey !== config.accessKey) throw new Error("Neteisinga mokėjimo parduotuvė.");
  return claims;
}

async function retryReference(token: string, config: MontonioConfig) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.secretKey), {
    algorithms: ["HS256"], audience: "padeliok-payment-retry",
  });
  return z.object({ reference: z.string().regex(/^PAD-\d+$/) }).parse(payload).reference;
}

async function requestOrder(uuid: string, config: MontonioConfig) {
  const token = await sign({ accessKey: config.accessKey }, config);
  const res = await fetch(`${API}/orders/${uuid}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Montonio mokėjimo patikrinimas nepavyko (${res.status}).`);
  return remoteSchema.parse(await res.json());
}

export function paymentMatches(order: { order_number: string; price: number; montonio_uuid: string | null },
  remote: { uuid: string; merchantReference: string; grandTotal: number; currency: string }) {
  return order.montonio_uuid === remote.uuid && order.order_number === remote.merchantReference
    && remote.currency === "EUR" && Math.round(Number(order.price) * 100) === Math.round(remote.grandTotal * 100);
}

async function findOrder(reference: string) {
  const { data, error } = await supabaseAdmin.from("orders").select("*").eq("order_number", reference).single();
  if (error || !data) throw new Error("Užsakymas nerastas.");
  return data;
}

async function confirmPaid(order: Awaited<ReturnType<typeof findOrder>>) {
  // Conditional update makes return + webhook processing safe to repeat.
  const { error } = await supabaseAdmin.from("orders").update({ status: "PAID", payment_status: "PAID" })
    .eq("id", order.id).neq("payment_status", "PAID");
  if (error) throw new Error("Nepavyko išsaugoti mokėjimo patvirtinimo.");
  if (order.payment_email_sent_at) return true;
  const fileLinks: { name: string; url: string }[] = [];
  for (const path of order.file_paths) {
    const { data } = await supabaseAdmin.storage.from("order-documents").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (data?.signedUrl) fileLinks.push({ name: (path.split("/").pop() ?? "Dokumentas").slice(9), url: data.signedUrl });
  }
  const sent = await sendOrderEmails({
    orderNumber: order.order_number, isCompany: order.client_type === "company",
    fullName: order.full_name ?? "", email: order.email, phone: order.phone,
    planName: order.plan_name, price: Number(order.price), projectGoal: order.project_goal ?? "", comment: order.comment ?? "",
    company: order.company_name ? { company_name: order.company_name, company_code: order.company_code ?? "",
      company_address: order.company_address, vat_code: order.vat_code ?? "" } : null,
    fileLinks,
  });
  if (!sent) return false;
  const { error: emailError } = await supabaseAdmin.from("orders")
    .update({ payment_email_sent_at: new Date().toISOString() }).eq("id", order.id);
  if (emailError) throw new Error("Nepavyko išsaugoti laiško išsiuntimo būsenos.");
  return true;
}

export async function verifyPayment(orderToken: string, config: MontonioConfig) {
  const claims = await verifyOrderToken(orderToken, config);
  const order = await findOrder(claims.merchantReference);
  if (!paymentMatches(order, claims)) throw new Error("Mokėjimo duomenys neatitinka užsakymo.");
  const remote = await requestOrder(claims.uuid, config);
  if (!paymentMatches(order, remote)) throw new Error("Mokėjimo duomenys neatitinka užsakymo.");
  if (remote.paymentStatus === "PAID") {
    const emailed = await confirmPaid(order);
    return { paid: true, orderNumber: order.order_number, emailPending: !emailed };
  }
  return { paid: false, orderNumber: order.order_number };
}

export async function initiatePayment(reference: string, origin: string, config: MontonioConfig) {
  const order = await findOrder(reference);
  if (order.payment_status === "PAID") throw new Error("Užsakymas jau apmokėtas.");
  const retryToken = await new SignJWT({ reference }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience("padeliok-payment-retry").setIssuedAt().setExpirationTime("7d")
    .sign(new TextEncoder().encode(config.secretKey));
  const returnUrl = new URL("/order-success", origin);
  returnUrl.searchParams.set("retry", retryToken);
  const cancelUrl = new URL("/order-cancel", origin);
  cancelUrl.searchParams.set("retry", retryToken);

  const [firstName = "", ...lastName] = (order.full_name ?? "").split(/\s+/);
  const token = await sign({
    accessKey: config.accessKey, merchantReference: reference,
    returnUrl: returnUrl.href, notificationUrl: new URL("/api/public/montonio", origin).href,
    currency: "EUR", grandTotal: Number(order.price), locale: "lt",
    billingAddress: { firstName, lastName: lastName.join(" "), email: order.email, country: "LT",
      ...(order.company_name ? { companyName: order.company_name } : {}) },
    lineItems: [{ name: order.plan_name, quantity: 1, finalPrice: Number(order.price) }],
    payment: { method: "paymentInitiation", amount: Number(order.price), currency: "EUR",
      methodOptions: { preferredCountry: "LT", preferredLocale: "lt", paymentDescription: `Užsakymas ${reference}` } },
  }, config);
  try {
    const res = await fetch(`${API}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: token }),
    });
    if (!res.ok) {
      // Do not log the request JWT, returned URLs, or credentials.
      console.error(`Montonio create order failed [${res.status}]`);
      throw new Error(`Montonio nepavyko pradėti mokėjimo (${res.status}). Patikrinkite testinės parduotuvės nustatymus.`);
    }
    const remote = remoteSchema.extend({ paymentUrl: z.string().url() }).parse(await res.json());
    if (remote.merchantReference !== reference || remote.currency !== "EUR" || Math.round(remote.grandTotal * 100) !== Math.round(Number(order.price) * 100))
      throw new Error("Neteisingi Montonio užsakymo duomenys.");
    const paymentUrl = new URL(remote.paymentUrl);
    if (paymentUrl.protocol !== "https:" || !paymentUrl.hostname.endsWith(".montonio.com"))
      throw new Error("Neteisinga Montonio mokėjimo nuoroda.");
    const { error } = await supabaseAdmin.from("orders").update({
      montonio_uuid: remote.uuid, montonio_checkout_url: remote.paymentUrl,
    }).eq("id", order.id);
    if (error) throw new Error("Nepavyko išsaugoti mokėjimo nuorodos.");
    return { paymentUrl: remote.paymentUrl, cancelUrl: cancelUrl.href };
  } catch {
    return { paymentUrl: null, cancelUrl: cancelUrl.href };
  }
}

export async function retryPayment(token: string, origin: string, config: MontonioConfig) {
  const reference = await retryReference(token, config);
  const order = await findOrder(reference);
  if (order.montonio_uuid) {
    const remote = await requestOrder(order.montonio_uuid, config);
    if (!paymentMatches(order, remote)) throw new Error("Mokėjimo duomenys neatitinka užsakymo.");
    if (remote.paymentStatus === "PAID") {
      const emailed = await confirmPaid(order);
      return { paid: true, orderNumber: reference, paymentUrl: null, emailPending: !emailed };
    }
    // Reuse the existing Montonio order, avoiding duplicate charge attempts.
    if (order.montonio_checkout_url) return { paid: false, orderNumber: reference, paymentUrl: order.montonio_checkout_url };
  }
  const result = await initiatePayment(reference, origin, config);
  if (!result.paymentUrl) throw new Error("Nepavyko pradėti mokėjimo. Bandykite vėliau arba susisiekite su info@padeliok.lt.");
  return { paid: false, orderNumber: reference, paymentUrl: result.paymentUrl };
}