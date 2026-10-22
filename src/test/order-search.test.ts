import { describe, expect, it } from "vitest";
import { matchesOrderQuery } from "@/lib/order-search";

const order = {
  order_number: "PAD-1004",
  full_name: "Jonas Jonaitis",
  company_name: null,
  email: "jonas@example.lt",
  phone: "+37060000000",
};

describe("Admin order search", () => {
  it.each(["PAD-1004", "#PAD-1004", "pad-1004", "PAD 1004", "pad1004", "PAD_1004", "1004", "01004", "pad-10", "100", "PB-1004"])(
    "finds the order by %s",
    (query) => {
      expect(matchesOrderQuery(query, order)).toBe(true);
    },
  );

  it.each(["1005", "PAD-2004", "PB-2004", "zzz"])("does not find the order by %s", (query) => {
    expect(matchesOrderQuery(query, order)).toBe(false);
  });

  it("keeps searching by name, email and phone", () => {
    expect(matchesOrderQuery("Jonaitis", order)).toBe(true);
    expect(matchesOrderQuery("jonas@example.lt", order)).toBe(true);
    expect(matchesOrderQuery("060000000", order)).toBe(true);
    expect(matchesOrderQuery("+370 600 00000", order)).toBe(true);
    expect(matchesOrderQuery("000000", order)).toBe(true);
    expect(matchesOrderQuery("Petraitis", order)).toBe(false);
  });

  it("searches company name for legal clients", () => {
    const companyOrder = { ...order, order_number: "PAD-1005", full_name: "Jonas", company_name: "UAB Pavyzdys" };
    expect(matchesOrderQuery("pavyzdys", companyOrder)).toBe(true);
    expect(matchesOrderQuery("1005", companyOrder)).toBe(true);
  });

  it("an empty query keeps every order", () => {
    expect(matchesOrderQuery("   ", order)).toBe(true);
  });
});
