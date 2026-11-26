import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { saleStatus } from "@/lib/plan-sale";

type Sale = { active: boolean; type: "percent" | "fixed"; value: string; starts: string; ends: string; badge: string; allowPromo: boolean };
type Row = { plan_key: string; name: string; price: string; sale: Sale };
const ORDER = ["bazinis", "standartinis", "premium"];
const EMPTY: Sale = { active: false, type: "percent", value: "", starts: "", ends: "", badge: "", allowPromo: false };

export function isPriceInput(value: string): boolean {
  return /^[0-9]*(?:[,.][0-9]*)?$/.test(value);
}
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const num = (s: string) => Number(s.replace(",", "."));

/** Returns an error message or null; shared by per-plan and bulk saves. */
export function saleError(s: Sale): string | null {
  if (!s.active) return null;
  const v = num(s.value);
  if (!isPriceInput(s.value) || !(v > 0)) return "Įveskite teigiamą nuolaidos dydį.";
  if (s.type === "percent" && v >= 100) return "Procentinė nuolaida turi būti mažesnė nei 100%.";
  if (s.starts && s.ends && new Date(s.ends) <= new Date(s.starts)) return "Pabaigos data turi būti vėlesnė už pradžios datą.";
  if (s.badge.length > 40) return "Žymos tekstas – iki 40 simbolių.";
  return null;
}

function statusBadge(r: Row) {
  const st = saleStatus({ price: 0, sale_active: r.sale.active, sale_type: r.sale.type, sale_value: num(r.sale.value),
    sale_starts_at: r.sale.starts ? new Date(r.sale.starts).toISOString() : null,
    sale_ends_at: r.sale.ends ? new Date(r.sale.ends).toISOString() : null, sale_badge: null, sale_allow_promo: false });
  if (st === "active") return <Badge className="bg-success text-success-foreground">Aktyvi</Badge>;
  if (st === "scheduled") return <Badge className="bg-primary text-primary-foreground">Suplanuota nuo {r.sale.starts.replace("T", " ")}</Badge>;
  if (st === "expired") return <Badge variant="secondary">Pasibaigusi</Badge>;
  return null;
}

function SaleFields({ id, s, onChange }: { id: string; s: Sale; onChange: (s: Sale) => void }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <label className="flex items-center gap-2 font-medium">
        <Checkbox checked={s.active} onCheckedChange={(c) => onChange({ ...s, active: c === true })} /> Taikyti akciją
      </label>
      {s.active && <>
        <div className="flex gap-2">
          <Input aria-label="Nuolaidos dydis" inputMode="decimal" value={s.value} placeholder="30"
            onChange={(e) => isPriceInput(e.target.value) && onChange({ ...s, value: e.target.value })} />
          <select aria-label="Nuolaidos tipas" className="rounded-md border border-input bg-background px-2" value={s.type}
            onChange={(e) => onChange({ ...s, type: e.target.value as Sale["type"] })}>
            <option value="percent">%</option><option value="fixed">€</option>
          </select>
        </div>
        <Label htmlFor={`${id}-start`}>Pradžia (nebūtina)</Label>
        <Input id={`${id}-start`} type="datetime-local" value={s.starts} onChange={(e) => onChange({ ...s, starts: e.target.value })} />
        <Label htmlFor={`${id}-end`}>Pabaiga (nebūtina)</Label>
        <Input id={`${id}-end`} type="datetime-local" value={s.ends} onChange={(e) => onChange({ ...s, ends: e.target.value })} />
        <Label htmlFor={`${id}-badge`}>Žymos tekstas (nebūtina)</Label>
        <Input id={`${id}-badge`} maxLength={40} value={s.badge} placeholder="Pavasario akcija" onChange={(e) => onChange({ ...s, badge: e.target.value })} />
        <label className="flex items-center gap-2">
          <Checkbox checked={s.allowPromo} onCheckedChange={(c) => onChange({ ...s, allowPromo: c === true })} /> Leisti nuolaidų kodus akcijos metu
        </label>
      </>}
    </div>
  );
}

export function PlanPricesSettings() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bulk, setBulk] = useState<Sale>({ ...EMPTY, active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("plan_prices").select("plan_key, name, price, sale_active, sale_type, sale_value, sale_starts_at, sale_ends_at, sale_badge, sale_allow_promo").then(({ data, error }) => {
      if (error) { toast.error("Nepavyko įkelti kainų."); return; }
      setRows((data ?? []).sort((a, b) => ORDER.indexOf(a.plan_key) - ORDER.indexOf(b.plan_key)).map((r) => ({
        plan_key: r.plan_key, name: r.name, price: String(r.price).replace(".", ","),
        sale: { active: r.sale_active, type: r.sale_type === "fixed" ? "fixed" : "percent", value: r.sale_value == null ? "" : String(r.sale_value).replace(".", ","),
          starts: toLocal(r.sale_starts_at), ends: toLocal(r.sale_ends_at), badge: r.sale_badge ?? "", allowPromo: r.sale_allow_promo },
      })));
    });
  }, []);

  const persist = async (list: Row[]): Promise<void> => {
    const parsed = list.map((r) => ({ ...r, value: num(r.price) }));
    if (parsed.some((r) => !isPriceInput(r.price) || !Number.isFinite(r.value) || r.value <= 0 || r.value >= 100000))
      return void toast.error("Įveskite teigiamą kainą eurais (pvz., 49 arba 49,90).");
    for (const r of parsed) {
      const err = saleError(r.sale);
      if (err) return void toast.error(`${r.name}: ${err}`);
      if (r.sale.active && r.sale.type === "fixed" && r.value - num(r.sale.value) < 1)
        return void toast.error(`${r.name}: nuolaida per didelė.`);
    }
    setSaving(true);
    for (const r of parsed) {
      const s = r.sale;
      const { data, error } = await supabase.from("plan_prices").update({
        price: Math.round(r.value * 100) / 100,
        sale_active: s.active, sale_type: s.type, sale_value: s.active ? num(s.value) : null,
        sale_starts_at: s.active && s.starts ? new Date(s.starts).toISOString() : null,
        sale_ends_at: s.active && s.ends ? new Date(s.ends).toISOString() : null,
        sale_badge: s.active ? s.badge.trim() || null : null, sale_allow_promo: s.active && s.allowPromo,
      }).eq("plan_key", r.plan_key).select("plan_key");
      if (error || !data?.length) {
        setSaving(false);
        return void toast.error("Nepavyko išsaugoti kainų. Kainas keisti gali tik vadovas.");
      }
    }
    setRows(list);
    setSaving(false);
    toast.success("Kainos ir akcijos atnaujintos");
  };

  const update = (i: number, patch: Partial<Row>) => rows && setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Planų kainos ir akcijos</h3>
      {!rows ? <p className="text-sm text-muted-foreground">Įkeliama…</p> : <>
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <p className="text-sm font-semibold">Bendra akcija visiems planams</p>
          <SaleFields id="bulk" s={bulk} onChange={setBulk} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={saving} onClick={() => void persist(rows.map((r) => ({ ...r, sale: { ...bulk, active: true } })))}>Pritaikyti visiems planams</Button>
            <Button variant="outline" disabled={saving} onClick={() => void persist(rows.map((r) => ({ ...r, sale: { ...r.sale, active: false } })))}>Atšaukti visas akcijas</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {rows.map((r, i) => (
            <div key={r.plan_key} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`price-${r.plan_key}`}>{r.name} (€)</Label>{statusBadge(r)}
              </div>
              <Input id={`price-${r.plan_key}`} inputMode="decimal" value={r.price}
                onChange={(e) => { if (isPriceInput(e.target.value)) update(i, { price: e.target.value }); }} />
              <SaleFields id={r.plan_key} s={r.sale} onChange={(sale) => update(i, { sale })} />
            </div>
          ))}
        </div>
      </>}
      <Button onClick={() => rows && void persist(rows)} disabled={!rows || saving}>{saving ? "Saugoma…" : "Išsaugoti kainas"}</Button>
    </div>
  );
}
