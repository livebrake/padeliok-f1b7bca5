import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invoicesCsv } from '@/lib/invoice-pdf';
import { downloadBlob, invoicePdfBlob } from '@/lib/invoice-client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

export function AccountingExport() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [busy, setBusy] = useState<string | null>(null);
  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const tag = `${year}-${String(Number(month) + 1).padStart(2, '0')}`;

  async function fetchRows() {
    const from = new Date(Number(year), Number(month), 1).toISOString();
    const to = new Date(Number(year), Number(month) + 1, 1).toISOString();
    const { data, error } = await supabase.from('invoices').select('*').gte('issue_date', from).lt('issue_date', to).order('invoice_number');
    if (error) throw error;
    if (!data.length) { toast.info('Šį mėnesį sąskaitų nėra.'); return null; }
    return data;
  }
  async function zip() {
    setBusy('zip');
    try {
      const rows = await fetchRows(); if (!rows) return;
      const { default: JSZip } = await import('jszip');
      const z = new JSZip();
      for (const r of rows) z.file(`${r.invoice_number}.pdf`, await invoicePdfBlob(r));
      downloadBlob(await z.generateAsync({ type: 'blob', compression: 'STORE' }), `saskaitos-${tag}.zip`);
    } catch { toast.error('Nepavyko paruošti ZIP archyvo.'); } finally { setBusy(null); }
  }
  async function csv() {
    setBusy('csv');
    try {
      const rows = await fetchRows(); if (!rows) return;
      downloadBlob(new Blob([invoicesCsv(rows)], { type: 'text/csv;charset=utf-8' }), `saskaitu-suvestine-${tag}.csv`);
    } catch { toast.error('Nepavyko paruošti suvestinės.'); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h3 className="text-lg font-semibold">Buhalterija</h3>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-40" aria-label="Mėnuo"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={year} onValueChange={setYear}><SelectTrigger className="w-28" aria-label="Metai"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
        <Button onClick={zip} disabled={!!busy}>{busy === 'zip' ? 'Ruošiama…' : 'Atsisiųsti ZIP (PDF sąskaitos)'}</Button>
        <Button variant="outline" onClick={csv} disabled={!!busy}>{busy === 'csv' ? 'Ruošiama…' : 'Atsisiųsti Excel / CSV suvestinę'}</Button>
      </div>
    </div>
  );
}
