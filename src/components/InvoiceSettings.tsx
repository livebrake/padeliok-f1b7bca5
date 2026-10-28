import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatInvoiceNumber } from '@/lib/invoice-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type F = { series_prefix: string; company_name: string; company_code: string; vat_code: string; company_address: string; bank_name: string; bank_iban: string; is_vat_payer: boolean; last_number: string };
const FIELDS: [keyof F, string][] = [['company_name', 'Įmonės pavadinimas'], ['company_code', 'Įmonės kodas'], ['vat_code', 'PVM kodas (nebūtina)'], ['company_address', 'Adresas'], ['bank_name', 'Bankas'], ['bank_iban', 'IBAN']];

export function InvoiceSettings() {
  const [f, setF] = useState<F | null>(null);
  const [savedNumber, setSavedNumber] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    supabase.from('invoice_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error('Nepavyko įkelti sąskaitų nustatymų.'); return; }
      setSavedNumber(data.last_number);
      setF({ ...data, vat_code: data.vat_code ?? '', last_number: String(data.last_number) });
    });
  }, []);
  if (!f) return <p className="text-sm text-muted-foreground">Įkeliama…</p>;
  const num = Number(f.last_number);
  const numValid = Number.isInteger(num) && num >= 0 && /^\d+$/.test(f.last_number);

  const save = async (): Promise<void> => {
    if (!numValid) return void toast.error('Paskutinis numeris turi būti sveikasis skaičius (0 ar daugiau).');
    if (!/^[A-Z0-9]{1,10}$/.test(f.series_prefix)) return void toast.error('Serija gali būti tik didžiosios raidės ir skaičiai.');
    setSaving(true);
    const { data, error } = await supabase.from('invoice_settings').update({
      series_prefix: f.series_prefix, company_name: f.company_name.trim(), company_code: f.company_code.trim(), vat_code: f.vat_code.trim() || null,
      company_address: f.company_address.trim(), bank_name: f.bank_name.trim(), bank_iban: f.bank_iban.replace(/\s+/g, '').toUpperCase(), is_vat_payer: f.is_vat_payer, last_number: num,
    }).eq('id', true).select('last_number');
    setSaving(false);
    if (error || !data?.length) return void toast.error('Nepavyko išsaugoti. Nustatymus keisti gali tik vadovas.');
    setSavedNumber(num);
    toast.success('Rekvizitai ir sąskaitų nustatymai išsaugoti');
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Įmonės rekvizitai ir Sąskaitų nustatymai</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="space-y-1.5"><Label htmlFor={`inv-${k}`}>{l}</Label>
            <Input id={`inv-${k}`} value={f[k] as string} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div className="space-y-1.5"><Label htmlFor="inv-prefix">Serija</Label>
          <Input id="inv-prefix" value={f.series_prefix} onChange={e => setF({ ...f, series_prefix: e.target.value.toUpperCase() })} /></div>
        <div className="space-y-1.5"><Label htmlFor="inv-last">Paskutinis išrašytas numeris</Label>
          <Input id="inv-last" inputMode="numeric" value={f.last_number} onChange={e => setF({ ...f, last_number: e.target.value.trim() })} />
          <p className="text-xs text-muted-foreground">Sekanti automatinė sąskaita bus: {numValid ? formatInvoiceNumber(f.series_prefix, num + 1) : '—'}</p></div>
      </div>
      <div className="flex items-center gap-3"><Switch id="inv-vat" checked={f.is_vat_payer} onCheckedChange={v => setF({ ...f, is_vat_payer: v })} />
        <Label htmlFor="inv-vat">PVM mokėtojas (21 %)</Label></div>
      <Button disabled={saving} onClick={() => (numValid && num !== savedNumber ? setConfirm(true) : save())}>{saving ? 'Saugoma…' : 'Išsaugoti rekvizitus'}</Button>
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
