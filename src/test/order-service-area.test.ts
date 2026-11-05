// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), createPayment: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/montonio.server", () => ({ createPayment: mocks.createPayment }));
import { submitOrder } from "@/lib/orders.functions";

describe("Order creation service area protection", () => {
  it.each([undefined, "", "Vilnius", "Klaipėda", "Šiauliai"])("rejects %s before saving or payment", async (serviceArea) => {
    vi.clearAllMocks();
    const invoke = submitOrder as unknown as (args: unknown) => Promise<unknown>;
    const result = await invoke({ data: {
      plan: "bazinis", clientType: "fizinis", fullName: "Jonas Jonaitis", email: "jonas@example.lt",
      phone: "060000000", serviceArea, projectGoal: "Kita", komentaras: "Sklypo analizė",
      agreement: "1", paymentMethod: "card", filePaths: ["incoming/planas.pdf"],
    } });
    expect(result).toMatchObject({ ok: false, code: "validation", message: serviceArea
      ? "Atsiprašome, šiuo metu sklypų analizę atliekame tik Kaune ir Kauno rajone."
      : "Pasirinkite miestą / rajoną." });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });
});