import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({
    select: () => Promise.resolve({ data: [{ plan_key: "bazinis", name: "Bazinis", price: 49 }], error: null }),
    update: (value: unknown) => {
      update(value);
      return { eq: () => ({ select: () => Promise.resolve({ data: [{ plan_key: "bazinis" }], error: null }) }) };
    },
  }) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { isPriceInput, PlanPricesSettings } from "@/components/PlanPricesSettings";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Plan price input", () => {
  it("rejects letters, signs, spaces and repeated decimal separators", () => {
    for (const value of ["abc", "49eur", "1e3", "-49", "+49", "49 €", "49,9.0", "49..90", " 49"])
      expect(isPriceInput(value), value).toBe(false);
  });

  it("accepts digits, decimal prices and empty editing states", () => {
    for (const value of ["", "49", "99", "199", "49,90", "49.90", "49,"])
      expect(isPriceInput(value), value).toBe(true);
  });

  it("blocks invalid typed or pasted values and saves a decimal price as a number", async () => {
    render(<PlanPricesSettings />);
    const input = await screen.findByLabelText("Bazinis (€)");
    fireEvent.change(input, { target: { value: "49abc" } });
    expect(input).toHaveValue("49");
    fireEvent.change(input, { target: { value: "1e3" } });
    expect(input).toHaveValue("49");
    fireEvent.change(input, { target: { value: "49,90" } });
    expect(input).toHaveValue("49,90");
    fireEvent.click(screen.getByRole("button", { name: "Išsaugoti kainas" }));
    expect(update).toHaveBeenCalledWith({ price: 49.9 });
    await screen.findByRole("button", { name: "Išsaugoti kainas" });
  });
});