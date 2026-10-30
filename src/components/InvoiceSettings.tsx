import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invoiceSettingsErrors } from '@/lib/invoice-settings-validation';
import { formatInvoiceNumber } from '@/lib/invoice-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type F = { series_prefix: string; company_name: string; company_code: string; vat_code: string; company_address: string; bank_name: string; bank_iban: string; is_vat_payer: boolean; last_number: string };
const FIELDS: [keyof F, string][] = [['company_name', 'Įmonės pavadinimas'], ['company_code', 'Įmonės kodas'], ['vat_code', 'PVM kodas'], ['company_address', 'Adresas'], ['bank_name', 'Bankas'], ['bank_iban', 'IBAN']];
const COMPANY_KEYS = ['company_code', 'vat_code', 'bank_iban'];
const INVOICE_KEYS = ['series_prefix', 'last_number'];

/** Shared load + per-section validation; each section saves only its own columns. */
function useSettings(keys: string[]) {
  const [f, setF] = useState<F | null>(null);
  const [savedNumber, setSavedNumber] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    supabase.from('invoice_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error('Nepavyko įkelti nustatymų.'); return; }
      setSavedNumber(data.last_number);
      setF({ ...data, vat_code: data.vat_code ?? '', last_number: String(data.last_number) });
    });
  }, []);
  const all: Partial<Record<string, string>> = f ? { ...invoiceSettingsErrors(f) } : {};
  if (f && !/^[A-Z0-9]{1,10}$/.test(f.series_prefix)) all['series_prefix'] = 'Serija gali būti tik didžiosios raidės ir skaičiai';
  const errors = Object.fromEntries(keys.filter(k => all[k]).map(k => [k, all[k]!]));
  const shown = (k: string) => (submitted || touched.has(k) ? errors[k] : undefined);
  return {
    f, setF, savedNumber, setSavedNumber,
    hasShownErrors: keys.some(k => shown(k)),
    touch: (k: string) => setTouched(t => (t.has(k) ? t : new Set(t).add(k))),
    validate: () => { setSubmitted(true); return Object.keys(errors).length === 0; },
    fieldError: (k: string) => { const m = shown(k); return m ? <p id={`inv-${k}-err`} className="text-xs text-destructive">{m}</p> : null; },
    errProps: (k: string) => (shown(k) ? { 'aria-invalid': true, 'aria-describedby': `inv-${k}-err`, className: 'border-destructive focus-visible:ring-destructive' } : {}),
  };
}

export function CompanyDetailsSettings() {
  const s = useSettings(COMPANY_KEYS);
  const [saving, setSaving] = useState(false);
  const { f, setF } = s;
  if (!f) return <p className="text-sm text-muted-foreground">Įkeliama…</p>;
  const save = async () => {
    if (!s.validate()) return;
    setSaving(true);
    const { data, error } = await supabase.from('invoice_settings').update({
      company_name: f.company_name.trim(), company_code: f.company_code.trim(), vat_code: f.is_vat_payer ? f.vat_code.replace(/\s+/g, '').toUpperCase() : null,
      company_address: f.company_address.trim(), bank_name: f.bank_name.trim(), bank_iban: f.bank_iban.replace(/\s+/g, '').toUpperCase(), is_vat_payer: f.is_vat_payer,
    }).eq('id', true).select('id');
    setSaving(false);
    if (error || !data?.length) return void toast.error('Nepavyko išsaugoti. Nustatymus keisti gali tik vadovas.');
    toast.success('Įmonės rekvizitai išsaugoti');
  };
  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Įmonės rekvizitai</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="space-y-1.5"><Label htmlFor={`inv-${k}`}>{l}</Label>
            <Input id={`inv-${k}`} {...s.errProps(k)} disabled={k === 'vat_code' && !f.is_vat_payer} value={f[k] as string} onChange={e => { s.touch(k); setF({ ...f, [k]: e.target.value }); }} />{s.fieldError(k)}</div>
        ))}
      </div>
      <div className="flex items-center gap-3"><Switch id="inv-vat" checked={f.is_vat_payer} onCheckedChange={v => setF({ ...f, is_vat_payer: v, vat_code: v ? f.vat_code : '' })} />
        <Label htmlFor="inv-vat">PVM mokėtojas (21 %)</Label></div>
      <Button disabled={saving || s.hasShownErrors} onClick={() => void save()}>{saving ? 'Saugoma…' : 'Išsaugoti rekvizitus'}</Button>
    </div>
  );
}

export function InvoiceSettings() {
  const s = useSettings(INVOICE_KEYS);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { f, setF, savedNumber } = s;
  if (!f) return <p className="text-sm text-muted-foreground">Įkeliama…</p>;
  const num = Number(f.last_number);
  const numValid = Number.isInteger(num) && num >= 0 && /^\d+$/.test(f.last_number);
  const save = async (): Promise<void> => {
    if (!s.validate()) return;
    setSaving(true);
    const { data, error } = await supabase.from('invoice_settings').update({ series_prefix: f.series_prefix, last_number: num }).eq('id', true).select('last_number');
    setSaving(false);
    if (error || !data?.length) return void toast.error('Nepavyko išsaugoti. Nustatymus keisti gali tik vadovas.');
    s.setSavedNumber(num);
    toast.success('Sąskaitų nustatymai išsaugoti');
  };
  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Sąskaitų nustatymai</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="inv-prefix">Serija</Label>
          <Input id="inv-prefix" {...s.errProps('series_prefix')} value={f.series_prefix} onChange={e => { s.touch('series_prefix'); setF({ ...f, series_prefix: e.target.value.toUpperCase() }); }} />{s.fieldError('series_prefix')}</div>
        <div className="space-y-1.5"><Label htmlFor="inv-last">Paskutinis išrašytas numeris</Label>
          <Input id="inv-last" inputMode="numeric" {...s.errProps('last_number')} value={f.last_number} onChange={e => { s.touch('last_number'); setF({ ...f, last_number: e.target.value.trim() }); }} />{s.fieldError('last_number')}
          <p className="text-xs text-muted-foreground">Sekanti automatinė sąskaita bus: {numValid ? formatInvoiceNumber(f.series_prefix, num + 1) : '—'}</p></div>
      </div>
      <Button disabled={saving || s.hasShownErrors} onClick={() => { if (!s.validate()) return; if (num !== savedNumber) setConfirm(true); else void save(); }}>{saving ? 'Saugoma…' : 'Išsaugoti sąskaitų nustatymus'}</Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Pakeisti sąskaitų numeraciją?</AlertDialogTitle>
            <AlertDialogDescription>Paskutinis numeris bus pakeistas iš {savedNumber} į {num}. Sekanti automatinė sąskaita bus: {formatInvoiceNumber(f.series_prefix, num + 1)}. Įsitikinkite, kad numeriai nesidubliuos.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Atšaukti</AlertDialogCancel><AlertDialogAction onClick={save}>Patvirtinti</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
