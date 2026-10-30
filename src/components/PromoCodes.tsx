import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isExpired, normalizeCode, promoPlans } from "@/lib/promo";
import { formatEur, paymentLabel, type TeamOrder } from "@/lib/team-rules";
import { PlanMultiSelect, planName } from "@/components/PlanMultiSelect";

type Promo = Tables<"promo_codes">;
const empty = { note: "", code: "", type: "percent", value: "", from: "", to: "", max: "" };

export function PromoCodes({ orders }: { orders: TeamOrder[] }) {
  const [plans, setPlans] = useState<string[]>([]);
  const [rows, setRows] = useState<Promo[] | null>(null);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const load = () => supabase.from("promo_codes").select("*").order("created_at", { ascending: false })
    .then(({ data, error }) => error ? toast.error("Nepavyko įkelti nuolaidų kodų.") : setRows(data ?? []));
  useEffect(() => { void load(); }, []);

  const used = (id: string) => orders.filter(o => (o as { promo_code_id?: string | null }).promo_code_id === id && paymentLabel(o.payment_status) === "Apmokėta").length;
  const set = (k: keyof typeof empty) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const create = async () => {
    const code = normalizeCode(f.code);
    const value = Number(f.value.replace(",", "."));
    const max = f.max.trim() ? Number(f.max) : null;
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) return void toast.error("Kodas: 3–40 simbolių (raidės, skaičiai, brūkšnelis).");
    if (!(value > 0) || (f.type === "percent" && value > 100)) return void toast.error(f.type === "percent" ? "Procentai turi būti nuo 1 iki 100." : "Suma turi būti teigiama.");
    if (max !== null && !(Number.isInteger(max) && max > 0)) return void toast.error("Panaudojimų limitas turi būti teigiamas sveikasis skaičius.");
    if (f.from && f.to && f.from > f.to) return void toast.error("Pabaigos data turi būti vėlesnė už pradžios.");
    setSaving(true);
    const { error } = await supabase.from("promo_codes").insert({
      code, note: f.note.trim() || null, discount_type: f.type, discount_value: value,
      valid_from: f.from ? new Date(`${f.from}T00:00:00`).toISOString() : null,
      valid_to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : null,
      max_uses: max, plan_key: null, plan_keys: plans.length ? plans : null,
    });
    setSaving(false);
    if (error) return void toast.error(error.code === "23505" ? "Toks kodas jau egzistuoja." : "Nepavyko sukurti kodo.");
    toast.success("Nuolaidos kodas sukurtas");
    setF(empty); setPlans([]); void load();
  };
  const toggle = async (p: Promo, v: boolean) => {
    const { error } = await supabase.from("promo_codes").update({ is_active: v }).eq("id", p.id);
    if (error) toast.error("Nepavyko pakeisti būsenos."); else void load();
  };
  const remove = async (p: Promo) => {
    if (!confirm(`Ištrinti kodą ${p.code}? Ankstesni užsakymai nepasikeis.`)) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", p.id);
    if (error) toast.error("Nepavyko ištrinti kodo."); else { toast.success("Kodas ištrintas"); void load(); }
  };

  const list = rows ?? [];
  const archived = list.filter(p => isExpired(p, used(p.id)));
  const current = list.filter(p => !archived.includes(p));
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("lt-LT") : "—";
  const table = (items: Promo[]) => items.length === 0 ? <p className="text-sm text-muted-foreground">Kodų nėra.</p> : (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-left text-muted-foreground"><tr><th className="py-2">Kodas</th><th>Nuolaida</th><th>Planas</th><th>Galioja</th><th>Panaudota</th><th>Aktyvus</th><th /></tr></thead>
      <tbody>{items.map(p => (
        <tr key={p.id} className="border-t">
          <td className="py-2"><div className="font-mono">{p.code}</div>{p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}</td>
          <td>{p.discount_type === "percent" ? `${Number(p.discount_value)}%` : formatEur(Number(p.discount_value))}</td>
          <td>{promoPlans(p).length ? promoPlans(p).map(planName).join(", ") : "Visi planai"}</td>
          <td>{fmtDate(p.valid_from)} – {fmtDate(p.valid_to)}</td>
          <td>{used(p.id)}{p.max_uses ? ` / ${p.max_uses}` : " / ∞"}</td>
          <td><Switch checked={p.is_active} onCheckedChange={v => void toggle(p, v)} aria-label={`Aktyvus ${p.code}`} /></td>
          <td className="text-right"><Button size="icon" variant="ghost" onClick={() => void remove(p)} aria-label={`Ištrinti ${p.code}`}><Trash2 className="h-4 w-4" /></Button></td>
        </tr>))}</tbody>
    </table></div>);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-bold">Nuolaidų kodai</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label>Kodas</Label><Input value={f.code} onChange={e => set("code")(e.target.value)} placeholder="JONAS10" className="font-mono uppercase" /></div>
        <div className="space-y-1"><Label>Nuolaidos tipas</Label><Select value={f.type} onValueChange={set("type")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Procentai (%)</SelectItem><SelectItem value="fixed">Fiksuota suma (€)</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label>Dydis ({f.type === "percent" ? "%" : "€"})</Label><Input inputMode="decimal" value={f.value} onChange={e => set("value")(e.target.value)} /></div>
        <div className="space-y-1"><Label>Galioja nuo</Label><Input type="date" value={f.from} onChange={e => set("from")(e.target.value)} /></div>
        <div className="space-y-1"><Label>Galioja iki</Label><Input type="date" value={f.to} onChange={e => set("to")(e.target.value)} /></div>
        <div className="space-y-1"><Label>Panaudojimų limitas</Label><Input inputMode="numeric" value={f.max} onChange={e => set("max")(e.target.value)} placeholder="Neribota" /></div>
        <div className="space-y-1"><Label>Planai</Label><PlanMultiSelect value={plans} onChange={setPlans} /></div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-4"><Label>Pastaba / Kam skirtas kodas</Label><Input value={f.note} maxLength={300} onChange={e => set("note")(e.target.value)} placeholder="Skirta architektui Jonui už bendradarbiavimą" /><p className="text-xs text-muted-foreground">Matoma tik administracijoje, klientams nerodoma.</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Kodas: <span className="font-mono">{normalizeCode(f.code) || "—"}</span>. Tuščios datos ir limitas – neribota.</p>
      <Button onClick={() => void create()} disabled={saving}>Sukurti kodą</Button>
      {rows === null ? <p className="text-sm text-muted-foreground">Įkeliama…</p> : table(current)}
      {archived.length > 0 && <div><Button variant="link" className="px-0" onClick={() => setShowArchive(v => !v)}>{showArchive ? "Slėpti archyvą" : `Archyvas (${archived.length})`}</Button>{showArchive && table(archived)}</div>}
    </section>
  );
}

export function DiscountStats({ summary }: { summary: { total: number; count: number; byPlan: { name: string; count: number; total: number }[]; byCode: { code: string; count: number; total: number }[] } }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-bold">Nuolaidos</h3>
      <dl className="grid gap-6 sm:grid-cols-2"><div><dt className="text-muted-foreground">Suteikta nuolaidų</dt><dd className="text-2xl font-bold">{formatEur(summary.total)}</dd></div><div><dt className="text-muted-foreground">Panaudota kodų</dt><dd className="text-2xl font-bold">{summary.count}</dd></div></dl>
      <div className="grid gap-6 md:grid-cols-2">
        <table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th>Planas</th><th>Panaudojimai</th><th className="text-right">Nuolaida</th></tr></thead><tbody>{summary.byPlan.map(r => <tr key={r.name} className="border-t"><td className="py-1.5">{r.name}</td><td>{r.count}</td><td className="text-right">{formatEur(r.total)}</td></tr>)}</tbody></table>
        <table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th>Kodas</th><th>Panaudojimai</th><th className="text-right">Nuolaida</th></tr></thead><tbody>{summary.byCode.length ? summary.byCode.map(r => <tr key={r.code} className="border-t"><td className="py-1.5 font-mono">{r.code}</td><td>{r.count}</td><td className="text-right">{formatEur(r.total)}</td></tr>) : <tr className="border-t"><td colSpan={3} className="py-1.5 text-muted-foreground">Kodų nepanaudota.</td></tr>}</tbody></table>
      </div>
    </section>
  );
}
