// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/order-emails.server", () => ({ sendOrderEmails: vi.fn() }));
import { paymentMatches, verifyOrderToken } from "@/lib/montonio.server";

const order = { order_number: "PAD-1004", price: 99, montonio_uuid: "f6687dee-9469-4cdf-9eee-585eed3652df" };
const remote = { uuid: order.montonio_uuid, merchantReference: "PAD-1004", currency: "EUR", grandTotal: 99 };
describe("Montonio payment verification", () => {
  it("accepts only an exact provider order, reference, EUR currency and 99 EUR amount", () => {
    expect(paymentMatches(order, remote)).toBe(true);
    expect(paymentMatches(order, { ...remote, uuid: "other" })).toBe(false);
    expect(paymentMatches(order, { ...remote, merchantReference: "PAD-1005" })).toBe(false);
    expect(paymentMatches(order, { ...remote, currency: "PLN" })).toBe(false);
    expect(paymentMatches(order, { ...remote, grandTotal: 49 })).toBe(false);
  });
  it("rejects forged, expired and different-store order tokens", async () => {
    // Fixed fixture values, never real project credentials.
    const config = { accessKey: "test-fixture-store", secretKey: "test-fixture-only-not-a-project-secret" };
    const makeToken = (accessKey: string, secretKey: string, exp: string) => new SignJWT({
      ...remote, accessKey, paymentStatus: "PAID",
    }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(exp).sign(new TextEncoder().encode(secretKey));
    const valid = await makeToken(config.accessKey, config.secretKey, "10m");
    expect((await verifyOrderToken(valid, config)).paymentStatus).toBe("PAID");
    await expect(verifyOrderToken(await makeToken(config.accessKey, "forged-fixture", "10m"), config)).rejects.toThrow();
    await expect(verifyOrderToken(await makeToken("other-store", config.secretKey, "10m"), config)).rejects.toThrow();
    await expect(verifyOrderToken(await makeToken(config.accessKey, config.secretKey, "-1s"), config)).rejects.toThrow();
  });
});