import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, FileText, MessageSquare, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { shortName, type TeamOrder } from '@/lib/team-rules';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FILE_EXT, MAX_FILE_SIZE } from '@/lib/order-validation';

export function OrderDetails({ order, onClose, openFile, invoice }: { order: TeamOrder; onClose: () => void; openFile: (path: string) => void; invoice?: { busy: boolean; download: () => void; preview: () => void } | undefined }) {
  const qc = useQueryClient(); const [note, setNote] = useState(''); const [uploading, setUploading] = useState(false);
  const { data: logs, isLoading, error } = useQuery({ queryKey: ['order-audit', order.id], queryFn: async () => { const { data, error } = await supabase.from('order_audit_logs').select('*').eq('order_id', order.id).order('created_at', { ascending: false }); if (error) throw error; return data; } });
  const save = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc('change_team_order', { order_uuid: order.id, note_text: note.trim() }); if (error) throw error; }, onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['order-audit', order.id] }); toast.success('Pastaba išsaugota.'); }, onError: (e) => toast.error(e.message) });
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error('Failas per didelis. Maksimalus leistinas vieno failo dydis yra 20 MB.'); return; }
    if (!FILE_EXT.test(file.name)) { toast.error('Pasirinkite PDF, PNG, JPG arba DOCX failą.'); return; }
    setUploading(true);
    const path = `responses/${order.id}/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase()}`;
    try { const { error } = await supabase.storage.from('order-documents').upload(path, file); if (error) throw error; const { error: saveError } = await supabase.rpc('change_team_order', { order_uuid: order.id, response_path: path }); if (saveError) throw saveError; qc.invalidateQueries({ queryKey: ['admin-orders'] }); qc.invalidateQueries({ queryKey: ['order-audit', order.id] }); toast.success('Atsakymo dokumentas įkeltas.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Nepavyko įkelti dokumento.'); } finally { setUploading(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)]">
    <DialogTitle>Užsakymas #{order.order_number}</DialogTitle><DialogDescription>{order.company_name || order.full_name} · {order.plan_name}</DialogDescription>
    {invoice && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={invoice.busy} onClick={invoice.preview}><Eye className="h-4 w-4 mr-1" />{invoice.busy ? 'Ruošiama…' : 'Peržiūrėti sąskaitą'}</Button><Button size="sm" variant="outline" disabled={invoice.busy} onClick={invoice.download}><FileText className="h-4 w-4 mr-1" />Atsisiųsti SF (PDF)</Button></div>}
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      <div><dt className="text-muted-foreground">{(order.client_type === 'company' || order.client_type === 'juridinis') ? 'Įmonės pavadinimas' : 'Užsakovas'}</dt><dd>{order.company_name || order.full_name || '—'}</dd></div>
      {(order.client_type === 'company' || order.client_type === 'juridinis') && <div><dt className="text-muted-foreground">Įmonės kodas</dt><dd>{order.company_code || '—'}</dd></div>}
      {(order.client_type === 'company' || order.client_type === 'juridinis') && <div><dt className="text-muted-foreground">PVM kodas</dt><dd>{order.vat_code || 'Ne PVM mokėtojas'}</dd></div>}
      <div><dt className="text-muted-foreground">Kontaktinis asmuo</dt><dd>{order.contact_person || order.full_name || '—'}</dd></div>
      <div><dt className="text-muted-foreground">Adresas</dt><dd>{order.company_address || '—'}</dd></div>
      <div><dt className="text-muted-foreground">El. paštas</dt><dd className="break-words"><a className="hover:underline" href={`mailto:${order.email}`}>{order.email}</a></dd></div>
      <div><dt className="text-muted-foreground">Telefonas</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
      <div><dt className="text-muted-foreground">Planuoju</dt><dd>{order.project_goal || '—'}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Užduoties aprašymas</dt><dd className="whitespace-pre-wrap break-words">{order.comment || '—'}</dd></div></dl>
    <div className="border-t pt-4 space-y-2"><h3 className="font-semibold">Dokumentai</h3><div className="flex flex-wrap gap-2">{order.file_paths.map((p,i) => <Button key={p} variant="outline" size="sm" onClick={() => openFile(p)}><FileText className="h-4 w-4 mr-1" />Kliento failas {i+1}</Button>)}{order.response_file_paths.map((p,i) => <Button key={p} variant="outline" size="sm" onClick={() => openFile(p)}><FileText className="h-4 w-4 mr-1" />Atsakymas {i+1}</Button>)}</div>
    <Label htmlFor="response-file" className="flex gap-2 items-center"><Upload className="h-4 w-4" />{uploading ? 'Įkeliama…' : 'Įkelti atsakymo dokumentą'}</Label><input id="response-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" disabled={uploading} className="text-sm max-w-full" onChange={e => { void upload(e.target.files?.[0]); e.target.value=''; }} /></div>
    <form className="border-t pt-4 space-y-2" onSubmit={e => { e.preventDefault(); save.mutate(); }}><Label htmlFor="order-note">Pridėti pastabą</Label><Textarea id="order-note" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /><Button type="submit" disabled={!note.trim() || save.isPending}>{save.isPending ? 'Saugoma…' : 'Išsaugoti'}</Button></form>
    <h3 className="font-semibold border-t pt-4">Užsakymo istorija</h3>{isLoading && <p>Įkeliama…</p>}{error && <p className="text-destructive">Nepavyko įkelti istorijos.</p>}
    <Table><TableHeader><TableRow><TableHead>Data / Laikas</TableHead><TableHead>Darbuotojas</TableHead><TableHead>Veiksmas / Įrašas</TableHead></TableRow></TableHeader><TableBody>{logs?.map(log => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString('lt-LT', { timeZone:'Europe/Vilnius' })}</TableCell><TableCell>{shortName(log.actor_name)}</TableCell><TableCell className="whitespace-pre-wrap break-words">{log.action_type==='NOTE' && <span className="inline-flex items-center gap-1 font-medium"><MessageSquare className="h-3 w-3" />Pastaba: </span>}{log.description}</TableCell></TableRow>)}{logs?.length===0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Istorijos įrašų nėra.</TableCell></TableRow>}</TableBody></Table>
  </DialogContent></Dialog>;
}