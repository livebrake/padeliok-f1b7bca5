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