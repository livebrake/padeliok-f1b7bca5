import { describe, expect, it } from "vitest";
import { validateCheckout } from "@/lib/order-validation";

const person = { clientType: "fizinis", fullName: "Jonas Jonaitis", email: "jonas@example.lt", phone: "060000000", projectGoal: "Kita", komentaras: "Patikrinti statybos galimybes.", agreement: "1" };
const company = { ...person, clientType: "juridinis", fullName: "Jonas", companyName: "UAB Pavyzdys", companyCode: "123456789", companyAddress: "Kauno g. 1, Kaunas", vatCode: "LT123456789", noVat: "0" };
const files = [{ name: "planas.pdf", size: 100 }];

describe("Checkout eligibility", () => {
  it.each(["fullName", "email", "phone"])("requires private client %s", (field) => {
    expect(validateCheckout(person, files)).toEqual({});
    expect(validateCheckout({ ...person, [field]: "" }, files)[field]).toBeTruthy();
  });
  it.each(["companyName", "companyCode", "email", "phone", "vatCode"])("requires company %s", (field) => {
    expect(validateCheckout(company, files)).toEqual({});
    expect(validateCheckout({ ...company, [field]: "" }, files)[field]).toBeTruthy();
  });
  it("waives VAT code only with the non-VAT checkbox", () => {
    expect(validateCheckout({ ...company, vatCode: "", noVat: "1" }, files)).toEqual({});
    expect(validateCheckout({ ...company, vatCode: "", noVat: "0" }, files)["vatCode"]).toBeTruthy();
  });
  it("requires explicit terms acceptance", () => {
    expect(validateCheckout({ ...person, agreement: undefined }, files)["agreement"]).toBeTruthy();
    expect(validateCheckout({ ...person, agreement: "0" }, files)["agreement"]).toBeTruthy();
    expect(validateCheckout(person, files)).toEqual({});
  });
  it("rejects incorrectly filled mandatory fields", () => {
    expect(validateCheckout({ ...person, email: "incorrect", phone: "123", fullName: "Jonas" }, files)).toMatchObject({ email: expect.any(String), phone: expect.any(String), fullName: expect.any(String) });
  });
  it("preserves mandatory intent, description and document requirements", () => {
    expect(validateCheckout({ ...person, projectGoal: "", komentaras: " " }, [])).toMatchObject({ projectGoal: expect.any(String), komentaras: expect.any(String), files: expect.any(String) });
  });
});
describe("Optional company fields", () => {
  it("allows empty company address and contact person", () => {
    expect(validateCheckout({ ...company, companyAddress: "", fullName: "" }, files)).toEqual({});
  });
  it("still requires private client name", () => {
    expect(validateCheckout({ ...person, fullName: "" }, files)["fullName"]).toBeTruthy();
  });
  it("accepts one of the two documents", () => {
    expect(validateCheckout(person, [{ name: "a.pdf", size: 1 }])).toEqual({});
    expect(validateCheckout(person, [])["files"]).toBeTruthy();
  });
});
describe("File limits", () => {
  it("allows at most two documents", () => {
    expect(validateCheckout(person, [{ name: "a.pdf", size: 1 }, { name: "b.pdf", size: 1 }])).toEqual({});
    expect(
      validateCheckout(person, [{ name: "a.pdf", size: 1 }, { name: "b.pdf", size: 1 }, { name: "c.pdf", size: 1 }])["files"],
    ).toBe("Galima prisegti ne daugiau kaip 2 failus.");
  });
  it("rejects files over 20 MB with a clear message", () => {
    expect(validateCheckout(person, [{ name: "a.pdf", size: 20 * 1024 * 1024 }])).toEqual({});
    expect(validateCheckout(person, [{ name: "a.pdf", size: 20 * 1024 * 1024 + 1 }])["files"]).toBe(
      "Failas per didelis. Maksimalus leistinas vieno failo dydis yra 20 MB.",
    );
  });
});
