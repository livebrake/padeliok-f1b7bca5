import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = { plan_key: string; name: string; price: string };
const ORDER = ["bazinis", "standartinis", "premium"];

export function PlanPricesSettings() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("plan_prices").select("plan_key, name, price").then(({ data, error }) => {
      if (error) return toast.error("Nepavyko įkelti kainų.");
      setRows((data ?? []).sort((a, b) => ORDER.indexOf(a.plan_key) - ORDER.indexOf(b.plan_key))
        .map((r) => ({ ...r, price: String(r.price).replace(".", ",") })));
    });
  }, []);

  const save = async () => {
    if (!rows) return;
    const parsed = rows.map((r) => ({ ...r, value: Number(r.price.replace(",", ".")) }));
    if (parsed.some((r) => !Number.isFinite(r.value) || r.value <= 0 || r.value >= 100000))
      return toast.error("Įveskite teigiamą kainą eurais (pvz., 49 arba 49,90).");
    setSaving(true);
    for (const r of parsed) {
      const { data, error } = await supabase.from("plan_prices")
        .update({ price: Math.round(r.value * 100) / 100 }).eq("plan_key", r.plan_key).select("plan_key");
      if (error || !data?.length) {
        setSaving(false);
        return toast.error("Nepavyko išsaugoti kainų. Kainas keisti gali tik vadovas.");
      }
    }
    setSaving(false);
    toast.success("Kainos sėkmingai atnaujintos");
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Planų kainos</h3>
      {!rows ? <p className="text-sm text-muted-foreground">Įkeliama…</p> : (
        <div className="grid gap-4 sm:grid-cols-3">
          {rows.map((r, i) => (
            <div key={r.plan_key} className="space-y-1.5">
              <Label htmlFor={`price-${r.plan_key}`}>{r.name} (€)</Label>
              <Input id={`price-${r.plan_key}`} inputMode="decimal" value={r.price}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      )}
      <Button onClick={save} disabled={!rows || saving}>{saving ? "Saugoma…" : "Išsaugoti kainas"}</Button>
    </div>
  );
}
