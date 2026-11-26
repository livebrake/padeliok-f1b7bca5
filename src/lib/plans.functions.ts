import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

export type PlanRow = {
  plan_key: string; name: string; price: number; description: string; features: string[]; popular: boolean;
  sale_active: boolean; sale_type: string; sale_value: number | null; sale_starts_at: string | null;
  sale_ends_at: string | null; sale_badge: string | null; sale_allow_promo: boolean;
};
export const PLAN_ORDER = ["bazinis", "standartinis", "premium"];

/** Public read of plan content and prices for SSR; only safe public columns. */
export const getPlans = createServerFn({ method: "GET" }).handler(async (): Promise<PlanRow[]> => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data, error } = await sb.from("plan_prices")
    .select("plan_key, name, price, description, features, popular, sale_active, sale_type, sale_value, sale_starts_at, sale_ends_at, sale_badge, sale_allow_promo");
  if (error) throw new Error("Nepavyko įkelti planų");
  return (data ?? [])
    .filter((r) => PLAN_ORDER.includes(r.plan_key) && Number(r.price) > 0)
    .sort((a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key))
    .map((r) => ({ ...r, price: Number(r.price), sale_value: r.sale_value == null ? null : Number(r.sale_value) }));
});

export const plansQuery = queryOptions({ queryKey: ["plans"], queryFn: () => getPlans() });
